from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_session_and_user, verify_csrf_if_cookie_auth, write_audit_log
from app.core.security import verify_password
from app.db.database import get_db
from app.models.models import UserSession
from app.schemas.schemas import SessionRevokeRequest

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.get("")
def list_sessions(
    pair=Depends(get_current_session_and_user),
    db: Session = Depends(get_db),
):
    user, current_session = pair
    rows = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id)
        .order_by(UserSession.login_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": s.id,
                "session_id": f"SES-{s.id:04d}",
                "device": s.device_label,
                "browser": s.browser,
                "os": s.os,
                "ip_address": s.ip_address,
                "approx_location": s.approx_location,
                "login_at": s.login_at,
                "last_active_at": s.last_active_at,
                "status": s.status,
                "is_current": s.id == current_session.id,
            }
            for s in rows
        ]
    }


@router.post("/{session_id}/revoke")
def revoke_session(
    session_id: int,
    payload: SessionRevokeRequest,
    pair=Depends(get_current_session_and_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    user, _current = pair
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=403, detail="Re-authentication failed: invalid password.")

    target = (
        db.query(UserSession)
        .filter(UserSession.id == session_id, UserSession.user_id == user.id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Session not found.")
    target.status = "revoked"
    target.revoked_at = datetime.now(timezone.utc)
    db.commit()
    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="SESSION_REVOKED",
        resource_type="session",
        resource_id=str(session_id),
    )
    return {"message": "Session revoked.", "session_id": session_id}


@router.post("/revoke-others")
def revoke_other_sessions(
    payload: SessionRevokeRequest,
    pair=Depends(get_current_session_and_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    user, current_session = pair
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=403, detail="Re-authentication failed: invalid password.")

    others = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user.id,
            UserSession.id != current_session.id,
            UserSession.status == "active",
        )
        .all()
    )
    now = datetime.now(timezone.utc)
    for s in others:
        s.status = "revoked"
        s.revoked_at = now
    db.commit()
    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="ALL_OTHER_SESSIONS_REVOKED",
        resource_type="session",
        details={"revoked_count": len(others)},
    )
    return {"message": f"Revoked {len(others)} other active session(s).", "revoked_count": len(others)}
