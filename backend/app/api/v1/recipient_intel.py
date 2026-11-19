import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import check_rate_limit, get_current_user, verify_csrf_if_cookie_auth, write_audit_log
from app.core.config import get_settings
from app.core.security import mask_account
from app.db.database import get_db
from app.ml.risk_engine import classify_risk
from app.models.models import Connector, Transaction, User

router = APIRouter(prefix="/recipient-intel", tags=["Recipient Intelligence Center"])
settings = get_settings()

# Operator prefix map for Bangladeshi mobile numbers
BD_OPERATOR_MAP = {
    "017": "Grameenphone",
    "013": "Grameenphone",
    "018": "Robi",
    "019": "Banglalink",
    "014": "Banglalink",
    "016": "Airtel (Robi)",
    "015": "Teletalk",
}


def _normalize_bd_phone(raw: str) -> Dict[str, Any]:
    cleaned = re.sub(r"[\s\-\(\)]", "", (raw or "").strip())
    if cleaned.startswith("+880"):
        local = "0" + cleaned[4:]
    elif cleaned.startswith("880"):
        local = "0" + cleaned[3:]
    else:
        local = cleaned

    is_valid = bool(re.match(r"^01[3-9]\d{8}$", local))
    prefix = local[:3] if len(local) >= 3 else ""
    operator = BD_OPERATOR_MAP.get(prefix, "Unknown Operator")
    return {
        "raw": raw.strip(),
        "normalized_local": local,
        "international": f"+88{local}" if is_valid else raw.strip(),
        "is_valid": is_valid,
        "operator": operator if is_valid else "Not Available (Invalid BD Prefix)",
    }


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


