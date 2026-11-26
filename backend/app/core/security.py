import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings

settings = get_settings()

# Argon2id password hasher (OWASP recommended parameters)
_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(plain_password: str) -> str:
    """Hash a password using Argon2id."""
    return _ph.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its Argon2id hash."""
    try:
        return _ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError):
        return False


def _get_fernet() -> Fernet:
    """Derive a valid 32-byte URL-safe Fernet key from configuration."""
    raw = settings.ENCRYPTION_KEY.strip()
    if raw:
        try:
            key_bytes = raw.encode("utf-8")
            Fernet(key_bytes)
            return Fernet(key_bytes)
        except Exception:
            pass
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_sensitive(value: str) -> str:
    """Encrypt sensitive fields at rest (e.g., MFA TOTP secrets)."""
    if not value:
        return ""
    return _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_sensitive(token: str) -> str:
    """Decrypt sensitive fields stored at rest."""
    if not token:
        return ""
    try:
        return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=email,
        issuer_name="FinSphere FraudShield",
    )


def verify_totp_code(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(code.strip(), valid_window=1)


def create_access_token(
    user_id: int,
    role: str,
    session_jti: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "jti": session_jti,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def create_refresh_token(user_id: int, session_jti: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "jti": session_jti,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def mask_account(value: Optional[str]) -> str:
    """Mask bank/MFS account identifiers so only the last 4 chars remain visible."""
    if not value:
        return "Not Available"
    cleaned = value.strip()
    if len(cleaned) <= 4:
        return "*" * len(cleaned)
    return "*" * (len(cleaned) - 4) + cleaned[-4:]


def generate_numeric_otp(length: int = 6) -> str:
    """Generate a cryptographically secure numeric OTP using Python secrets."""
    return f"{secrets.randbelow(10 ** length):0{length}d}"


def hash_otp(email: str, otp_code: str) -> str:
    """Compute keyed HMAC-SHA256 hash of a signup OTP bound to the email."""
    msg = f"{email.strip().lower()}:{otp_code.strip()}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def verify_otp_hash(email: str, otp_code: str, stored_hash: str) -> bool:
    """Constant-time verification of a hashed signup OTP."""
    if not otp_code or not stored_hash:
        return False
    expected = hash_otp(email, otp_code)
    return hmac.compare_digest(expected, stored_hash)
