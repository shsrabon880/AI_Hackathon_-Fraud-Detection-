from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, verify_csrf_if_cookie_auth, write_audit_log
from app.db.database import get_db
from app.models.models import ServiceHealth, User

router = APIRouter(prefix="/services", tags=["Services"])


@router.get("")
def list_services(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(ServiceHealth).order_by(ServiceHealth.id.asc()).all()
    return {
        "items": [
            {
                "id": s.id,
                "service_name": s.service_name,
                "display_name": s.display_name,
                "description": s.description,
                "status": s.status,
                "latency_ms": s.latency_ms,
                "last_run_at": s.last_run_at,
                "last_error": s.last_error,
                "records_processed": s.records_processed,
            }
            for s in rows
        ]
    }


@router.post("/{service_name}/check")
def run_service_check(
    service_name: str,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    svc = db.query(ServiceHealth).filter(ServiceHealth.service_name == service_name).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found.")
    svc.last_run_at = datetime.now(timezone.utc)
    svc.status = "Healthy"
    svc.last_error = None
    db.commit()
    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="SERVICE_HEALTH_CHECKED",
        resource_type="service",
        resource_id=service_name,
    )
    return {
        "service_name": svc.service_name,
        "status": svc.status,
        "last_run_at": svc.last_run_at,
    }
