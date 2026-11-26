from datetime import datetime
import re
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

SUPPORTED_LANG_PATTERN = r"^(en|bn|zh|fr|es|ru|ar|de)$"


def _validate_strong_password(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must include at least one uppercase letter.")
    if not re.search(r"[a-z]", v):
        raise ValueError("Password must include at least one lowercase letter.")
    if not re.search(r"\d", v):
        raise ValueError("Password must include at least one numeric digit.")
    if not re.search(r"[^A-Za-z0-9]", v):
        raise ValueError("Password must include at least one special character.")
    return v


# ---------- Auth & Users ----------
class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    phone_number: Optional[str] = Field(default=None, max_length=32)
    country: str = Field(default="Bangladesh", min_length=2, max_length=80)
    preferred_language: str = Field(default="en", pattern=SUPPORTED_LANG_PATTERN)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: Optional[str] = Field(default=None, min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        return _validate_strong_password(v)


class VerifySignupOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendSignupOTPRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: Optional[str] = Field(default=None, min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def check_new_password_strength(cls, v: str) -> str:
        return _validate_strong_password(v)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: Optional[str] = Field(default=None, min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def check_change_password_strength(cls, v: str) -> str:
        return _validate_strong_password(v)


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    phone_number: Optional[str] = Field(default=None, max_length=32)
    country: Optional[str] = Field(default=None, min_length=2, max_length=80)
    preferred_language: Optional[str] = Field(default=None, pattern=SUPPORTED_LANG_PATTERN)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)
    remember_me: bool = False
    mfa_code: Optional[str] = Field(default=None, max_length=10)
    device_name: Optional[str] = Field(default="Web Browser", max_length=120)
    device_fingerprint: Optional[str] = Field(default=None, max_length=128)


class ReauthRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)


class UserOut(BaseModel):
    id: int
    user_code: str
    full_name: str
    email: str
    phone_number: Optional[str] = None
    country: str = "Bangladesh"
    preferred_language: str = "en"
    role: str
    status: str
    email_verified: bool = True
    mfa_enabled: bool
    connected_accounts_count: int = 0
    created_at: datetime
    last_login_at: Optional[datetime] = None


class UserRoleStatusUpdate(BaseModel):
    role: Optional[str] = Field(default=None, pattern="^(user|analyst|admin)$")
    status: Optional[str] = Field(default=None, pattern="^(active|suspended|locked)$")


class MFAConfirmRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=8)


# ---------- Connectors ----------
class ConnectorActionRequest(BaseModel):
    masked_account: Optional[str] = Field(default=None, max_length=32)
    is_sandbox: bool = True


# ---------- Transactions ----------
class TransactionCreateRequest(BaseModel):
    amount: float = Field(..., gt=0, le=100_000_000)
    currency: str = Field(default="BDT", max_length=12)
    tx_type: str = Field(default="Transfer", max_length=48)
    recipient_name: str = Field(..., min_length=2, max_length=120)
    recipient_account: str = Field(..., min_length=4, max_length=64)
    source_institution: str = Field(..., min_length=2, max_length=120)
    dest_institution: Optional[str] = Field(default=None, max_length=120)
    ip_address: Optional[str] = Field(default="103.21.244.0", max_length=64)
    location_label: Optional[str] = Field(default="Dhaka, Bangladesh", max_length=160)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    simulated_risk_score: Optional[float] = Field(default=None, ge=0, le=100)


class HumanDecisionRequest(BaseModel):
    decision: str = Field(..., pattern="^(Approved|Confirmed Fraud|Escalated|Approved by User|Rejected by User)$")
    notes: Optional[str] = Field(default=None, max_length=500)


class TierDecisionRequest(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|NOT_APPROVE|CONFIRM_ALERT)$")
    notes: Optional[str] = Field(default=None, max_length=500)


class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)


# ---------- Devices ----------
class DeviceTrustUpdateRequest(BaseModel):
    trust_status: str = Field(..., pattern="^(trusted|unverified|suspicious|blocked)$")


# ---------- Security Policies ----------
class SecurityPolicyUpdateRequest(BaseModel):
    mfa_required: Optional[bool] = None
    max_login_attempts: Optional[int] = Field(default=None, ge=3, le=15)
    lockout_minutes: Optional[int] = Field(default=None, ge=5, le=120)
    session_timeout_minutes: Optional[int] = Field(default=None, ge=5, le=240)
    login_alerts_enabled: Optional[bool] = None
    new_device_alerts_enabled: Optional[bool] = None
    high_risk_threshold: Optional[int] = Field(default=None, ge=40, le=95)


# ---------- Sessions ----------
class SessionRevokeRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)


# ---------- Alerts & Notifications ----------
class AlertStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(open|acknowledged|resolved)$")


class NotificationPreferenceUpdate(BaseModel):
    fraud_alerts: Optional[bool] = None
    critical_risk: Optional[bool] = None
    new_device_login: Optional[bool] = None
    account_connections: Optional[bool] = None
    suspicious_login: Optional[bool] = None
    tx_review: Optional[bool] = None
    email_notifications: Optional[bool] = None
