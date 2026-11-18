import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, verify_csrf_if_cookie_auth, write_audit_log
from app.db.database import get_db
from app.graph.network_analyzer import analyze_transaction_graph
from app.models.models import AuditLog, Device, SecurityAlert, Transaction, User
from app.schemas.schemas import AlertStatusUpdateRequest

router = APIRouter(prefix="/intelligence", tags=["Intelligence & Ops"])


@router.get("/graph")
def get_fraud_graph(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txs = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    devs = db.query(Device).filter(Device.user_id == user.id).all()
    return analyze_transaction_graph(txs, devs)


@router.get("/alerts")
def list_alerts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(SecurityAlert)
        .filter(SecurityAlert.user_id == user.id)
        .order_by(SecurityAlert.created_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": a.id,
                "severity": a.severity,
                "title": a.title,
                "description": a.description,
                "status": a.status,
                "transaction_id": a.transaction_id,
                "is_demo_data": a.is_demo_data,
                "created_at": a.created_at,
            }
            for a in rows
        ]
    }


@router.patch("/alerts/{alert_id}")
def update_alert_status(
    alert_id: int,
    payload: AlertStatusUpdateRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    alert = (
        db.query(SecurityAlert)
        .filter(SecurityAlert.id == alert_id, SecurityAlert.user_id == user.id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    alert.status = payload.status
    db.commit()
    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="ALERT_STATUS_UPDATED",
        resource_type="alert",
        resource_id=str(alert.id),
        details={"status": alert.status},
    )
    return {"id": alert.id, "status": alert.status}


@router.get("/audit-logs")
def list_audit_logs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(AuditLog)
    if user.role != "admin":
        query = query.filter(AuditLog.user_id == user.id)
    rows = query.order_by(AuditLog.created_at.desc()).limit(100).all()
    return {
        "items": [
            {
                "id": r.id,
                "actor_email": r.actor_email,
                "action": r.action,
                "resource_type": r.resource_type,
                "resource_id": r.resource_id,
                "ip_address": r.ip_address,
                "status": r.status,
                "details": json.loads(r.details_json or "{}"),
                "created_at": r.created_at,
            }
            for r in rows
        ]
    }
