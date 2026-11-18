import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import (
    check_rate_limit,
    get_current_session_and_user,
    get_current_user,
    verify_csrf_if_cookie_auth,
    write_audit_log,
)
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    decrypt_sensitive,
    encrypt_sensitive,
    generate_csrf_token,
    generate_totp_secret,
    get_totp_uri,
    hash_password,
    verify_password,
    verify_totp_code,
)
from app.db.database import get_db
from app.db.seed import ensure_user_connectors
from app.models.models import Connector, Device, SecurityPolicy, User, UserSession
from app.schemas.schemas import (
    MFAConfirmRequest,
    UserLoginRequest,
    UserOut,
    UserRegisterRequest,
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
        role=user.role,
        status=user.status,
        mfa_enabled=user.mfa_enabled,
        connected_accounts_count=conn_count,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegisterRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_rate_limit(f"register:{client_ip}", max_requests=10, window_seconds=60)

    email_norm = payload.email.strip().lower()
    if db.query(User).filter(User.email == email_norm).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    next_num = 1001 + db.query(User).count()
    user = User(
        user_code=f"USR-{next_num}",
        full_name=payload.full_name.strip(),
        email=email_norm,
        password_hash=hash_password(payload.password),
        role="user",
        status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(SecurityPolicy(user_id=user.id))
    db.commit()
    ensure_user_connectors(db, user.id, connect_defaults=False)

    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="USER_REGISTERED",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=client_ip,
    )
    return _serialize_user(db, user)


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
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    response.set_cookie(
        key="fs_csrf_token",
        value=csrf_token,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
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