# Clearly labelled DEMO DATA & Consented Judge Demonstration Profiles
CONSENTED_DEMO_PHONES: Dict[str, Dict[str, Any]] = {
    "01782670589": {
        "verified_name": "Srabon",
        "age": 24,
        "address": "Mirpur DOHS, Dhaka 1216",
        "city": "Dhaka, Bangladesh",
        "latitude": 23.8365,
        "longitude": 90.3695,
        "provider": "bKash / BRAC Bank",
        "account_verification": "Verified",
        "number_verification": "Verified (Consented Demo Profile)",
        "scenario": "Scenario A — Verified Team Demo Profile (Low Risk)",
        "risk_score": 12.0,
        "confidence": 94,
        "scam_indicators": [],
        "complaints": 0,
        "public_risk_info": "Clean verified account with consistent Dhaka activity.",
        "demo_transactions": [
            {"tx_ref": "DEMO-SR-101", "days_ago": 1, "amount": 4500.0, "method": "MFS Transfer", "provider": "bKash", "sender_masked": "****1200", "recipient_masked": "****0589", "recipient_name": "Srabon", "status": "Completed", "location": "Dhaka, Bangladesh", "lat": 23.8365, "lon": 90.3695, "risk_score": 11.0},
            {"tx_ref": "DEMO-SR-102", "days_ago": 5, "amount": 12000.0, "method": "NPSB Transfer", "provider": "BRAC Bank", "sender_masked": "****1200", "recipient_masked": "****0589", "recipient_name": "Srabon", "status": "Completed", "location": "Dhaka, Bangladesh", "lat": 23.8103, "lon": 90.4125, "risk_score": 12.0},
            {"tx_ref": "DEMO-SR-103", "days_ago": 11, "amount": 2200.0, "method": "Payment", "provider": "bKash", "sender_masked": "****0589", "recipient_masked": "****8831", "recipient_name": "Shwapno Superstore", "status": "Completed", "location": "Mirpur, Dhaka", "lat": 23.8223, "lon": 90.3654, "risk_score": 9.0},
        ],
    },
    "01858500761": {
        "verified_name": "Hasibur Rahman",
        "age": 25,
        "address": "Dhanmondi Road 9/A, Dhaka 1209",
        "city": "Dhaka, Bangladesh",
        "latitude": 23.7461,
        "longitude": 90.3742,
        "provider": "Nagad / City Bank",
        "account_verification": "Verified",
        "number_verification": "Verified (Consented Demo Profile)",
        "scenario": "Scenario A — Verified Team Demo Profile (Low Risk)",
        "risk_score": 16.0,
        "confidence": 92,
        "scam_indicators": [],
        "complaints": 0,
        "public_risk_info": "No scam reports. Normal peer-to-peer and merchant transfers.",
        "demo_transactions": [
            {"tx_ref": "DEMO-HR-201", "days_ago": 2, "amount": 6800.0, "method": "MFS Send Money", "provider": "Nagad", "sender_masked": "****1200", "recipient_masked": "****0761", "recipient_name": "Hasibur Rahman", "status": "Completed", "location": "Dhanmondi, Dhaka", "lat": 23.7461, "lon": 90.3742, "risk_score": 14.0},
            {"tx_ref": "DEMO-HR-202", "days_ago": 9, "amount": 15500.0, "method": "BEFTN Transfer", "provider": "City Bank", "sender_masked": "****0761", "recipient_masked": "****5502", "recipient_name": "Nadia Rahman", "status": "Completed", "location": "Dhaka, Bangladesh", "lat": 23.7808, "lon": 90.4071, "risk_score": 16.0},
        ],
    },
    "01788930055": {
        "verified_name": "Nazia Islam",
        "age": 23,
        "address": "Banani Block F, Dhaka 1213",
        "city": "Dhaka, Bangladesh",
        "latitude": 23.7937,
        "longitude": 90.4066,
        "provider": "bKash / Eastern Bank Limited (EBL)",
        "account_verification": "Verified",
        "number_verification": "Verified (Consented Demo Profile)",
        "scenario": "Scenario A — Verified Team Demo Profile (Low Risk)",
        "risk_score": 15.0,
        "confidence": 93,
        "scam_indicators": [],
        "complaints": 0,
        "public_risk_info": "Verified student & personal wallet with zero fraud hits.",
        "demo_transactions": [
            {"tx_ref": "DEMO-NI-301", "days_ago": 3, "amount": 3400.0, "method": "MFS Send Money", "provider": "bKash", "sender_masked": "****1200", "recipient_masked": "****0055", "recipient_name": "Nazia Islam", "status": "Completed", "location": "Banani, Dhaka", "lat": 23.7937, "lon": 90.4066, "risk_score": 13.0},
            {"tx_ref": "DEMO-NI-302", "days_ago": 14, "amount": 9200.0, "method": "Card Payment", "provider": "Eastern Bank Limited (EBL)", "sender_masked": "****0055", "recipient_masked": "****3319", "recipient_name": "Chaldal Groceries", "status": "Completed", "location": "Dhaka, Bangladesh", "lat": 23.7937, "lon": 90.4066, "risk_score": 15.0},
        ],
    },
    "01776277356": {
        "verified_name": "Mehedi Hassan Minhaz",
        "age": 25,
        "address": "Uttara Sector 7, Dhaka 1230",
        "city": "Dhaka, Bangladesh",
        "latitude": 23.8759,
        "longitude": 90.3795,
        "provider": "Rocket (DBBL MFS) / Dutch-Bangla Bank",
        "account_verification": "Verified",
        "number_verification": "Verified (Consented Demo Profile)",
        "scenario": "Scenario B — Elevated Velocity Demo Profile (Medium Risk)",
        "risk_score": 46.0,
        "confidence": 85,
        "scam_indicators": ["Recent high-value late-night transfer velocity (DEMO)"],
        "complaints": 1,
        "public_risk_info": "1 unverified velocity flag in demonstration scenario; confirm before large transfers.",
        "demo_transactions": [
            {"tx_ref": "DEMO-MM-401", "days_ago": 1, "amount": 38000.0, "method": "Rocket Transfer", "provider": "Rocket (DBBL MFS)", "sender_masked": "****1200", "recipient_masked": "****7356", "recipient_name": "Mehedi Hassan Minhaz", "status": "Pending Review", "location": "Uttara, Dhaka", "lat": 23.8759, "lon": 90.3795, "risk_score": 46.0},
            {"tx_ref": "DEMO-MM-402", "days_ago": 6, "amount": 11500.0, "method": "Bank Transfer", "provider": "Dutch-Bangla Bank Limited", "sender_masked": "****7356", "recipient_masked": "****2210", "recipient_name": "TechGadgets BD", "status": "Completed", "location": "Dhaka, Bangladesh", "lat": 23.8759, "lon": 90.3795, "risk_score": 24.0},
        ],
    },
    "01315244948": {
        "verified_name": "Nihar Ranjan Roy",
        "age": 24,
        "address": "Motijheel Commercial Area, Dhaka 1000",
        "city": "Dhaka, Bangladesh",
        "latitude": 23.7330,
        "longitude": 90.4172,
        "provider": "bKash / Islami Bank Bangladesh",
        "account_verification": "Verified",
        "number_verification": "Verified (Consented Demo Profile)",
        "scenario": "Scenario A — Verified Team Demo Profile (Low Risk)",
        "risk_score": 18.0,
        "confidence": 91,
        "scam_indicators": [],
        "complaints": 0,
        "public_risk_info": "Consistent verified business/personal profile with clean history.",
        "demo_transactions": [
            {"tx_ref": "DEMO-NR-501", "days_ago": 2, "amount": 7500.0, "method": "MFS Transfer", "provider": "bKash", "sender_masked": "****1200", "recipient_masked": "****4948", "recipient_name": "Nihar Ranjan Roy", "status": "Completed", "location": "Motijheel, Dhaka", "lat": 23.7330, "lon": 90.4172, "risk_score": 18.0},
            {"tx_ref": "DEMO-NR-502", "days_ago": 8, "amount": 14000.0, "method": "IBBL Transfer", "provider": "Islami Bank Bangladesh", "sender_masked": "****4948", "recipient_masked": "****9900", "recipient_name": "Rahim Enterprise", "status": "Completed", "location": "Dhaka, Bangladesh", "lat": 23.7330, "lon": 90.4172, "risk_score": 14.0},
        ],
    },
    # Judge Scenario A / B / C profiles
    "01711889900": {
        "verified_name": "Rahim Enterprise (Md. Abdur Rahim)",
        "age": 42,
        "address": "45 Motijheel C/A, Dhaka 1000",
        "city": "Dhaka, Bangladesh",
        "latitude": 23.7330,
        "longitude": 90.4172,
        "provider": "bKash / BRAC Bank Merchant",
        "account_verification": "Verified",
        "number_verification": "Verified (Judge Scenario A)",
        "scenario": "Scenario A — Low Risk Verified Merchant",
        "risk_score": 14.0,
        "confidence": 95,
        "scam_indicators": [],
        "complaints": 0,
        "public_risk_info": "Long-standing verified commercial merchant account.",
        "demo_transactions": [
            {"tx_ref": "DEMO-SCENA-01", "days_ago": 4, "amount": 12500.0, "method": "Merchant Payment", "provider": "bKash", "sender_masked": "****1200", "recipient_masked": "****9900", "recipient_name": "Rahim Enterprise", "status": "Completed", "location": "Motijheel, Dhaka", "lat": 23.7330, "lon": 90.4172, "risk_score": 14.0},
        ],
    },
    "01855992211": {
        "verified_name": "Tariqul Islam (New Merchant Hub)",
        "age": 31,
        "address": "Road 7, Dhanmondi, Dhaka 1205",
        "city": "Dhaka, Bangladesh",
        "latitude": 23.7461,
        "longitude": 90.3742,
        "provider": "Nagad / City Bank",
        "account_verification": "Pending Verification",
        "number_verification": "Partially Verified (Judge Scenario B)",
        "scenario": "Scenario B — Medium Risk (Unusual Patterns & Incomplete Verification)",
        "risk_score": 65.0,
        "confidence": 82,
        "scam_indicators": ["Incomplete KYC verification", "Unusual VPN session origin (Singapore)"],
        "complaints": 1,
        "public_risk_info": "Moderate anomaly detected. Verify identity before high-value payment.",
        "demo_transactions": [
            {"tx_ref": "DEMO-SCENB-01", "days_ago": 1, "amount": 46500.0, "method": "Bank Transfer", "provider": "City Bank", "sender_masked": "****1200", "recipient_masked": "****2211", "recipient_name": "Tariqul Islam", "status": "Pending Review", "location": "Singapore (VPN Approx)", "lat": 1.3521, "lon": 103.8198, "risk_score": 65.0},
        ],
    },
    "01999884433": {
        "verified_name": "Synthetic High-Risk Mule Account",
        "age": None,
        "address": "Unverified / Cross-Border Proxy",
        "city": "Moscow, Russia (TOR Exit)",
        "latitude": 55.7558,
        "longitude": 37.6173,
        "provider": "Unknown External Gateway / MFS",
        "account_verification": "Not Verified",
        "number_verification": "Flagged High Risk (Judge Scenario C)",
        "scenario": "Scenario C — High Risk (Multiple Verified Demo Fraud Indicators)",
        "risk_score": 92.0,
        "confidence": 96,
        "scam_indicators": [
            "Linked to TOR / Hosting Data Center IP (103.21.244.0)",
            "Rapid cash-out mule fan-out pattern",
            "Multiple synthetic fraud complaints",
        ],
        "complaints": 6,
        "public_risk_info": "Critical demonstration risk: matches multiple synthetic mule and takeover indicators.",
        "demo_transactions": [
            {"tx_ref": "DEMO-SCENC-01", "days_ago": 0, "amount": 145000.0, "method": "Cash Out", "provider": "BRAC Bank", "sender_masked": "****1200", "recipient_masked": "****4433", "recipient_name": "Offshore Mule Wallet", "status": "Auto-Rejected", "location": "Moscow, Russia", "lat": 55.7558, "lon": 37.6173, "risk_score": 92.0},
            {"tx_ref": "DEMO-SCENC-02", "days_ago": 3, "amount": 68000.0, "method": "Wire Transfer", "provider": "City Bank", "sender_masked": "****4433", "recipient_masked": "****4491", "recipient_name": "Alexey Volkov", "status": "Flagged", "location": "Moscow, Russia", "lat": 55.7558, "lon": 37.6173, "risk_score": 88.0},
        ],
    },
}

