from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles, verify_csrf_if_cookie_auth, write_audit_log
from app.db.database import get_db
from app.models.models import Connector, SecurityAlert, User
from app.schemas.schemas import UserRoleStatusUpdate

router = APIRouter(prefix="/users", tags=["System Users"])


def _serialize(db: Session, u: User) -> dict:
    connected = (
        db.query(Connector)
        .filter(Connector.user_id == u.id, Connector.connection_status == "Connected")
        .count()
    )
    open_alerts = (
        db.query(SecurityAlert)
        .filter(SecurityAlert.user_id == u.id, SecurityAlert.status == "open")
        .count()
    )
    return {
        "id": u.id,
        "user_code": u.user_code,
        "full_name": u.full_name,
        "email": u.email,
        "role": u.role,
        "status": u.status,
        "mfa_enabled": u.mfa_enabled,
        "connected_accounts_count": connected,
        "security_status": "Protected (MFA Active)" if u.mfa_enabled else ("Attention Needed" if open_alerts > 0 else "Standard Protection"),
        "open_alerts_count": open_alerts,
        "permissions": ["read:own_data", "manage:own_connectors", "upload:statements"] + (["admin:manage_users", "analyst:review_flags"] if u.role == "admin" else []),
        "created_at": u.created_at,
        "last_login_at": u.last_login_at,
    }


@router.get("")
def list_system_users(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Admins see all system users; standard users only see their own profile (strict isolation)."""
    if user.role == "admin":
        users = db.query(User).order_by(User.id.asc()).all()
    else:
        users = [user]
    return {"items": [_serialize(db, u) for u in users], "is_admin_view": user.role == "admin"}


@router.patch("/{user_id}")
def update_user_role_or_status(
    user_id: int,
    payload: UserRoleStatusUpdate,
    admin: User = Depends(require_roles("admin")),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if payload.role:
        target.role = payload.role
    if payload.status:
        target.status = payload.status
    db.commit()
    write_audit_log(
        db,
        user_id=admin.id,
        actor_email=admin.email,
        action="USER_UPDATED",
        resource_type="user",
        resource_id=str(target.id),
        details={"role": target.role, "status": target.status},
    )
    return _serialize(db, target)
