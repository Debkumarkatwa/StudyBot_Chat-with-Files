from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, update
import asyncio
from datetime import datetime, timezone

from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.refresh_token import RefreshToken
from app.schemas.user import UserSignup, UserLogin, UserResponse, TokenResponse, RefreshRequest, UpdateNameRequest, ChangePasswordRequest, DeleteAccountRequest, LogoutRequest
from app.security import hash_password, verify_password
from app.storage import delete_file
from app.jwt_utils import create_access_token, create_refresh_token, decode_token
from app.config import AUTH_COOKIE_SECURE, AUTH_COOKIE_SAMESITE, REFRESH_TOKEN_EXPIRE_DAYS
import jwt as pyjwt

from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _refresh_token_record(token: str, user_id: str) -> RefreshToken:
    decoded = decode_token(token)
    return RefreshToken(
        jti=decoded["jti"],
        user_id=user_id,
        expires_at=datetime.fromtimestamp(decoded["exp"], tz=timezone.utc),
    )


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    cookie_options = {
        "httponly": True,
        "secure": AUTH_COOKIE_SECURE,
        "samesite": AUTH_COOKIE_SAMESITE,
        "path": "/",
    }
    response.set_cookie("studybot_access_token", access_token, max_age=1800, **cookie_options)
    response.set_cookie(
        "studybot_refresh_token",
        refresh_token,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        **cookie_options,
    )


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: UserSignup, db: AsyncSession = Depends(get_db)):
    new_user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(new_user)

    try:
        await db.commit()
    except IntegrityError:
        # This fires if the email UNIQUE constraint is violated at the DB level —
        # this is the race-condition-safe check, not just an app-level lookup.
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    await db.refresh(new_user)
    return new_user


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    # Deliberately vague error message — don't reveal whether the email
    # exists or the password was wrong. Prevents attackers from using
    # this endpoint to enumerate registered emails.
    invalid_credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password.",
    )

    if user is None:
        raise invalid_credentials_error

    if not verify_password(payload.password, user.hashed_password):
        raise invalid_credentials_error

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    db.add(_refresh_token_record(refresh_token, str(user.id)))
    await db.commit()
    _set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    response: Response,
    refresh_cookie: str | None = Cookie(default=None, alias="studybot_refresh_token"),
    db: AsyncSession = Depends(get_db),
):
    refresh_token = payload.refresh_token or refresh_cookie
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token is required.")

    try:
        decoded = decode_token(refresh_token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired. Please log in again.")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")

    # Enforce that only an actual refresh token can be used here —
    # blocks someone from reusing an access token in this endpoint.
    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type.")

    user_id = decoded["sub"]
    jti = decoded.get("jti")
    if not jti:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")

    result = await db.execute(select(User).where(User.id == user_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")

    token_result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.jti == jti,
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    stored_token = token_result.scalar_one_or_none()
    if stored_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has already been used.")

    new_access_token = create_access_token(user_id)
    new_refresh_token = create_refresh_token(user_id)
    stored_token.revoked_at = datetime.now(timezone.utc)
    db.add(_refresh_token_record(new_refresh_token, user_id))
    await db.commit()
    _set_auth_cookies(response, new_access_token, new_refresh_token)

    return TokenResponse(access_token=new_access_token, refresh_token=new_refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: LogoutRequest,
    response: Response,
    refresh_cookie: str | None = Cookie(default=None, alias="studybot_refresh_token"),
    db: AsyncSession = Depends(get_db),
):
    refresh_token = payload.refresh_token or refresh_cookie
    if refresh_token:
        try:
            decoded = decode_token(refresh_token)
            jti = decoded.get("jti")
            if jti:
                result = await db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
                stored_token = result.scalar_one_or_none()
                if stored_token is not None and stored_token.revoked_at is None:
                    stored_token.revoked_at = datetime.now(timezone.utc)
                    await db.commit()
        except pyjwt.InvalidTokenError:
            pass

    response.delete_cookie("studybot_access_token", path="/")
    response.delete_cookie("studybot_refresh_token", path="/")


@router.get("/me", response_model=UserResponse)
async def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_name(
    payload: UpdateNameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.full_name = payload.full_name
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect.",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password is incorrect.",
        )

    # Clean up storage files BEFORE deleting the user row — once the user
    # row is gone, Document rows cascade-delete automatically (FK
    # ondelete="CASCADE"), and we'd lose the storage_path values needed
    # to clean up the actual files in Supabase.
    result = await db.execute(select(Document).where(Document.owner_id == current_user.id))
    documents = result.scalars().all()
    for document in documents:
        try:
            await asyncio.to_thread(delete_file, document.storage_path)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not remove all stored documents. Account deletion was not completed.",
            )

    await db.delete(current_user)  # documents + chunks cascade automatically
    await db.commit()