DEMO_BANK_ACCOUNTS: Dict[str, Dict[str, Any]] = {
    "100234567890": {
        "bank_code": "brac_bank",
        "account_holder": "Srabon Rahman (Demo Verified)",
        "account_type": "Savings Account",
        "verification_status": "Verified",
        "risk_score": 12.0,
        "complaints": 0,
        "indicators": ["Consistent payroll & bill payment history", "Authorized sandbox account match"],
    },
    "200112233445": {
        "bank_code": "city_bank",
        "account_holder": "Hasibur Rahman (Demo Verified)",
        "account_type": "Current Account",
        "verification_status": "Verified",
        "risk_score": 18.0,
        "complaints": 0,
        "indicators": ["Verified commercial account", "Clean beneficiary graph"],
    },
    "300998877665": {
        "bank_code": "dhaka_bank",
        "account_holder": "Tariqul Islam (Demo Pending)",
        "account_type": "Merchant Current",
        "verification_status": "Pending Verification",
        "risk_score": 56.0,
        "complaints": 1,
        "indicators": ["Recent high-value cross-channel spike", "Awaiting secondary KYC document"],
    },
    "400999884491": {
        "bank_code": "islami_bank",
        "account_holder": "Unverified Offshore Proxy (Demo Flagged)",
        "account_type": "Unknown / Restricted",
        "verification_status": "Not Verified",
        "risk_score": 89.0,
        "complaints": 5,
        "indicators": ["Linked to flagged TOR IP transfers", "Repeated high-risk beneficiary alerts"],
    },
}


