import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, verify_csrf_if_cookie_auth, write_audit_log
from app.db.database import get_db
from app.models.models import Device, User
from app.schemas.schemas import DeviceTrustUpdateRequest

router = APIRouter(prefix="/devices", tags=["Device Intelligence"])


def _serialize_device(d: Device) -> dict:
    # Strictly preserve honest "Not Available" when browser cannot access mobile hardware/SIM data
    return {
        "id": d.id,
        "device_fingerprint": d.device_fingerprint,
        "device_name": d.device_name,
        "device_model": d.device_model,
        "os": d.os,
        "browser": d.browser,
        "ip_address": d.ip_address,
        "approx_location": d.approx_location,
        "battery_percentage": f"{d.battery_pct}%" if d.battery_pct is not None else "Not Available",
        "sim_operator": d.sim_operator if d.sim_operator else "Not Available",
        "phone_number_masked": d.phone_masked if d.phone_masked else "Not Available",
        "trust_status": d.trust_status,
        "risk_score": d.risk_score,
        "risk_classification": "High Risk" if d.risk_score >= 70 else ("Medium Risk" if d.risk_score >= 31 else "Low Risk"),
        "unusual_tx_count": d.unusual_tx_count,
        "failed_auth_count": d.failed_auth_count,
        "is_new_device": d.is_new_device,
        "anomalies": json.loads(d.anomalies_json or "[]"),
        "login_history": json.loads(d.login_history_json or "[]"),
        "last_active_at": d.last_active_at,
        "created_at": d.created_at,
        "privacy_note": "Hardware SIM, phone number, and battery telemetry are never fabricated in browser sessions and appear only when explicitly supplied by an authorized mobile app.",
    }


@router.get("")
def list_devices(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    devices = db.query(Device).filter(Device.user_id == user.id).order_by(Device.risk_score.desc()).all()
    return {"items": [_serialize_device(d) for d in devices]}


@router.patch("/{device_id}/trust")
def update_device_trust(
    device_id: int,
    payload: DeviceTrustUpdateRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    device = db.query(Device).filter(Device.id == device_id, Device.user_id == user.id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found.")
    device.trust_status = payload.trust_status
    if payload.trust_status == "trusted":
        device.is_new_device = False
        device.risk_score = min(device.risk_score, 20.0)
    elif payload.trust_status in ("suspicious", "blocked"):
        device.risk_score = max(device.risk_score, 80.0)
    db.commit()
    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="DEVICE_TRUST_UPDATED",
        resource_type="device",
        resource_id=str(device.id),
        details={"trust_status": device.trust_status},
    )
    return _serialize_device(device)
