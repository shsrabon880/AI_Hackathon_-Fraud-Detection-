from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.database import get_db
from app.models.models import IPIntelligence, Transaction, User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
settings = get_settings()


def _serialize_ip_intel(row: IPIntelligence) -> dict:
    return {
        "ip_address": row.ip_address,
        "risk_score": row.risk_score,
        "risk_level": row.risk_level,
        "is_demo_data": row.is_demo_data,
        "risk_summary": [
            {"key": "vpn_proxy", "label": "VPN / Proxy", "value": "Detected" if row.vpn_proxy else "Clean", "status": "danger" if row.vpn_proxy else "safe"},
            {"key": "tor_node", "label": "TOR Node", "value": "Detected" if row.tor_node else "Clean", "status": "danger" if row.tor_node else "safe"},
            {"key": "hosting_dc", "label": "Hosting Data Center", "value": "Yes" if row.hosting_dc else "No", "status": "danger" if row.hosting_dc else "safe"},
            {"key": "known_attacker", "label": "Known Attacker", "value": "Yes" if row.known_attacker else "No", "status": "danger" if row.known_attacker else "safe"},
            {"key": "spam_source", "label": "Spam Source", "value": "Yes" if row.spam_source else "No", "status": "danger" if row.spam_source else "safe"},
            {"key": "abuse_confidence", "label": "Abuse Confidence Score", "value": row.abuse_confidence, "status": "danger" if row.abuse_confidence == "High" else ("warning" if row.abuse_confidence == "Medium" else "safe")},
        ],
        "geo_location": {
            "country": row.country,
            "country_code": row.country_code,
            "region": row.region,
            "city": row.city,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "privacy_notice": "Approximate IP-based geolocation only. IP intelligence does not reveal an exact physical street address.",
        },
        "risk_indicators": [
            {"label": "Anonymous IP", "severity": row.anonymous_ip_severity, "explanation": "Evaluates whether traffic routes through anonymizing proxies, VPN gateways, or relay nodes."},
            {"label": "Recent Abuse Reports", "severity": row.recent_abuse_severity, "explanation": "Aggregates recent threat intelligence abuse reports linked to this IP block."},
            {"label": "Bot Activity", "severity": row.bot_activity_severity, "explanation": "Measures automated headless client or credential-stuffing request signatures."},
            {"label": "Unusual Traffic", "severity": row.unusual_traffic_severity, "explanation": "Detects abnormal request cadence or atypical cross-border banking access."},
            {"label": "Velocity Checks", "severity": row.velocity_checks_severity, "explanation": "Checks short-window transaction burst rate from this IP."},
            {"label": "Blacklist Status", "severity": row.blacklist_status, "explanation": "Checks whether the IP appears on curated threat-intelligence blocklists."},
        ],
        "detailed_information": {
            "ip_address": row.ip_address,
            "asn": row.asn,
            "isp_org": row.isp_org,
            "connection_type": row.connection_type,
            "usage_type": row.usage_type,
            "domain": row.domain,
            "timezone": row.timezone,
            "local_time": row.local_time_label,
            "ip_age": row.ip_age,
            "last_seen": row.last_seen,
        },
        "recommendation": {
            "summary": row.recommendation_summary,
            "action": row.recommended_action,
            "severity": "high" if row.risk_score >= 70 else ("medium" if row.risk_score >= 31 else "low"),
        },
    }


@router.get("/overview")
def get_dashboard_overview(
    ip_address: Optional[str] = Query(default="103.21.244.0"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ip_row = db.query(IPIntelligence).filter(IPIntelligence.ip_address == ip_address).first()
    if not ip_row:
        ip_row = db.query(IPIntelligence).first()
    if not ip_row:
        raise HTTPException(status_code=404, detail="No IP intelligence data available.")

    user_txs = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    high_risk_count = sum(1 for t in user_txs if t.risk_score >= 70)

    available_ips = [
        {"ip_address": item.ip_address, "city": item.city, "country": item.country, "risk_score": item.risk_score, "risk_level": item.risk_level, "is_demo_data": item.is_demo_data}
        for item in db.query(IPIntelligence).order_by(IPIntelligence.risk_score.desc()).all()
    ]

    return {
        "intel": _serialize_ip_intel(ip_row),
        "available_ips": available_ips,
        "google_maps_configured": bool(settings.GOOGLE_MAPS_API_KEY.strip()),
        "google_maps_api_key": settings.GOOGLE_MAPS_API_KEY.strip() or None,
        "user_summary": {
            "monitored_transactions": len(user_txs),
            "high_risk_transactions": high_risk_count,
        },
    }


@router.get("/ip-intelligence")
def list_ip_intelligence(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(IPIntelligence).order_by(IPIntelligence.risk_score.desc()).all()
    return {"items": [_serialize_ip_intel(r) for r in rows]}