class BankLookupRequest(BaseModel):
    bank_code: str = Field(..., min_length=2, max_length=64)
    bank_name: str = Field(..., min_length=2, max_length=120)
    account_number: str = Field(..., min_length=4, max_length=32)
    account_holder_name: Optional[str] = Field(default=None, max_length=120)
    account_type: Optional[str] = Field(default=None, max_length=64)


class AIReportRequest(BaseModel):
    subject_type: str = Field(..., pattern="^(phone|bank)$")
    masked_identifier: str = Field(..., min_length=2, max_length=64)
    risk_score: float = Field(..., ge=0, le=100)
    risk_level: str = Field(..., max_length=32)
    verification_status: str = Field(..., max_length=80)
    factors: List[Dict[str, Any]] = Field(default_factory=list)
    consent_granted: bool = False


@router.get("/scenarios")
def list_demo_scenarios(user: User = Depends(get_current_user)):
    """Return consented demo phone numbers & judge scenarios (clearly marked DEMO DATA)."""
    return {
        "is_demo_data": True,
        "team_profiles": [
            {
                "phone": k,
                "name": CONSENTED_DEMO_PHONES[k]["verified_name"],
                "age": CONSENTED_DEMO_PHONES[k]["age"],
                "risk_score": CONSENTED_DEMO_PHONES[k]["risk_score"],
                "risk_level": classify_risk(CONSENTED_DEMO_PHONES[k]["risk_score"]),
            }
            for k in ("01782670589", "01858500761", "01788930055", "01776277356", "01315244948")
        ],
        "judge_scenarios": [
            {"id": "A", "label": "Scenario A: Low Risk", "phone": "01782670589", "bank_code": "brac_bank", "bank_account": "100234567890"},
            {"id": "B", "label": "Scenario B: Medium Risk", "phone": "01855992211", "bank_code": "dhaka_bank", "bank_account": "300998877665"},
            {"id": "C", "label": "Scenario C: High Risk", "phone": "01999884433", "bank_code": "islami_bank", "bank_account": "400999884491"},
        ],
    }


