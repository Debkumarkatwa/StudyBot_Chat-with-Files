import os
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY not found. Check your .env file.")

ALGORITHM = "HS256"

# Short-lived: limits damage window if a token is ever stolen
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Long-lived: lets the user stay logged in without re-entering credentials often
REFRESH_TOKEN_EXPIRE_DAYS = 7


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,   # "sub" (subject) is the JWT-standard field for "who this token belongs to"
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Verify and decode a token. Raises jwt.ExpiredSignatureError if expired,
    or jwt.InvalidTokenError if the signature/format is invalid.
    Caller (the FastAPI dependency) is responsible for catching these
    and turning them into proper 401 responses.
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload