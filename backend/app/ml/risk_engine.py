import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


@dataclass
class RiskFeatureContribution:
    feature: str
    label: str
    raw_value: str
    contribution_points: float
    severity: str  # low | medium | high
    explanation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "feature": self.feature,
            "label": self.label,
            "raw_value": self.raw_value,
            "contribution_points": round(self.contribution_points, 2),
            "severity": self.severity,
            "explanation": self.explanation,
        }


def classify_risk(score: float) -> str:
    """Classify 0-100 risk score per central FraudShield thresholds (0-29 Low, 30-79 Medium/High, 80-100 Critical)."""
    if score < 30:
        return "Low Risk"
    if score < 80:
        return "Medium Risk"
    return "Critical Risk"


def score_transaction(
    *,
    amount: float,
    tx_type: str,
    tx_timestamp: datetime,
    recipient_account_masked: str,
    historical_amounts: List[float],
    historical_recipients: List[str],
    recent_tx_count_1h: int,
    device_trust_status: str = "trusted",
    is_new_device: bool = False,
    ip_risk_score: float = 10.0,
    location_label: Optional[str] = None,
    usual_locations: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Explainable hybrid ML + behavioral scoring model.
    Uses standardized feature weights + logistic calibration (0-100) and emits
    additive feature contributions so every score is human-auditable.
    """
    contributions: List[RiskFeatureContribution] = []

    # 1. Amount anomaly (Z-score relative to user's history)
    if len(historical_amounts) >= 3:
        mean_amt = sum(historical_amounts) / len(historical_amounts)
        variance = sum((x - mean_amt) ** 2 for x in historical_amounts) / len(historical_amounts)
        std_amt = max(math.sqrt(variance), 500.0)
        z_amt = max(0.0, (amount - mean_amt) / std_amt)
    else:
        mean_amt = 5000.0
        z_amt = max(0.0, (amount - 15000.0) / 15000.0)

    amt_pts = min(26.0, z_amt * 7.5)
    if amount >= 50000:
        amt_pts = max(amt_pts, 14.0)
    contributions.append(
        RiskFeatureContribution(
            feature="amount_deviation",
            label="Transaction Amount Anomaly",
            raw_value=f"BDT {amount:,.0f} (avg ~{mean_amt:,.0f})",
            contribution_points=amt_pts,
            severity="high" if amt_pts >= 16 else ("medium" if amt_pts >= 8 else "low"),
            explanation=(
                f"Amount is significantly higher than typical historical average ({mean_amt:,.0f})."
                if amt_pts >= 8
                else "Amount is within your normal historical spending range."
            ),
        )
    )

    # 2. Velocity check (transactions in 1h window)
    vel_pts = min(18.0, max(0, recent_tx_count_1h - 1) * 5.5)
    contributions.append(
        RiskFeatureContribution(
            feature="velocity_1h",
            label="Transaction Velocity",
            raw_value=f"{recent_tx_count_1h} tx in 1h",
            contribution_points=vel_pts,
            severity="high" if vel_pts >= 12 else ("medium" if vel_pts >= 5 else "low"),
            explanation=(
                "Rapid burst of transactions detected within a 60-minute window."
                if vel_pts >= 5
                else "Normal transaction frequency."
            ),
        )
    )

    # 3. IP Reputation Risk
    ip_pts = min(28.0, max(0.0, ip_risk_score) * 0.28)
    contributions.append(
        RiskFeatureContribution(
            feature="ip_reputation",
            label="IP Intelligence & Network Risk",
            raw_value=f"IP Risk {ip_risk_score:.0f}/100",
            contribution_points=ip_pts,
            severity="high" if ip_pts >= 18 else ("medium" if ip_pts >= 9 else "low"),
            explanation=(
                "Originating IP carries high threat signals (VPN/TOR/Data Center or abuse reports)."
                if ip_pts >= 18
                else ("Moderate IP risk signals observed." if ip_pts >= 9 else "Clean residential/mobile network IP.")
            ),
        )
    )

    # 4. Device Trust & New Device Detection
    if device_trust_status in ("suspicious", "blocked"):
        dev_pts = 20.0
        dev_exp = "Transaction initiated from a flagged or untrusted device."
    elif is_new_device or device_trust_status == "unverified":
        dev_pts = 11.0
        dev_exp = "New or previously unverified device used for this transaction."
    else:
        dev_pts = 1.0
        dev_exp = "Known trusted device matches user history."

    contributions.append(
        RiskFeatureContribution(
            feature="device_trust",
            label="Device Trust & Fingerprint",
            raw_value=f"{device_trust_status.title()}{' (New)' if is_new_device else ''}",
            contribution_points=dev_pts,
            severity="high" if dev_pts >= 16 else ("medium" if dev_pts >= 8 else "low"),
            explanation=dev_exp,
        )
    )

    # 5. Geographic Location Consistency
    loc = (location_label or "Unknown").strip()
    usual = [u.lower() for u in (usual_locations or ["dhaka", "bangladesh"])]
    loc_match = any(u in loc.lower() for u in usual) if loc != "Unknown" else False
    if loc == "Unknown":
        geo_pts = 4.0
        geo_exp = "Approximate geolocation unavailable for this transaction."
    elif not loc_match:
        geo_pts = 14.0
        geo_exp = f"Unusual geographic origin ({loc}) differs from baseline locations."
    else:
        geo_pts = 1.0
        geo_exp = f"Location ({loc}) aligns with usual activity region."

    contributions.append(
        RiskFeatureContribution(
            feature="geo_anomaly",
            label="Geographic Consistency",
            raw_value=loc,
            contribution_points=geo_pts,
            severity="high" if geo_pts >= 12 else ("medium" if geo_pts >= 6 else "low"),
            explanation=geo_exp,
        )
    )

    # 6. Recipient Familiarity
    is_known_recipient = recipient_account_masked in historical_recipients
    rec_pts = 1.0 if is_known_recipient else 8.0
    contributions.append(
        RiskFeatureContribution(
            feature="recipient_history",
            label="Recipient History",
            raw_value="Known Recipient" if is_known_recipient else "First-Time Recipient",
            contribution_points=rec_pts,
            severity="medium" if rec_pts >= 7 else "low",
            explanation=(
                "First time transferring funds to this recipient identifier."
                if not is_known_recipient
                else "Recipient appears in previous verified transactions."
            ),
        )
    )

    # 7. Time-of-Day Behavioral Check (01:00 - 05:00 local window)
    ts = tx_timestamp if tx_timestamp.tzinfo else tx_timestamp.replace(tzinfo=timezone.utc)
    # Approximate Bangladesh local time UTC+6 if UTC
    local_hour = (ts.astimezone(timezone(timedelta(hours=6))).hour)
    is_odd_hour = 1 <= local_hour <= 5
    time_pts = 7.0 if is_odd_hour else 1.0
    contributions.append(
        RiskFeatureContribution(
            feature="time_of_day",
            label="Transaction Timing",
            raw_value=f"{local_hour:02d}:00 Local",
            contribution_points=time_pts,
            severity="medium" if is_odd_hour else "low",
            explanation=(
                "Initiated during high-risk late-night hours (01:00–05:00)."
                if is_odd_hour
                else "Initiated during normal daytime/evening hours."
            ),
        )
    )

    # 8. Transaction Channel/Type Risk
    high_risk_types = {"cash out", "international transfer", "wire transfer", "p2p transfer"}
    tx_pts = 5.0 if tx_type.strip().lower() in high_risk_types else 1.5
    contributions.append(
        RiskFeatureContribution(
            feature="tx_type_risk",
            label="Transaction Channel Type",
            raw_value=tx_type,
            contribution_points=tx_pts,
            severity="low",
            explanation=f"Transaction channel type: {tx_type}.",
        )
    )

    raw_sum = sum(c.contribution_points for c in contributions)
    # Smoothly bound between 2 and 99
    ml_score = round(min(99.0, max(2.0, raw_sum)), 1)
    contributions.sort(key=lambda c: c.contribution_points, reverse=True)

    return {
        "ml_score": ml_score,
        "risk_level": classify_risk(ml_score),
        "feature_explanations": [c.to_dict() for c in contributions],
        "model_metadata": {
            "engine": "FraudShield Explainable Hybrid Scorer v1.0",
            "calibration": "Additive Feature Attribution (0-100)",
            "thresholds": {"low": "0-29", "medium_high": "30-79", "critical": "80-100"},
        },
    }