@router.get("/phone")
def phone_intelligence_lookup(
    phone: str = Query(..., min_length=6, max_length=24),
    demo_mode: bool = Query(default=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_rate_limit(f"phone-lookup:{user.id}", max_requests=40, window_seconds=60)
    parsed = _normalize_bd_phone(phone)
    local = parsed["normalized_local"]
    last4 = local[-4:] if len(local) >= 4 else local
    now = _now_utc()

    demo_entry = CONSENTED_DEMO_PHONES.get(local) if demo_mode else None

    # Fetch ONLY authenticated user's own stored transactions matching this number
    user_txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.tx_timestamp.desc())
        .all()
    )
    matched_user_txs = [
        t
        for t in user_txs
        if (last4 and last4 in t.recipient_account_masked)
        or (demo_entry and demo_entry["verified_name"].lower() in t.recipient_name.lower())
    ]

    # Build authorized + demo transaction list (never claiming private access to strangers' data)
    tx_rows: List[Dict[str, Any]] = []
    for t in matched_user_txs:
        ts = t.tx_timestamp if t.tx_timestamp.tzinfo else t.tx_timestamp.replace(tzinfo=timezone.utc)
        tx_rows.append({
            "tx_ref": t.tx_ref,
            "date": ts.strftime("%Y-%m-%d"),
            "time": ts.strftime("%H:%M:%S UTC"),
            "amount": t.amount,
            "currency": t.currency,
            "sender_masked": mask_account(user.user_code),
            "recipient_masked": t.recipient_account_masked,
            "recipient_name": t.recipient_name,
            "payment_method": t.tx_type,
            "provider": t.source_institution,
            "status": t.status,
            "location": t.location_label or "Not Available",
            "latitude": t.latitude,
            "longitude": t.longitude,
            "risk_score": t.risk_score,
            "data_origin": "USER_AUTHORIZED_LEDGER",
        })

    if demo_entry:
        existing_refs = {r["tx_ref"] for r in tx_rows}
        for dt in demo_entry["demo_transactions"]:
            if dt["tx_ref"] in existing_refs:
                continue
            ts = now - timedelta(days=dt["days_ago"], hours=2)
            tx_rows.append({
                "tx_ref": dt["tx_ref"],
                "date": ts.strftime("%Y-%m-%d"),
                "time": ts.strftime("%H:%M:%S UTC"),
                "amount": dt["amount"],
                "currency": "BDT",
                "sender_masked": dt["sender_masked"],
                "recipient_masked": dt["recipient_masked"],
                "recipient_name": dt["recipient_name"],
                "payment_method": dt["method"],
                "provider": dt["provider"],
                "status": dt["status"],
                "location": dt["location"],
                "latitude": dt["lat"],
                "longitude": dt["lon"],
                "risk_score": dt["risk_score"],
                "data_origin": "DEMO DATA",
            })

    total_tx = len(tx_rows)
    total_vol = round(sum(r["amount"] for r in tx_rows), 2)
    previous_recipients = sorted({r["recipient_name"] for r in tx_rows})
    suspicious_count = sum(1 for r in tx_rows if r["risk_score"] >= 70 or r["status"] in ("Flagged", "Auto-Rejected", "Pending Review"))

    if demo_entry:
        max_seen = max([r["risk_score"] for r in tx_rows] + [demo_entry["risk_score"]])
        risk_score = round(max_seen, 1)
        confidence = demo_entry["confidence"]
        scam_indicators = demo_entry["scam_indicators"]
        complaints = demo_entry["complaints"]
        profile = {
            "mobile_number": parsed["international"],
            "verified_name": demo_entry["verified_name"],
            "age": f"{demo_entry['age']} years (Consented Demo)" if demo_entry["age"] is not None else "Not Available",
            "address": demo_entry["address"],
            "city": demo_entry["city"],
            "latitude": demo_entry["latitude"],
            "longitude": demo_entry["longitude"],
            "mobile_operator": parsed["operator"],
            "format_valid": parsed["is_valid"],
            "number_verification_status": demo_entry["number_verification"],
            "account_verification_status": demo_entry["account_verification"],
            "public_risk_info": demo_entry["public_risk_info"],
            "last_verified_at": now.isoformat(),
            "is_demo_data": True,
            "scenario_label": demo_entry["scenario"],
        }
    else:
        # Honest report for any unverified / non-demo number
        risk_score = 35.0 if not parsed["is_valid"] else (max((r["risk_score"] for r in tx_rows), default=22.0))
        confidence = 65 if parsed["is_valid"] else 40
        scam_indicators = ["Number format invalid for Bangladesh mobile network"] if not parsed["is_valid"] else []
        complaints = 0
        profile = {
            "mobile_number": parsed["international"],
            "verified_name": "Not Available (Private identity requires owner consent)",
            "age": "Not Available",
            "address": "Not Available",
            "city": "Bangladesh" if parsed["is_valid"] else "Unknown",
            "latitude": 23.8103,
            "longitude": 90.4125,
            "mobile_operator": parsed["operator"],
            "format_valid": parsed["is_valid"],
            "number_verification_status": "Format Valid — Unverified External Number" if parsed["is_valid"] else "Invalid Format",
            "account_verification_status": "Verification Unavailable",
            "public_risk_info": "No verified public scam reports. Private subscriber & transaction records are never accessed without authorization.",
            "last_verified_at": now.isoformat(),
            "is_demo_data": False,
            "scenario_label": "Live Validation & User-Authorized Ledger Check",
        }

    risk_level = classify_risk(risk_score)

    risk_factors = [
        {"factor": "Number Format & Carrier Validation", "score": 5 if parsed["is_valid"] else 45, "severity": "low" if parsed["is_valid"] else "medium", "explanation": f"Detected carrier prefix: {parsed['operator']}."},
        {"factor": "Account & Identity Verification", "score": 10 if profile["account_verification_status"] == "Verified" else (42 if "Pending" in profile["account_verification_status"] else 80), "severity": "low" if profile["account_verification_status"] == "Verified" else "medium", "explanation": f"Status: {profile['account_verification_status']}."},
        {"factor": "Verified Complaint & Scam Signals", "score": min(95, complaints * 18), "severity": "high" if complaints >= 3 else ("medium" if complaints >= 1 else "low"), "explanation": f"{complaints} verified complaint/flag indicator(s) recorded."},
        {"factor": "Authorized Transaction Patterns", "score": min(95, suspicious_count * 30 + (10 if total_tx > 0 else 15)), "severity": "high" if suspicious_count > 0 and risk_score >= 70 else ("medium" if suspicious_count > 0 else "low"), "explanation": f"{total_tx} authorized/demo transaction(s) analyzed; {suspicious_count} flagged."},
    ]

    recommended_action = (
        "Hold & Escalate — Multiple high-risk indicators detected. Verify out-of-band before sending funds."
        if risk_score >= 70
        else ("Request Verification — Incomplete verification or moderate velocity anomaly." if risk_score >= 31 else "Low Risk — Safe to proceed under standard monitoring.")
    )

    evidence_sources = [
        {
            "source_name": "BD Telecom Prefix Validator",
            "source_type": "Verified Deterministic Check",
            "verification_status": "Verified" if parsed["is_valid"] else "Failed",
            "last_checked": now.isoformat(),
            "confidence": "High (100%)",
            "details": f"Validated {parsed['international']} -> {parsed['operator']}.",
        },
        {
            "source_name": "Authenticated User Transaction Ledger",
            "source_type": "Authorized User Data",
            "verification_status": "Verified",
            "last_checked": now.isoformat(),
            "confidence": "High",
            "details": f"Matched {len(matched_user_txs)} record(s) belonging exclusively to {user.email}.",
        },
        {
            "source_name": "FraudShield Judge Demo & Consented Registry" if demo_entry else "Public Threat & Privacy Gate",
            "source_type": "DEMO DATA (Synthetic)" if demo_entry else "Privacy Control",
            "verification_status": profile["account_verification_status"],
            "last_checked": now.isoformat(),
            "confidence": f"{confidence}%",
            "details": profile["public_risk_info"],
        },
    ]

    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="RECIPIENT_PHONE_LOOKUP",
        resource_type="recipient_phone",
        resource_id=mask_account(local),
        details={"risk_score": risk_score, "demo_mode": bool(demo_entry)},
    )

    return {
        "profile": profile,
        "risk_analysis": {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "confidence": confidence,
            "complaints_count": complaints,
            "scam_indicators": scam_indicators,
            "recommended_action": recommended_action,
            "risk_factors": risk_factors,
        },
        "transaction_intelligence": {
            "total_transactions": total_tx,
            "total_volume": total_vol,
            "frequency_label": f"{total_tx} tx in recent window" if total_tx else "No accessible transactions",
            "suspicious_relationships": suspicious_count,
            "previous_recipients": previous_recipients,
            "transactions": tx_rows,
            "privacy_notice": "Displays only transactions owned by your account, authorized providers, or clearly labelled DEMO DATA. Never accesses private stranger records.",
        },
        "evidence_sources": evidence_sources,
    }


