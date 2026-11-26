import re
import secrets
from datetime import datetime, timedelta, timezone

import dns.exception
import dns.resolver
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import (
    check_rate_limit,
    get_current_session_and_user,
    get_current_user,
    verify_csrf_if_cookie_auth,
    write_audit_log,
)
from app.api.v1.notifications import emit_notification
from app.core.config import get_settings
from app.core.email_service import (
    EmailDeliveryError,
    send_password_reset_otp_email,
    send_signup_otp_email,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    decrypt_sensitive,
    encrypt_sensitive,
    generate_csrf_token,
    generate_numeric_otp,
    generate_totp_secret,
    get_totp_uri,
    hash_otp,
    hash_password,
    verify_otp_hash,
    verify_password,
    verify_totp_code,
)
from app.db.database import get_db
from app.db.seed import ensure_user_connectors
from app.models.models import (
    Connector,
    Device,
    PasswordResetOTP,
    SecurityPolicy,
    SignupEmailOTP,
    User,
    UserSession,
)
from app.schemas.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    MFAConfirmRequest,
    ProfileUpdateRequest,
    ReauthRequest,
    ResendSignupOTPRequest,
    ResetPasswordRequest,
    UserLoginRequest,
    UserOut,
    UserRegisterRequest,
    VerifySignupOTPRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


def _parse_user_agent(ua: str) -> tuple[str, str]:
    lower = (ua or "").lower()
    os_name = "Windows" if "windows" in lower else ("macOS" if "mac os" in lower else ("Linux" if "linux" in lower else ("Android" if "android" in lower else "Unknown OS")))
    browser = "Edge" if "edg" in lower else ("Chrome" if "chrome" in lower else ("Firefox" if "firefox" in lower else ("Safari" if "safari" in lower else "API Client")))
    return browser, os_name


def _serialize_user(db: Session, user: User) -> UserOut:
    conn_count = (
        db.query(Connector)
        .filter(Connector.user_id == user.id, Connector.connection_status == "Connected")
        .count()
    )
    return UserOut(
        id=user.id,
        user_code=user.user_code,
        full_name=user.full_name,
        email=user.email,
        phone_number=getattr(user, "phone_number", None),
        country=getattr(user, "country", "Bangladesh"),
        preferred_language=getattr(user, "preferred_language", "en"),
        role=user.role,
        status=user.status,
        email_verified=bool(getattr(user, "email_verified", True)),
        mfa_enabled=user.mfa_enabled,
        connected_accounts_count=conn_count,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


def _normalize_phone(raw: str | None) -> str | None:
    if not raw or not raw.strip():
        return None
    cleaned = re.sub(r"[\s\-()]", "", raw.strip())
    if not re.match(r"^(\+?\d{8,15}|01[3-9]\d{8})$", cleaned):
        raise HTTPException(
            status_code=400,
            detail="Invalid phone number format. Use local 01XXXXXXXXX or international +8801XXXXXXXXX format.",
        )
    return cleaned


DISPOSABLE_DOMAINS = {
    "mailinator.com",
    "tempmail.com",
    "10minutemail.com",
    "guerrillamail.com",
    "yopmail.com",
    "throwawaymail.com",
    "fakeinbox.com",
    "example.com",
    "test.com",
}


def _validate_email_domain_mx(email: str) -> None:
    """Verify the email domain is not disposable and has a valid DNS MX mail server."""
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address format.")
    domain = email.split("@", 1)[1].strip().lower()
    if domain in DISPOSABLE_DOMAINS:
        raise HTTPException(
            status_code=400,
            detail=f"Disposable or test email domain '{domain}' is not allowed. Please use a real email address.",
        )
    if domain == "finsphere.ai":
        return
    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=3.0)
        if not answers:
            raise HTTPException(
                status_code=400,
                detail=f"Email domain '{domain}' has no active mail server (MX record). Please use a real email.",
            )
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers, dns.exception.Timeout):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid or unreachable email domain '{domain}'. Please use a real email address (e.g., Gmail, Outlook).",
        )


def _issue_and_send_signup_otp(db: Session, user: User) -> tuple[int, int]:
    """Generate a single-use 6-digit signup OTP, persist its hash, and email it."""
    now = datetime.now(timezone.utc)
    # Mark any prior unused OTPs for this user as invalidated so only the newest code works
    db.query(SignupEmailOTP).filter(
        SignupEmailOTP.user_id == user.id,
        SignupEmailOTP.used_at.is_(None),
    ).update({"used_at": now})

    otp_code = generate_numeric_otp(6)
    expires_in = settings.EMAIL_OTP_EXPIRE_SECONDS
    cooldown = settings.EMAIL_OTP_RESEND_COOLDOWN_SECONDS
    otp_row = SignupEmailOTP(
        user_id=user.id,
        email=user.email,
        otp_hash=hash_otp(user.email, otp_code),
        expires_at=now + timedelta(seconds=expires_in),
        resend_available_at=now + timedelta(seconds=cooldown),
        attempts_count=0,
        max_attempts=settings.EMAIL_OTP_MAX_ATTEMPTS,
    )
    db.add(otp_row)
    db.commit()

    try:
        send_signup_otp_email(user.email, user.full_name, otp_code)
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return expires_in, cooldown


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: UserRegisterRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_rate_limit(f"register:{client_ip}", max_requests=10, window_seconds=60)

    if payload.confirm_password is not None and payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Password and Confirm Password do not match.")

    email_norm = payload.email.strip().lower()
    _validate_email_domain_mx(email_norm)
    phone_norm = _normalize_phone(payload.phone_number)
    if db.query(User).filter(User.email == email_norm).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    next_num = 1001 + db.query(User).count()
    user = User(
        user_code=f"USR-{next_num}",
        full_name=payload.full_name.strip(),
        email=email_norm,
        phone_number=phone_norm,
        country=payload.country.strip(),
        preferred_language=payload.preferred_language,
        password_hash=hash_password(payload.password),
        role="user",
        status="pending_verification",
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(SecurityPolicy(user_id=user.id))
    db.commit()
    ensure_user_connectors(db, user.id, connect_defaults=False)

    try:
        expires_in, cooldown = _issue_and_send_signup_otp(db, user)
    except HTTPException:
        # Roll back unverified account if email provider failed so user can retry cleanly
        db.delete(user)
        db.commit()
        raise

    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="USER_REGISTERED_PENDING_OTP",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=client_ip,
    )
    return {
        "message": "Verification OTP sent to your email. Please enter the 6-digit code within 5 minutes.",
        "verification_required": True,
        "email": user.email,
        "expires_in_seconds": expires_in,
        "resend_cooldown_seconds": cooldown,
        "user": _serialize_user(db, user),
    }


@router.post("/verify-signup-otp")
def verify_signup_otp(payload: VerifySignupOTPRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    email_norm = payload.email.strip().lower()
    check_rate_limit(f"verify_otp:{client_ip}:{email_norm}", max_requests=15, window_seconds=60)

    user = db.query(User).filter(User.email == email_norm).first()
    if not user:
        raise HTTPException(status_code=404, detail="No registration found for this email address.")
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified. Please sign in.")

    otp_row = (
        db.query(SignupEmailOTP)
        .filter(SignupEmailOTP.user_id == user.id)
        .order_by(SignupEmailOTP.id.desc())
        .first()
    )
    if not otp_row or otp_row.used_at is not None:
        raise HTTPException(status_code=400, detail="Verification code already used or invalid. Please request a new OTP.")

    now = datetime.now(timezone.utc)
    expires_at = otp_row.expires_at if otp_row.expires_at.tzinfo else otp_row.expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please click Resend OTP.")

    if otp_row.attempts_count >= otp_row.max_attempts:
        raise HTTPException(
            status_code=429,
            detail="Maximum 5 incorrect verification attempts reached. Please request a new OTP.",
        )

    if not verify_otp_hash(email_norm, payload.otp, otp_row.otp_hash):
        otp_row.attempts_count += 1
        db.commit()
        remaining = max(0, otp_row.max_attempts - otp_row.attempts_count)
        write_audit_log(
            db,
            user_id=user.id,
            actor_email=user.email,
            action="SIGNUP_OTP_FAILED",
            resource_type="auth",
            ip_address=client_ip,
            log_status="failed",
            details={"attempts_count": otp_row.attempts_count},
        )
        if remaining == 0:
            raise HTTPException(
                status_code=429,
                detail="Maximum 5 incorrect verification attempts reached. Please request a new OTP.",
            )
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect verification code. {remaining} attempt(s) remaining.",
        )

    otp_row.used_at = now
    user.email_verified = True
    user.status = "active"
    db.commit()

    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="SIGNUP_EMAIL_VERIFIED",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=client_ip,
    )
    return {
        "verified": True,
        "email": user.email,
        "message": "Email verified and account activated. You can now sign in.",
    }


@router.post("/resend-signup-otp")
def resend_signup_otp(payload: ResendSignupOTPRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    email_norm = payload.email.strip().lower()
    check_rate_limit(f"resend_otp:{client_ip}:{email_norm}", max_requests=6, window_seconds=60)

    user = db.query(User).filter(User.email == email_norm).first()
    if not user:
        raise HTTPException(status_code=404, detail="No registration found for this email address.")
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified. Please sign in.")

    now = datetime.now(timezone.utc)
    latest = (
        db.query(SignupEmailOTP)
        .filter(SignupEmailOTP.user_id == user.id)
        .order_by(SignupEmailOTP.id.desc())
        .first()
    )
    if latest:
        avail = (
            latest.resend_available_at
            if latest.resend_available_at.tzinfo
            else latest.resend_available_at.replace(tzinfo=timezone.utc)
        )
        if avail > now:
            wait_secs = int((avail - now).total_seconds()) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {wait_secs}s before requesting another verification code.",
            )

    expires_in, cooldown = _issue_and_send_signup_otp(db, user)
    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="SIGNUP_OTP_RESENT",
        resource_type="auth",
        ip_address=client_ip,
    )
    return {
        "message": "A new 6-digit verification code has been sent to your email.",
        "email": user.email,
        "expires_in_seconds": expires_in,
        "resend_cooldown_seconds": cooldown,
    }


@router.post("/login")
def login(
    payload: UserLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_rate_limit(f"login:{client_ip}", max_requests=settings.LOGIN_RATE_LIMIT_PER_MIN, window_seconds=60)

    email_norm = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email_norm).first()
    if not user:
        write_audit_log(
            db,
            user_id=None,
            actor_email=email_norm,
            action="LOGIN_FAILED",
            resource_type="auth",
            ip_address=client_ip,
            log_status="failed",
            details={"reason": "unknown_email"},
        )
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    now = datetime.now(timezone.utc)
    if user.locked_until:
        locked_until = user.locked_until if user.locked_until.tzinfo else user.locked_until.replace(tzinfo=timezone.utc)
        if locked_until > now:
            raise HTTPException(
                status_code=423,
                detail="Account temporarily locked due to multiple failed login attempts.",
            )
        user.locked_until = None
        user.failed_login_attempts = 0

    policy = db.query(SecurityPolicy).filter(SecurityPolicy.user_id == user.id).first()
    max_attempts = policy.max_login_attempts if policy else 5
    lock_mins = policy.lockout_minutes if policy else 15

    if not verify_password(payload.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= max_attempts:
            user.locked_until = now + timedelta(minutes=lock_mins)
        db.commit()
        write_audit_log(
            db,
            user_id=user.id,
            actor_email=user.email,
            action="LOGIN_FAILED",
            resource_type="auth",
            ip_address=client_ip,
            log_status="failed",
            details={"attempts": user.failed_login_attempts},
        )
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not getattr(user, "email_verified", True):
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Please complete Sign Up email OTP verification before signing in.",
        )

    if user.status != "active":
        raise HTTPException(status_code=403, detail=f"Account is {user.status}.")

    if user.mfa_enabled:
        secret = decrypt_sensitive(user.mfa_secret_encrypted or "")
        if not payload.mfa_code:
            return {"mfa_required": True, "message": "Enter your 6-digit authenticator MFA code."}
        if not verify_totp_code(secret, payload.mfa_code):
            raise HTTPException(status_code=401, detail="Invalid MFA verification code.")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now

    ua = request.headers.get("user-agent", "Unknown")
    browser, os_name = _parse_user_agent(ua)
    fp = payload.device_fingerprint or f"fp_{abs(hash((user.id, browser, os_name))) % 999999}"
    device = (
        db.query(Device)
        .filter(Device.user_id == user.id, Device.device_fingerprint == fp)
        .first()
    )
    if not device:
        device = Device(
            user_id=user.id,
            device_fingerprint=fp,
            device_name=payload.device_name or f"{os_name} {browser}",
            device_model="Web Client",
            os=os_name,
            browser=browser,
            ip_address=client_ip,
            approx_location="Localhost / Development" if client_ip in ("127.0.0.1", "::1", "testclient") else "IP Approximate",
            trust_status="trusted" if client_ip in ("127.0.0.1", "::1", "testclient") else "unverified",
            risk_score=10.0,
            is_new_device=True,
        )
        db.add(device)
        db.commit()
        db.refresh(device)
        emit_notification(
            db,
            user_id=user.id,
            category="new_device",
            severity="warning",
            title="New Device Sign-In Detected",
            message=f"Signed in from {os_name} ({browser}) via IP {client_ip}.",
        )
    else:
        device.last_active_at = now
        device.ip_address = client_ip
        db.commit()

    jti = secrets.token_hex(24)
    session = UserSession(
        user_id=user.id,
        session_token_jti=jti,
        device_id=device.id,
        device_label=device.device_name,
        browser=browser,
        os=os_name,
        ip_address=client_ip,
        approx_location=device.approx_location,
        status="active",
        login_at=now,
        last_active_at=now,
    )
    db.add(session)
    db.commit()

    access_token = create_access_token(user.id, user.role, jti)
    refresh_days = 30 if payload.remember_me else settings.REFRESH_TOKEN_EXPIRE_DAYS
    refresh_token = create_refresh_token(user.id, jti)
    csrf_token = generate_csrf_token()

    response.set_cookie(
        key="fs_access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="fs_refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=refresh_days * 86400,
    )
    response.set_cookie(
        key="fs_csrf_token",
        value=csrf_token,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=refresh_days * 86400,
    )

    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="LOGIN_SUCCESS",
        resource_type="session",
        resource_id=str(session.id),
        ip_address=client_ip,
    )

    return {
        "mfa_required": False,
        "access_token": access_token,
        "csrf_token": csrf_token,
        "token_type": "bearer",
        "user": _serialize_user(db, user),
    }


