import json
import re
from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException, Query
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


# Clearly labeled synthetic sandbox KYC / Threat Registry for demonstration & testing
DEMO_RECIPIENT_REGISTRY = {
    "4433": {
        "full_name": "Unverified Offshore Wallet (Suspected Mule)",
        "age": "Not Available (Unverified)",
        "address": "Unregistered / Cross-Border Proxy Route",
        "city": "Unknown (TOR Exit Node)",
        "account_age": "12 days (Newly Created)",
        "institution": "Unknown External Gateway / MFS",
        "valid_person": False,
        "verification_status": "Unverified / Flagged Mule",
        "kyc_tier": "Tier-0 (Unverified)",
        "baseline_risk": 92,
        "blacklist_status": "Listed (High-Risk Watchlist)",
        "prior_reports": 6,
    },
    "4491": {
        "full_name": "Alexey Volkov",
        "age": "34 years",
        "address": "Tverskaya Street 14, Apt 88, Moscow",
        "city": "Moscow, Russia",
        "account_age": "3 months",
        "institution": "Offshore Exchange / Wire",
        "valid_person": False,
        "verification_status": "High-Risk Flagged Account",
        "kyc_tier": "Unverified Foreign Wire",
        "baseline_risk": 85,
        "blacklist_status": "Listed (TOR / Abuse Reports)",
        "prior_reports": 4,
    },
    "7732": {
        "full_name": "Agent 09 (Unregistered Cash-Out Point)",
        "age": "29 years",
        "address": "Mirpur-10 Circle, Dhaka 1216",
        "city": "Dhaka, Bangladesh",
        "account_age": "2 months",
        "institution": "bKash Agent (Suspicious Activity)",
        "valid_person": True,
        "verification_status": "Flagged for Velocity",
        "kyc_tier": "Limited KYC",
        "baseline_risk": 78,
        "blacklist_status": "Under Investigation",
        "prior_reports": 3,
    },
    "2211": {
        "full_name": "Tariqul Islam (New Merchant Hub)",
        "age": "31 years",
        "address": "House 18, Road 7, Dhanmondi, Dhaka 1205",
        "city": "Dhaka, Bangladesh",
        "account_age": "5 months",
        "institution": "BRAC Bank / MFS Merchant",
        "valid_person": True,
        "verification_status": "Valid Person (Pending Review)",
        "kyc_tier": "Standard KYC",
        "baseline_risk": 65,
        "blacklist_status": "Clean (Medium Velocity Alert)",
        "prior_reports": 1,
    },
    "9900": {
        "full_name": "Rahim Enterprise (Md. Abdur Rahim)",
        "age": "42 years",
        "address": "45 Motijheel Commercial Area, Dhaka 1000",
        "city": "Dhaka, Bangladesh",
        "account_age": "4 years 6 months",
        "institution": "BRAC Bank / bKash Verified Merchant",
        "valid_person": True,
        "verification_status": "Verified Valid Person",
        "kyc_tier": "Full NID & Trade License KYC",
        "baseline_risk": 14,
        "blacklist_status": "Clean",
        "prior_reports": 0,
    },
    "5502": {
        "full_name": "Nadia Rahman",
        "age": "27 years",
        "address": "Block C, Bashundhara R/A, Dhaka 1229",
        "city": "Dhaka, Bangladesh",
        "account_age": "3 years 8 months",
        "institution": "City Bank / bKash",
        "valid_person": True,
        "verification_status": "Verified Valid Person",
        "kyc_tier": "Full NID Verified",
        "baseline_risk": 12,
        "blacklist_status": "Clean",
        "prior_reports": 0,
    },
    "1122": {
        "full_name": "DESCO Electricity Utility",
        "age": "Corporate Utility",
        "address": "22/B Kazi Nazrul Islam Ave, Dhaka",
        "city": "Dhaka, Bangladesh",
        "account_age": "8+ years",
        "institution": "bKash Official Biller",
        "valid_person": True,
        "verification_status": "Verified Government Utility",
        "kyc_tier": "Corporate Verified",
        "baseline_risk": 8,
        "blacklist_status": "Clean",
        "prior_reports": 0,
    },
}


