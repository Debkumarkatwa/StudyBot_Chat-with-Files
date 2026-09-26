import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserSignup(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, min_length=3, max_length=15)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().casefold()


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().casefold()


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    created_at: datetime

    class Config:
        from_attributes = True  # lets this build directly from a SQLAlchemy User object


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class UpdateNameRequest(BaseModel):
    full_name: str = Field(min_length=3, max_length=15)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None