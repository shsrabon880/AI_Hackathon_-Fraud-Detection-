from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, verify_csrf_if_cookie_auth, write_audit_log
from app.db.database import get_db
from app.models.models import SecurityPolicy, User
from app.schemas.schemas import SecurityPolicyUpdateRequest

router = APIRouter(prefix="/policies", tags=["Security Policies"])


def _get_or_create_policy(db: Session, user_id: int) -> SecurityPolicy:
    policy = db.query(SecurityPolicy).filter(SecurityPolicy.user_id == user_id).first()
    if not policy:
        policy = SecurityPolicy(user_id=user_id)
        db.add(policy)
        db.commit()
        db.refresh(policy)
    return policy


def _serialize_policy(p: SecurityPolicy, user: User) -> dict:
    return {
        "mfa_required": p.mfa_required,
        "mfa_configured": user.mfa_enabled,
        "max_login_attempts": p.max_login_attempts,
        "lockout_minutes": p.lockout_minutes,
        "session_timeout_minutes": p.session_timeout_minutes,
        "login_alerts_enabled": p.login_alerts_enabled,
        "new_device_alerts_enabled": p.new_device_alerts_enabled,
        "high_risk_threshold": p.high_risk_threshold,
        "csrf_protection_enabled": p.csrf_protection_enabled,
        "strict_owner_isolation": p.strict_owner_isolation,
        "updated_at": p.updated_at,
        "enforced_controls": [
            {"name": "Password Hashing", "detail": "Argon2id (memory-hard, OWASP compliant)", "active": True},
            {"name": "Session Architecture", "detail": "JWT + HttpOnly Cookies + DB Revocation Store", "active": True},
            {"name": "CSRF & XSS Guard", "detail": "Double-submit X-CSRF-Token + CSP & Security Headers", "active": True},
            {"name": "SQL Injection Defense", "detail": "Parameterized SQLAlchemy ORM queries only", "active": True},
            {"name": "API Rate Limiting", "detail": "Sliding-window brute-force & login throttling", "active": True},
            {"name": "Owner Isolation (RBAC)", "detail": "Strict backend user_id scoping on every financial endpoint", "active": True},
        ],
    }


@router.get("")
def get_policies(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    policy = _get_or_create_policy(db, user.id)
    return _serialize_policy(policy, user)


@router.put("")
def update_policies(
    payload: SecurityPolicyUpdateRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    policy = _get_or_create_policy(db, user.id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(policy, field, value)
    db.commit()
    db.refresh(policy)
    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="SECURITY_POLICY_UPDATED",
        resource_type="security_policy",
        resource_id=str(policy.id),
        details=payload.model_dump(exclude_none=True),
    )
    return _serialize_policy(policy, user)