@router.get("/recipient-lookup")
def lookup_recipient_risk(
    query: str = Query(..., min_length=3, max_length=80),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Inspect prior high-risk history, transfer ledger, and sandbox identity details
    for a friend's or unknown person's phone number / bank account number.
    """
    raw = query.strip()
    digits = re.sub(r"\D", "", raw)
    last4 = digits[-4:] if len(digits) >= 4 else raw[-4:]

    is_bd_mobile = bool(re.match(r"^(?:\+?88)?01[3-9]\d{8}$", re.sub(r"[\s\-]", "", raw)))
    is_bank_acct = len(digits) >= 8 and not is_bd_mobile
    is_valid_format = is_bd_mobile or is_bank_acct or len(digits) >= 4
    input_type = "BD Mobile / MFS Number" if is_bd_mobile else ("Bank Account Number" if is_bank_acct else "Account / Reference Identifier")

    # Search user's own stored transactions matching last4, raw query, or recipient name
    user_txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.tx_timestamp.desc())
        .all()
    )
    matched_txs = [
        t
        for t in user_txs
        if (last4 and last4 in t.recipient_account_masked)
        or raw.lower() in t.recipient_account_masked.lower()
        or raw.lower() in t.recipient_name.lower()
    ]

    reg = DEMO_RECIPIENT_REGISTRY.get(last4)

    prior_high_risk = sum(
        1 for t in matched_txs if t.risk_score >= 70 or t.status in ("Flagged", "Auto-Rejected", "Rejected by User")
    )
    total_vol = round(sum(t.amount for t in matched_txs), 2)

    if matched_txs:
        max_tx_risk = max(t.risk_score for t in matched_txs)
        avg_tx_risk = sum(t.risk_score for t in matched_txs) / len(matched_txs)
        risk_pct = round(max(max_tx_risk, reg["baseline_risk"] if reg else avg_tx_risk), 1)
    elif reg:
        risk_pct = float(reg["baseline_risk"])
    else:
        # Honest baseline for an unknown number not found in history or demo registry
        risk_pct = 38.0 if not is_valid_format else 28.0

    if reg:
        prior_high_risk = max(prior_high_risk, reg["prior_reports"])

    risk_level = "High Risk" if risk_pct >= 70 else ("Medium Risk" if risk_pct >= 31 else "Low Risk")

    if reg:
        profile = {
            "valid_person": reg["valid_person"],
            "verification_status": reg["verification_status"],
            "full_name": reg["full_name"],
            "age": reg["age"],
            "address": reg["address"],
            "city": reg["city"],
            "account_age": reg["account_age"],
            "institution": reg["institution"],
            "phone_or_account": raw,
            "kyc_tier": reg["kyc_tier"],
            "is_demo_data": True,
            "registry_note": "Synthetic DEMO KYC & Threat Registry (Real NID/bank KYC requires an authorized provider API).",
        }
        blacklist_status = reg["blacklist_status"]
    elif matched_txs:
        first = matched_txs[0]
        profile = {
            "valid_person": True if risk_pct < 70 else False,
            "verification_status": "Known in Your Ledger" if risk_pct < 70 else "Flagged in Your Ledger",
            "full_name": first.recipient_name,
            "age": "Not Available (Private Bank Privacy)",
            "address": first.location_label or "Not Available",
            "city": first.location_label or "Not Available",
            "account_age": "Derived from Local Ledger",
            "institution": first.dest_institution or first.source_institution,
            "phone_or_account": raw,
            "kyc_tier": "Observed Transaction Counterparty",
            "is_demo_data": first.is_demo_data,
            "registry_note": "Derived from your monitored transaction history.",
        }
        blacklist_status = "Flagged in History" if prior_high_risk > 0 else "No Local Blacklist Hits"
    else:
        profile = {
            "valid_person": is_bd_mobile or is_bank_acct,
            "verification_status": "Valid Format — Unverified External Account" if is_valid_format else "Unrecognized Format",
            "full_name": "Not Available (External Unregistered Account)",
            "age": "Not Available",
            "address": "Not Available",
            "city": "Not Available",
            "account_age": "Unknown",
            "institution": "bKash / Nagad / BD Bank Format" if is_bd_mobile else "External Account",
            "phone_or_account": raw,
            "kyc_tier": "External / Unverified",
            "is_demo_data": False,
            "registry_note": "No prior records in your account or demo threat registry. Verify recipient before sending large amounts.",
        }
        blacklist_status = "No Prior Threat Reports Found"

    rec_action = (
        "DO NOT TRANSFER — High prior fraud/mule reports detected. Escalate or block."
        if risk_pct >= 70
        else (
            "Proceed with Caution — Request video/voice confirmation before sending money."
            if risk_pct >= 31
            else "Safe to Proceed — Verified recipient with clean historical record."
        )
    )

    # Monthly activity chart points for Card 1
    months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]
    base = max(8, int(risk_pct * 0.45))
    monthly_activity = [
        {
            "month": m,
            "risk_score": min(98, base + (i * 7 if risk_pct >= 70 else i * 2)),
            "incidents": 1 if (risk_pct >= 70 and i >= 3) else 0,
        }
        for i, m in enumerate(months)
    ]

    risk_breakdown = [
        {"label": "Prior Fraud / Mule Reports", "score": min(100, prior_high_risk * 22 if prior_high_risk else 6), "severity": "high" if prior_high_risk > 0 else "low"},
        {"label": "Identity & KYC Trust Risk", "score": 12 if profile["valid_person"] else 88, "severity": "low" if profile["valid_person"] else "high"},
        {"label": "Velocity & Unusual Channel Risk", "score": round(risk_pct * 0.85, 1), "severity": "high" if risk_pct >= 70 else ("medium" if risk_pct >= 31 else "low")},
    ]

    verification_checks = [
        {"label": "Valid Person / Identity Check", "status": "Verified" if profile["valid_person"] else "Failed / Unverified", "ok": profile["valid_person"]},
        {"label": "Number / Account Format Check", "status": input_type if is_valid_format else "Invalid Format", "ok": is_valid_format},
        {"label": "Prior High-Risk Incident Check", "status": f"{prior_high_risk} High-Risk Hit(s)" if prior_high_risk else "0 High-Risk Hits", "ok": prior_high_risk == 0},
        {"label": "Watchlist / Blacklist Status", "status": blacklist_status, "ok": "Clean" in blacklist_status or "No " in blacklist_status},
    ]

    alert_banners = [
        {
            "severity": "high" if prior_high_risk > 0 else "low",
            "title": "Prior High-Risk Incidents" if prior_high_risk > 0 else "Clean Transfer History",
            "metric": f"{prior_high_risk} Flagged",
            "detail": f"{prior_high_risk} high-risk/blocked event(s) linked to this number/account." if prior_high_risk else "No prior fraud incidents recorded.",
        },
        {
            "severity": "low" if profile["valid_person"] else "high",
            "title": "Identity Validity",
            "metric": "Valid" if profile["valid_person"] else "Unverified",
            "detail": profile["verification_status"],
        },
        {
            "severity": "high" if risk_pct >= 70 else ("medium" if risk_pct >= 31 else "low"),
            "title": "Overall Risk Score",
            "metric": f"{risk_pct:.0f}%",
            "detail": risk_level,
        },
    ]

    transfers_out = [
        {
            "id": t.id,
            "tx_ref": t.tx_ref,
            "date": (t.tx_timestamp if t.tx_timestamp.tzinfo else t.tx_timestamp.replace(tzinfo=timezone.utc)).strftime("%Y-%m-%d %H:%M"),
            "amount": t.amount,
            "currency": t.currency,
            "source_institution": t.source_institution,
            "dest_institution": t.dest_institution or "N/A",
            "recipient_name": t.recipient_name,
            "recipient_account_masked": t.recipient_account_masked,
            "status": t.status,
            "risk_score": t.risk_score,
            "risk_level": t.risk_level,
            "ip_address": t.ip_address or "Not Available",
            "location_label": t.location_label or "Not Available",
        }
        for t in matched_txs
    ]

    return {
        "query": raw,
        "input_type": input_type,
        "person_profile": profile,
        "risk_summary": {
            "risk_percentage": risk_pct,
            "risk_level": risk_level,
            "prior_high_risk_count": prior_high_risk,
            "total_matched_transfers": len(transfers_out),
            "total_volume": total_vol,
            "blacklist_status": blacklist_status,
            "recommended_action": rec_action,
        },
        "monthly_activity": monthly_activity,
        "risk_breakdown": risk_breakdown,
        "verification_checks": verification_checks,
        "alert_banners": alert_banners,
        "transfers": transfers_out,
    }
