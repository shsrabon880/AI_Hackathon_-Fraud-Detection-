from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field


# ---------- Auth & Users ----------
class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)
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
    role: str
    status: str
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


# ---------- Alerts ----------
class AlertStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(open|acknowledged|resolved)$")