@router.post("/bank")
def bank_account_lookup(
    payload: BankLookupRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    check_rate_limit(f"bank-lookup:{user.id}", max_requests=30, window_seconds=60)
    digits = re.sub(r"\D", "", payload.account_number.strip())
    if len(digits) < 4:
        raise HTTPException(status_code=400, detail="Enter a valid bank account number (minimum 4 digits).")

    masked_acct = mask_account(digits)
    last4 = digits[-4:]
    now = _now_utc()

    connector = (
        db.query(Connector)
        .filter(Connector.user_id == user.id, Connector.institution_code == payload.bank_code)
        .first()
    )
    demo_bank = DEMO_BANK_ACCOUNTS.get(digits)

    user_txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.tx_timestamp.desc())
        .all()
    )
    matched_txs = [
        t
        for t in user_txs
        if (last4 in t.recipient_account_masked)
        or (payload.bank_name.lower() in (t.source_institution or "").lower() and last4 in t.recipient_account_masked)
    ]

    if demo_bank:
        verification_status = demo_bank["verification_status"]
        holder_name = demo_bank["account_holder"]
        account_type = payload.account_type or demo_bank["account_type"]
        risk_score = demo_bank["risk_score"]
        complaints = demo_bank["complaints"]
        indicators = demo_bank["indicators"]
        is_demo = True
    elif connector and connector.connection_status == "Connected" and connector.masked_account and last4 in connector.masked_account:
        verification_status = "Verified"
        holder_name = payload.account_holder_name or user.full_name
        account_type = payload.account_type or "Connected Sandbox Account"
        risk_score = 15.0
        complaints = 0
        indicators = ["Matched user's own connected sandbox bank connector"]
        is_demo = True
    else:
        verification_status = "Verification Unavailable"
        holder_name = "Not Available (Unauthorized external bank account)"
        account_type = payload.account_type or "Not Available"
        risk_score = max((t.risk_score for t in matched_txs), default=32.0)
        complaints = sum(1 for t in matched_txs if t.risk_score >= 70)
        indicators = [
            "Real bank account holder verification requires an authorized open-banking API.",
            f"{len(matched_txs)} matching record(s) found in your own transaction ledger.",
        ]
        is_demo = False

    risk_level = classify_risk(risk_score)
    risk_factors = [
        {"factor": "Bank Account Verification Status", "score": 10 if verification_status == "Verified" else (48 if "Pending" in verification_status else 75), "severity": "low" if verification_status == "Verified" else "medium", "explanation": f"Account status: {verification_status}."},
        {"factor": "Prior Fraud Complaints & Watchlist", "score": min(95, complaints * 20), "severity": "high" if complaints >= 3 else ("medium" if complaints >= 1 else "low"), "explanation": f"{complaints} complaint/risk hit(s) in authorized/demo records."},
        {"factor": "Connector & Ledger Relationship", "score": 15 if connector and connector.connection_status == "Connected" else 35, "severity": "low" if connector and connector.connection_status == "Connected" else "medium", "explanation": f"Institution connector status: {connector.connection_status if connector else 'Not Connected'}."},
    ]

    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="BANK_ACCOUNT_LOOKUP",
        resource_type="bank_account",
        resource_id=f"{payload.bank_code}:{masked_acct}",
        details={"verification_status": verification_status, "risk_score": risk_score},
    )

    return {
        "bank_code": payload.bank_code,
        "bank_name": payload.bank_name,
        "masked_account": masked_acct,
        "account_verification_status": verification_status,
        "account_holder_name": holder_name,
        "account_type": account_type,
        "verified_at": now.isoformat(),
        "is_demo_data": is_demo,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "complaints_count": complaints,
        "risk_indicators": indicators,
        "risk_factors": risk_factors,
        "matched_transactions": [
            {
                "tx_ref": t.tx_ref,
                "date": (t.tx_timestamp if t.tx_timestamp.tzinfo else t.tx_timestamp.replace(tzinfo=timezone.utc)).strftime("%Y-%m-%d"),
                "amount": t.amount,
                "currency": t.currency,
                "source_institution": t.source_institution,
                "status": t.status,
                "risk_score": t.risk_score,
            }
            for t in matched_txs
        ],
        "evidence_sources": [
            {
                "source_name": f"{payload.bank_name} Connector / Open-Banking Gate",
                "source_type": "DEMO DATA" if is_demo else "Privacy-Enforced Verification Gate",
                "verification_status": verification_status,
                "last_checked": now.isoformat(),
                "confidence": "High" if is_demo else "Limited (No Direct Bank API)",
                "details": "Never collects banking passwords, PINs, or OTPs.",
            }
        ],
    }


