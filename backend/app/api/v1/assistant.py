from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.models import Connector, Device, SecurityAlert, Transaction, User
from app.schemas.schemas import AssistantChatRequest

router = APIRouter(prefix="/assistant", tags=["FraudShield AI Assistant"])


def _build_reply(prompt: str, user: User, db: Session) -> dict:
    q = (prompt or "").strip().lower()

    tx_count = db.query(Transaction).filter(Transaction.user_id == user.id).count()
    flagged_count = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id, Transaction.risk_score >= 50)
        .count()
    )
    open_alerts = (
        db.query(SecurityAlert)
        .filter(SecurityAlert.user_id == user.id, SecurityAlert.status == "open")
        .count()
    )
    connected_count = (
        db.query(Connector)
        .filter(Connector.user_id == user.id, Connector.connection_status == "Connected")
        .count()
    )
    device_count = db.query(Device).filter(Device.user_id == user.id).count()

    if any(k in q for k in ("threshold", "tier", "approve", "alarm", "50", "80", "92", "score", "risk")):
        answer = (
            "FraudShield uses a 3-Tier Automated Risk Approval Engine:\n"
            "• Tier 1 — Low Risk (0–50%): Automatically approved (AUTO_APPROVED) in <50ms with a non-blocking emerald toast and logged as Completed.\n"
            "• Tier 2 — Medium-High Risk (50–79%): Pauses the transaction (PENDING_USER_APPROVAL) and opens a full-site prompt asking 'Are you approve or not?'. Choose 'Approve' to trust it or 'Not Approve' to block and flag the device.\n"
            "• Tier 3 — Critical Risk (80–100%): Immediately auto-rejects & freezes the transfer (AUTO_REJECTED), locks suspicious session activity, sounds the Web Audio security alarm, and displays the full-screen FRAUD ALERT takeover."
        )
    elif any(k in q for k in ("how", "work", "architecture", "ml", "graph", "engine", "explain")):
        answer = (
            f"End-to-End FraudShield Pipeline (Your account currently monitors {tx_count} transactions and {device_count} devices):\n"
            "1. Ingestion & Normalization: Validates API transfers or uploaded CSV/PDF bank & MFS statements with SHA-256 lineage and duplicate checks.\n"
            "2. Explainable ML Risk Scorer: Evaluates 8 features (amount Z-score, 1-hour velocity, IP reputation, device trust, geo anomaly, recipient history, odd-hour timing, channel risk) with point-by-point reason codes.\n"
            "3. Graph Mule & Ring Detection: NetworkX graph maps relationships across banks, wallets, devices, IPs, and recipients to catch fan-out hubs and shared devices.\n"
            "4. Controlled Agentic Decisioning: Routes each score into Tier 1, Tier 2, or Tier 3 while requiring human approval for critical actions."
        )
    elif any(k in q for k in ("sidebar", "page", "navigate", "section", "menu", "users", "services", "sessions", "devices")):
        answer = (
            "Sidebar Navigation Guide:\n"
            "• Dashboard: Live IP telemetry, 0–100 Risk Gauge, Google Maps Location panel, Risk Indicators, and 3-Tier Simulator buttons.\n"
            "• System Users: RBAC user profiles, security posture, and admin role/status controls.\n"
            "• Devices: Fingerprints, IP/location mismatches, failed logins, and honest 'Not Available' markers when browser APIs restrict SIM/phone/battery.\n"
            "• Connectors: Link Bangladesh banks (City Bank, BRAC, DBBL, EBL, etc.) and MFS wallets (bKash, Nagad, upay) via Sandbox or CSV/PDF—never stores PINs or passwords.\n"
            "• Services: Real-time health & latency for all 7 FraudShield backend services.\n"
            "• Security Policies: Enable TOTP MFA, brute-force lockout, and alert thresholds.\n"
            "• Sessions: Inspect active logins and revoke sessions (requires password re-auth).\n"
            "• Transaction History: Filter Last 7 Days / 30 Days / All, inspect Explainable AI reason codes, and export PDF/CSV statements."
        )
    elif any(k in q for k in ("connect", "bank", "bkash", "nagad", "upay", "statement", "download", "export", "csv", "pdf")):
        answer = (
            f"Financial Connections & Statements (You currently have {connected_count} connected institution(s)):\n"
            "• To Connect a Bank or MFS Wallet: Go to 'Connectors', click 'Connect', and enter only a masked label (last 4 digits). FraudShield NEVER asks for banking passwords, bKash/Nagad/upay PINs, or OTPs.\n"
            "• To Import Statements: Click 'Statement' on any connector card or 'Import CSV/PDF' in Transaction History. Duplicate transaction references are automatically skipped.\n"
            "• To Download Statements: Open 'Transaction History', pick 'Last 7 Days', 'Last 30 Days', or 'All Transactions', and click 'Export CSV' or 'Export PDF'."
        )
    elif any(k in q for k in ("vault", "mfa", "lock", "security", "policy", "policies", "password")):
        answer = (
            f"Security Vault & Policies (MFA is currently {'ENABLED' if user.mfa_enabled else 'NOT ENABLED'}, {open_alerts} open alert(s)):\n"
            "• Open 'Security Policies' in the sidebar to generate a Fernet-encrypted TOTP MFA key and verify a 6-digit authenticator code.\n"
            "• Adjust Max Failed Login Attempts, Lockout Minutes, Session Timeout, and High-Risk Thresholds.\n"
            "• All passwords are hashed with Argon2id, mutations are CSRF-protected, and every sensitive action is recorded in 'Audit Logs'."
        )
    else:
        answer = (
            f"Hello {user.full_name}! I'm FraudShield Assistant. Right now your account is monitoring {tx_count} transactions "
            f"({flagged_count} medium/high risk, {open_alerts} open alert(s), {connected_count} connected institution(s)).\n"
            "Ask me about:\n"
            "• How Streaming ML + Graph Mule Detection works\n"
            "• 3-Tier Risk Thresholds (0–50% Auto-Approve, 50–79% Prompt, 80%+ FRAUD ALERT)\n"
            "• How to use any sidebar page, enable MFA, or export PDF/CSV statements."
        )

    return {
        "reply": answer,
        "source": "FraudShield Built-in Intelligence Engine",
        "account_snapshot": {
            "transactions": tx_count,
            "flagged": flagged_count,
            "open_alerts": open_alerts,
            "connected_accounts": connected_count,
            "mfa_enabled": user.mfa_enabled,
        },
    }


@router.post("/chat")
def chat_with_assistant(
    payload: AssistantChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _build_reply(payload.message, user, db)
