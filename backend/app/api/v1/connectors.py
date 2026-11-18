import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, verify_csrf_if_cookie_auth, write_audit_log
from app.core.security import mask_account
from app.db.database import get_db
from app.db.seed import ensure_user_connectors
from app.models.models import Connector, User
from app.schemas.schemas import ConnectorActionRequest

router = APIRouter(prefix="/connectors", tags=["Financial Connectors"])


def _serialize_connector(c: Connector) -> dict:
    return {
        "id": c.id,
        "institution_code": c.institution_code,
        "institution_name": c.institution_name,
        "category": c.category,
        "connection_status": c.connection_status,
        "connection_method": c.connection_method,
        "is_sandbox": c.is_sandbox,
        "masked_account": c.masked_account,
        "data_sources": json.loads(c.data_sources_json or "[]"),
        "last_sync_at": c.last_sync_at,
        "security_notice": "FraudShield never asks for or stores banking passwords, bKash/Nagad/upay PINs, or OTP codes.",
    }


@router.get("")
def list_connectors(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_user_connectors(db, user.id, connect_defaults=False)
    items = db.query(Connector).filter(Connector.user_id == user.id).order_by(Connector.id.asc()).all()
    return {"items": [_serialize_connector(c) for c in items]}


@router.post("/{institution_code}/connect")
def connect_institution(
    institution_code: str,
    payload: ConnectorActionRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    ensure_user_connectors(db, user.id, connect_defaults=False)
    conn = (
        db.query(Connector)
        .filter(Connector.user_id == user.id, Connector.institution_code == institution_code)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Institution connector not found.")

    conn.connection_status = "Connected"
    conn.is_sandbox = payload.is_sandbox
    conn.masked_account = mask_account(payload.masked_account or f"0000{conn.id:04d}")
    conn.last_sync_at = datetime.now(timezone.utc)
    db.commit()

    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="CONNECTOR_CONNECTED",
        resource_type="connector",
        resource_id=institution_code,
        details={"is_sandbox": conn.is_sandbox, "masked_account": conn.masked_account},
    )
    return _serialize_connector(conn)


@router.post("/{institution_code}/sync")
def sync_institution(
    institution_code: str,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    conn = (
        db.query(Connector)
        .filter(Connector.user_id == user.id, Connector.institution_code == institution_code)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connector not found.")
    if conn.connection_status != "Connected":
        raise HTTPException(status_code=400, detail="Connect this institution before syncing.")

    conn.last_sync_at = datetime.now(timezone.utc)
    db.commit()
    return _serialize_connector(conn)


@router.post("/{institution_code}/disconnect")
def disconnect_institution(
    institution_code: str,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    conn = (
        db.query(Connector)
        .filter(Connector.user_id == user.id, Connector.institution_code == institution_code)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connector not found.")
    conn.connection_status = "Not Connected"
    db.commit()
    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="CONNECTOR_DISCONNECTED",
        resource_type="connector",
        resource_id=institution_code,
    )
    return _serialize_connector(conn)
