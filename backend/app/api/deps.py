import json
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.database import get_db
from app.models.models import AuditLog, User, UserSession


# In-memory sliding window rate limiter (production upgrade path: Redis)
_rate_buckets: Dict[str, List[float]] = defaultdict(list)


def check_rate_limit(key: str, max_requests: int, window_seconds: int = 60) -> None:
    now = time.time()
    bucket = _rate_buckets[key]
    _rate_buckets[key] = [ts for ts in bucket if now - ts < window_seconds]
    if len(_rate_buckets[key]) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment and try again.",
        )
    _rate_buckets[key].append(now)


def write_audit_log(
    db: Session,
    *,
    user_id: Optional[int],
    actor_email: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    ip_address: str = "127.0.0.1",
    log_status: str = "success",
    details: Optional[dict] = None,
) -> None:
    entry = AuditLog(
        user_id=user_id,
        actor_email=actor_email,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        ip_address=ip_address,
        status=log_status,
        details_json=json.dumps(details or {}),
    )
    db.add(entry)
    db.commit()


def verify_csrf_if_cookie_auth(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    csrf_cookie: Optional[str] = Cookie(default=None, alias="fs_csrf_token"),
    x_csrf_token: Optional[str] = Header(default=None, alias="X-CSRF-Token"),
) -> None:
    """
    Enforce double-submit CSRF validation on state-changing requests when using
    cookie-based auth. Bearer header clients are immune to browser CSRF.
    """
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    if authorization and authorization.startswith("Bearer "):
        return
    if csrf_cookie and x_csrf_token and csrf_cookie == x_csrf_token:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="CSRF validation failed.",
    )


def get_current_session_and_user(
    request: Request,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
    access_cookie: Optional[str] = Cookie(default=None, alias="fs_access_token"),
):
    """Extract and validate JWT + active DB session to guarantee instant revocation."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif access_cookie:
        token = access_cookie

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        )

    user_id = int(payload["sub"])
    jti = payload.get("jti")
    session = (
        db.query(UserSession)
        .filter(UserSession.session_token_jti == jti, UserSession.user_id == user_id)
        .first()
    )
    if not session or session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked or expired.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or locked.",
        )

    session.last_active_at = datetime.now(timezone.utc)
    db.commit()
    return user, session


def get_current_user(
    pair=Depends(get_current_session_and_user),
) -> User:
    return pair[0]


def require_roles(*allowed_roles: str):
    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this action.",
            )
        return user

    return _checker
