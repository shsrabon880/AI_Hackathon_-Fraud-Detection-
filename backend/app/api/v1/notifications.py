import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, verify_csrf_if_cookie_auth
from app.db.database import get_db
from app.models.models import Notification, NotificationPreference, User
from app.schemas.schemas import NotificationPreferenceUpdate

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def get_or_create_preferences(db: Session, user_id: int) -> NotificationPreference:
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    if not pref:
        pref = NotificationPreference(user_id=user_id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


def emit_notification(
    db: Session,
    *,
    user_id: int,
    category: str,
    severity: str,
    title: str,
    message: str,
) -> Optional[Notification]:
    """Create a user-scoped real-time notification honoring user preferences."""
    pref = get_or_create_preferences(db, user_id)
    category_map = {
        "fraud_alert": pref.fraud_alerts,
        "critical_risk": pref.critical_risk,
        "new_device": pref.new_device_login,
        "connection": pref.account_connections,
        "suspicious_login": pref.suspicious_login,
        "tx_review": pref.tx_review,
    }
    if not category_map.get(category, True):
        return None

    row = Notification(
        user_id=user_id,
        category=category,
        severity=severity,
        title=title[:160],
        message=message,
        is_read=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(40)
        .all()
    )
    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read.is_(False))
        .count()
    )
    return {
        "unread_count": unread_count,
        "items": [
            {
                "id": n.id,
                "category": n.category,
                "severity": n.severity,
                "title": n.title,
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at,
            }
            for n in rows
        ],
    }


@router.patch("/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    row = (
        db.query(Notification)
        .filter(Notification.id == notif_id, Notification.user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found.")
    row.is_read = True
    db.commit()
    return {"id": row.id, "is_read": True}


@router.post("/read-all")
def mark_all_read(
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == user.id, Notification.is_read.is_(False)
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read."}


@router.get("/preferences")
def get_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pref = get_or_create_preferences(db, user.id)
    return {
        "fraud_alerts": pref.fraud_alerts,
        "critical_risk": pref.critical_risk,
        "new_device_login": pref.new_device_login,
        "account_connections": pref.account_connections,
        "suspicious_login": pref.suspicious_login,
        "tx_review": pref.tx_review,
        "email_notifications": pref.email_notifications,
    }


@router.put("/preferences")
def update_preferences(
    payload: NotificationPreferenceUpdate,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    pref = get_or_create_preferences(db, user.id)
    for field in (
        "fraud_alerts",
        "critical_risk",
        "new_device_login",
        "account_connections",
        "suspicious_login",
        "tx_review",
        "email_notifications",
    ):
        val = getattr(payload, field)
        if val is not None:
            setattr(pref, field, val)
    db.commit()
    return {
        "fraud_alerts": pref.fraud_alerts,
        "critical_risk": pref.critical_risk,
        "new_device_login": pref.new_device_login,
        "account_connections": pref.account_connections,
        "suspicious_login": pref.suspicious_login,
        "tx_review": pref.tx_review,
        "email_notifications": pref.email_notifications,
    }


@router.get("/stream")
async def notification_stream(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Server-Sent Events (SSE) stream pushing real-time unread notifications for the signed-in user."""

    async def event_generator():
        last_seen_id = 0
        for _ in range(12):
            if await request.is_disconnected():
                break
            db.expire_all()
            latest = (
                db.query(Notification)
                .filter(Notification.user_id == user.id)
                .order_by(Notification.id.desc())
                .limit(5)
                .all()
            )
            unread = (
                db.query(Notification)
                .filter(Notification.user_id == user.id, Notification.is_read.is_(False))
                .count()
            )
            top_id = latest[0].id if latest else 0
            if top_id != last_seen_id or last_seen_id == 0:
                last_seen_id = top_id
                payload = {
                    "unread_count": unread,
                    "latest": [
                        {
                            "id": n.id,
                            "category": n.category,
                            "severity": n.severity,
                            "title": n.title,
                            "message": n.message,
                            "is_read": n.is_read,
                            "created_at": n.created_at.isoformat(),
                        }
                        for n in latest
                    ],
                }
                yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