@router.post("/ai-report")
async def generate_ai_intelligence_report(
    payload: AIReportRequest,
    user: User = Depends(get_current_user),
    _=Depends(verify_csrf_if_cookie_auth),
    db: Session = Depends(get_db),
):
    if not payload.consent_granted:
        raise HTTPException(
            status_code=400,
            detail="Explicit user privacy consent is required before generating an AI intelligence report.",
        )

    check_rate_limit(f"ai-report:{user.id}", max_requests=20, window_seconds=60)
    top_factors = "; ".join(f"{f.get('factor')}: {f.get('explanation')}" for f in payload.factors[:4])

    if settings.OPENAI_API_KEY.strip():
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY.strip()}"},
                    json={
                        "model": settings.OPENAI_MODEL,
                        "temperature": 0.2,
                        "max_tokens": 220,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are FraudShield's financial risk analyst. Summarize masked recipient risk concisely in 3 bullet points with clear security advice. Never claim unverified facts.",
                            },
                            {
                                "role": "user",
                                "content": f"Type: {payload.subject_type}, Masked ID: {payload.masked_identifier}, Score: {payload.risk_score}/100 ({payload.risk_level}), Status: {payload.verification_status}. Factors: {top_factors}",
                            },
                        ],
                    },
                )
            if resp.status_code == 200:
                ai_text = resp.json()["choices"][0]["message"]["content"]
                return {
                    "summary": ai_text,
                    "engine": f"OpenAI ({settings.OPENAI_MODEL})",
                    "source_type": "AI-Generated Analysis (External OpenAI API)",
                    "disclaimer": "AI-generated summary based strictly on consented masked telemetry. Not verified financial evidence.",
                }
        except Exception:
            pass

    # Honest local fallback when OPENAI_API_KEY is not configured
    action_advice = (
        "Do NOT transfer funds until identity is verified out-of-band."
        if payload.risk_score >= 70
        else ("Proceed carefully and confirm recipient identity directly." if payload.risk_score >= 31 else "No major risk anomalies observed in authorized records.")
    )
    fallback_text = (
        f"AI Risk Summary ({payload.risk_level} — {payload.risk_score}/100):\n"
        f"• Verification Status: {payload.verification_status} for masked target {payload.masked_identifier}.\n"
        f"• Key Signals: {top_factors or 'Baseline format and authorization checks evaluated.'}\n"
        f"• Security Recommendation: {action_advice}"
    )

    write_audit_log(
        db,
        user_id=user.id,
        actor_email=user.email,
        action="AI_RECIPIENT_REPORT_GENERATED",
        resource_type=payload.subject_type,
        resource_id=payload.masked_identifier,
    )

    return {
        "summary": fallback_text,
        "engine": "FraudShield Local Explainable Summarizer",
        "source_type": "AI-Generated Analysis (Local Engine — set OPENAI_API_KEY in .env for OpenAI GPT)",
        "disclaimer": "AI-generated analysis based only on authorized masked data — never treated as verified banking proof.",
    }
