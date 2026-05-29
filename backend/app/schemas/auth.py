"""Auth schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    username: str = Field(min_length=3, max_length=100)
    full_name: str | None = None


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserResponse | None" = None


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    username: str | None
    full_name: str | None
    avatar_url: str | None
    subscription_tier: str
    is_active: bool
    created_at: datetime
    phone_number: str | None = None

    model_config = {"from_attributes": True}


class GoogleAuthRequest(BaseModel):
    code: str
    code_verifier: str


class PhoneOTPRequest(BaseModel):
    phone_number: str


class PhoneOTPVerifyRequest(BaseModel):
    phone_number: str
    otp: str


class RecoverPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    password: str = Field(min_length=6, max_length=128)