@router.post("/refresh")
def refresh_access_token(
    response: Response,
    refresh_cookie: str | None = Cookie(default=None, alias="fs_refresh_token"),
    db: Session = Depends(get_db),
):
    if not refresh_cookie:
        raise HTTPException(status_code=401, detail="Refresh token missing.")
    payload = decode_token(refresh_cookie)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")
    user_id = int(payload["sub"])
    jti = payload.get("jti")
    session = (
        db.query(UserSession)
        .filter(UserSession.session_token_jti == jti, UserSession.user_id == user_id, UserSession.status == "active")
        .first()
    )
    user = db.query(User).filter(User.id == user_id, User.status == "active").first()
    if not session or not user:
        raise HTTPException(status_code=401, detail="Session revoked or user inactive.")

    new_access = create_access_token(user.id, user.role, jti)
    response.set_cookie(
        key="fs_access_token",
        value=new_access,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return {"access_token": new_access, "token_type": "bearer"}


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    pair=Depends(get_current_session_and_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    user, session = pair
    session.status = "revoked"
    session.revoked_at = datetime.now(timezone.utc)
    db.commit()

    response.delete_cookie("fs_access_token")
    response.delete_cookie("fs_refresh_token")
    response.delete_cookie("fs_csrf_token")

    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="LOGOUT",
        resource_type="session",
        resource_id=str(session.id),
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return {"message": "Logged out securely."}


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _serialize_user(db, user)


@router.post("/mfa/setup")
def mfa_setup(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    secret = generate_totp_secret()
    user.mfa_secret_encrypted = encrypt_sensitive(secret)
    db.commit()
    return {
        "secret": secret,
        "otpauth_uri": get_totp_uri(secret, user.email),
        "note": "Scan or enter this secret in Google Authenticator / Authy, then verify with a 6-digit code.",
    }


@router.post("/mfa/enable")
def mfa_enable(
    payload: MFAConfirmRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    secret = decrypt_sensitive(user.mfa_secret_encrypted or "")
    if not secret or not verify_totp_code(secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid authenticator code.")
    user.mfa_enabled = True
    policy = db.query(SecurityPolicy).filter(SecurityPolicy.user_id == user.id).first()
    if policy:
        policy.mfa_required = True
    db.commit()
    write_audit_log(db, user_id=user.id, actor_email=user.email, action="MFA_ENABLED", resource_type="user", resource_id=str(user.id))
    return {"mfa_enabled": True, "message": "Multi-Factor Authentication enabled."}


@router.post("/mfa/disable")
def mfa_disable(
    payload: MFAConfirmRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    secret = decrypt_sensitive(user.mfa_secret_encrypted or "")
    if user.mfa_enabled and not verify_totp_code(secret, payload.code):
        raise HTTPException(status_code=400, detail="Valid MFA code required to disable MFA.")
    user.mfa_enabled = False
    policy = db.query(SecurityPolicy).filter(SecurityPolicy.user_id == user.id).first()
    if policy:
        policy.mfa_required = False
    db.commit()
    write_audit_log(db, user_id=user.id, actor_email=user.email, action="MFA_DISABLED", resource_type="user", resource_id=str(user.id))
    return {"mfa_enabled": False, "message": "Multi-Factor Authentication disabled."}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Issue a hashed 6-digit password reset OTP via email without leaking account existence."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    email_norm = payload.email.strip().lower()
    check_rate_limit(f"forgot_pw:{client_ip}:{email_norm}", max_requests=6, window_seconds=60)

    user = db.query(User).filter(User.email == email_norm).first()
    if user and user.email_verified:
        now = datetime.now(timezone.utc)
        db.query(PasswordResetOTP).filter(
            PasswordResetOTP.user_id == user.id,
            PasswordResetOTP.used_at.is_(None),
        ).update({"used_at": now})

        otp_code = generate_numeric_otp(6)
        reset_row = PasswordResetOTP(
            user_id=user.id,
            email=user.email,
            otp_hash=hash_otp(user.email, otp_code),
            expires_at=now + timedelta(seconds=settings.EMAIL_OTP_EXPIRE_SECONDS),
        )
        db.add(reset_row)
        db.commit()
        try:
            send_password_reset_otp_email(user.email, user.full_name, otp_code)
        except EmailDeliveryError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

        write_audit_log(db, user_id=user.id, actor_email=user.email, action="PASSWORD_RESET_OTP_SENT", resource_type="auth", ip_address=client_ip)

    return {"message": "If an active verified account exists for this email, a 6-digit reset OTP has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    email_norm = payload.email.strip().lower()
    check_rate_limit(f"reset_pw:{client_ip}:{email_norm}", max_requests=10, window_seconds=60)

    if payload.confirm_password is not None and payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirm password do not match.")

    user = db.query(User).filter(User.email == email_norm).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset code.")

    otp_row = (
        db.query(PasswordResetOTP)
        .filter(PasswordResetOTP.user_id == user.id)
        .order_by(PasswordResetOTP.id.desc())
        .first()
    )
    if not otp_row or otp_row.used_at is not None:
        raise HTTPException(status_code=400, detail="Reset code already used or invalid.")

    now = datetime.now(timezone.utc)
    expires_at = otp_row.expires_at if otp_row.expires_at.tzinfo else otp_row.expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")

    if otp_row.attempts_count >= settings.EMAIL_OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Maximum reset attempts reached. Request a new code.")

    if not verify_otp_hash(email_norm, payload.otp, otp_row.otp_hash):
        otp_row.attempts_count += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Incorrect password reset OTP.")

    otp_row.used_at = now
    user.password_hash = hash_password(payload.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    # Revoke active sessions when password is reset
    db.query(UserSession).filter(UserSession.user_id == user.id, UserSession.status == "active").update(
        {"status": "revoked", "revoked_at": now}
    )
    db.commit()

    write_audit_log(db, user_id=user.id, actor_email=user.email, action="PASSWORD_RESET_COMPLETED", resource_type="user", resource_id=str(user.id), ip_address=client_ip)
    return {"message": "Password reset successfully. Please sign in with your new password."}


@router.get("/profile", response_model=UserOut)
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _serialize_user(db, user)


@router.patch("/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.phone_number is not None:
        user.phone_number = _normalize_phone(payload.phone_number)
    if payload.country is not None:
        user.country = payload.country.strip()
    if payload.preferred_language is not None:
        user.preferred_language = payload.preferred_language
    db.commit()
    db.refresh(user)
    write_audit_log(db, user_id=user.id, actor_email=user.email, action="PROFILE_UPDATED", resource_type="user", resource_id=str(user.id))
    return _serialize_user(db, user)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=403, detail="Current password is incorrect.")
    if payload.confirm_password is not None and payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirm password do not match.")

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    write_audit_log(db, user_id=user.id, actor_email=user.email, action="PASSWORD_CHANGED", resource_type="user", resource_id=str(user.id))
    return {"message": "Password updated successfully."}


@router.delete("/account")
def delete_own_account(
    payload: ReauthRequest,
    response: Response,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=403, detail="Password verification failed.")
    actor_email = user.email
    uid = user.id
    write_audit_log(db, user_id=uid, actor_email=actor_email, action="ACCOUNT_DELETED", resource_type="user", resource_id=str(uid))
    db.delete(user)
    db.commit()
    response.delete_cookie("fs_access_token")
    response.delete_cookie("fs_refresh_token")
    response.delete_cookie("fs_csrf_token")
    return {"message": "Account and personal data deleted permanently."}
