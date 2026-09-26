import uuid

import jwt as pyjwt
from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.jwt_utils import decode_token

# HTTPBearer reads the "Authorization: Bearer <token>" header automatically
# and shows a nice "Authorize" button in Swagger UI (/docs) for testing.
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    access_token: str | None = Cookie(default=None, alias="studybot_access_token"),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials if credentials else access_token
    if not token:
        raise credentials_error

    try:
        payload = decode_token(token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except pyjwt.InvalidTokenError:
        raise credentials_error

    # Reject a refresh token being used where an access token is required —
    # same principle as the check in the /refresh endpoint, mirrored here.
    if payload.get("type") != "access":
        raise credentials_error

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_error

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise credentials_error

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        # Token is validly signed, but the user no longer exists
        # (e.g., deleted account). Must not proceed as if authenticated.
        raise credentials_error

    return user