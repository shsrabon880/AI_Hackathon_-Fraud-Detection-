import json
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.agents.orchestrator import run_agentic_decision_workflow
from app.core.security import hash_password
from app.ml.risk_engine import score_transaction
from app.models.models import (
    AuditLog,
    Connector,
    Device,
    IPIntelligence,
    RiskAssessment,
    SecurityAlert,
    SecurityPolicy,
    ServiceHealth,
    Transaction,
    User,
)


CONNECTOR_CATALOG = [
    ("city_bank", "City Bank", "bank", "OAuth 2.0 / Statement Upload"),
    ("dbbl", "Dutch-Bangla Bank Limited", "bank", "API Sandbox / Statement Upload"),
    ("dhaka_bank", "Dhaka Bank", "bank", "Statement Upload / Open API"),
    ("islami_bank", "Islami Bank Bangladesh", "bank", "Statement Upload / Open API"),
    ("trust_bank", "Trust Bank", "bank", "Statement Upload / Open API"),
    ("ebl", "Eastern Bank Limited (EBL)", "bank", "OAuth 2.0 / Statement Upload"),
    ("brac_bank", "BRAC Bank", "bank", "OAuth 2.0 / Statement Upload"),
    ("bank_asia", "Bank Asia", "bank", "Statement Upload / Open API"),
    ("prime_bank", "Prime Bank", "bank", "Statement Upload / Open API"),
    ("scb_bd", "Standard Chartered Bangladesh", "bank", "Open Banking Sandbox / CSV"),
    ("bkash", "bKash", "mfs", "Authorized MFS Sandbox / Statement"),
    ("nagad", "Nagad", "mfs", "Authorized MFS Sandbox / Statement"),
    ("rocket", "Rocket (DBBL MFS)", "mfs", "Authorized MFS Sandbox / Statement"),
    ("upay", "upay", "mfs", "Authorized MFS Sandbox / Statement"),
]


def ensure_user_connectors(db: Session, user_id: int, connect_defaults: bool = False) -> None:
    existing = {
        c.institution_code
        for c in db.query(Connector).filter(Connector.user_id == user_id).all()
    }
    now = datetime.now(timezone.utc)
    default_connected = {"city_bank", "brac_bank", "bkash", "nagad"}
    for code, name, cat, method in CONNECTOR_CATALOG:
        if code in existing:
            continue
        is_conn = connect_defaults and code in default_connected
        db.add(
            Connector(
                user_id=user_id,
                institution_code=code,
                institution_name=name,
                category=cat,
                connection_status="Connected" if is_conn else "Not Connected",
                connection_method=method,
                is_sandbox=True,
                masked_account=f"****{1200 + len(name) * 17}"[-8:] if is_conn else None,
                data_sources_json=json.dumps(["Transaction History", "Account Statements", "Balance Metadata"]),
                last_sync_at=now - timedelta(minutes=12) if is_conn else None,
            )
        )
    db.commit()


def seed_initial_data(db: Session) -> None:
    """Seed realistic synthetic DEMO DATA if database is empty."""
    now = datetime.now(timezone.utc)

    # 1. Service Health records
    services_data = [
        ("financial_sync", "Financial Data Synchronization", "Synchronizes authorized bank/MFS connectors and validates statement schemas.", "Healthy", 24, 148),
        ("tx_monitor", "Transaction Monitoring Service", "Real-time transaction stream ingestion, deduplication, and 7d/30d indexing.", "Healthy", 14, 1240),
        ("fraud_detection", "Fraud Detection Engine", "Hybrid rule + behavioral anomaly evaluator classifying Low/Medium/High risk.", "Healthy", 19, 1240),
        ("ip_intel", "IP Intelligence Service", "Evaluates VPN, TOR, hosting data center, ASN, and abuse confidence metadata.", "Healthy", 31, 312),
        ("ai_risk", "AI Risk Analysis Service", "Explainable ML feature attribution & controlled agentic decision orchestration.", "Healthy", 28, 418),
        ("notification", "Security Notification Service", "Dispatches in-app security alerts for high-risk transfers and unknown logins.", "Healthy", 11, 64),
        ("statement_parser", "Statement Processing Service", "Validates, parses, and deduplicates uploaded CSV/PDF bank & MFS statements.", "Healthy", 42, 29),
    ]
    for s_name, d_name, desc, st, lat, proc in services_data:
        if not db.query(ServiceHealth).filter(ServiceHealth.service_name == s_name).first():
            db.add(
                ServiceHealth(
                    service_name=s_name,
                    display_name=d_name,
                    description=desc,
                    status=st,
                    latency_ms=lat,
                    last_run_at=now - timedelta(minutes=2),
                    records_processed=proc,
                )
            )

    # 2. Demo IP Intelligence records (Matching Image 1 + clean Dhaka + medium SG)
    ips_data = [
        {
            "ip_address": "103.21.244.0",
            "risk_score": 85,
            "risk_level": "High Risk",
            "country": "Russia",
            "country_code": "RU",
            "region": "Moscow",
            "city": "Moscow",
            "latitude": 55.7558,
            "longitude": 37.6173,
            "asn": "AS12389",
            "isp_org": "Global Layer B.V.",
            "connection_type": "Data Center",
            "usage_type": "Hosting",
            "domain": "globallayer.net",
            "timezone": "Europe/Moscow",
            "local_time_label": "May 20, 2024 11:45 AM",
            "ip_age": "3 months",
            "last_seen": "Just now",
            "vpn_proxy": True,
            "tor_node": True,
            "hosting_dc": True,
            "known_attacker": False,
            "spam_source": True,
            "abuse_confidence": "High",
            "anonymous_ip_severity": "High",
            "recent_abuse_severity": "High",
            "bot_activity_severity": "Medium",
            "unusual_traffic_severity": "Medium",
            "velocity_checks_severity": "Low",
            "blacklist_status": "Listed",
            "recommendation_summary": "This IP address is highly likely to be involved in fraudulent or malicious activity.",
            "recommended_action": "Block this IP address.",
            "is_demo_data": True,
        },
        {
            "ip_address": "103.148.72.14",
            "risk_score": 14,
            "risk_level": "Low Risk",
            "country": "Bangladesh",
            "country_code": "BD",
            "region": "Dhaka Division",
            "city": "Dhaka",
            "latitude": 23.8103,
            "longitude": 90.4125,
            "asn": "AS58715",
            "isp_org": "Dhaka Fiber Residential ISP",
            "connection_type": "Residential",
            "usage_type": "Consumer ISP",
            "domain": "dhakafiber.bd",
            "timezone": "Asia/Dhaka",
            "local_time_label": "Local Standard Time (UTC+6)",
            "ip_age": "4 years",
            "last_seen": "5 mins ago",
            "vpn_proxy": False,
            "tor_node": False,
            "hosting_dc": False,
            "known_attacker": False,
            "spam_source": False,
            "abuse_confidence": "Low",
            "anonymous_ip_severity": "Low",
            "recent_abuse_severity": "Low",
            "bot_activity_severity": "Low",
            "unusual_traffic_severity": "Low",
            "velocity_checks_severity": "Low",
            "blacklist_status": "Clean",
            "recommendation_summary": "This residential IP exhibits normal local banking patterns with zero proxy or abuse indicators.",
            "recommended_action": "Allow standard monitoring.",
            "is_demo_data": True,
        },
        {
            "ip_address": "172.104.180.55",
            "risk_score": 52,
            "risk_level": "Medium Risk",
            "country": "Singapore",
            "country_code": "SG",
            "region": "Central Singapore",
            "city": "Singapore",
            "latitude": 1.3521,
            "longitude": 103.8198,
            "asn": "AS63949",
            "isp_org": "Akamai Connected Cloud",
            "connection_type": "VPN / Cloud",
            "usage_type": "Commercial VPN",
            "domain": "linodeusercontent.com",
            "timezone": "Asia/Singapore",
            "local_time_label": "UTC+8",
            "ip_age": "11 months",
            "last_seen": "1 hour ago",
            "vpn_proxy": True,
            "tor_node": False,
            "hosting_dc": True,
            "known_attacker": False,
            "spam_source": False,
            "abuse_confidence": "Medium",
            "anonymous_ip_severity": "Medium",
            "recent_abuse_severity": "Low",
            "bot_activity_severity": "Medium",
            "unusual_traffic_severity": "Medium",
            "velocity_checks_severity": "Low",
            "blacklist_status": "Clean",
            "recommendation_summary": "Commercial VPN / Cloud exit node detected. Confirm the user authorized this remote session.",
            "recommended_action": "Request additional verification.",
            "is_demo_data": True,
        },
    ]
    for ip_row in ips_data:
        if not db.query(IPIntelligence).filter(IPIntelligence.ip_address == ip_row["ip_address"]).first():
            db.add(IPIntelligence(**ip_row))

    db.commit()

    # 3. Demo Users (Admin + Standard User for strict isolation testing)
    if db.query(User).count() > 0:
        return

    admin_user = User(
        user_code="USR-1001",
        full_name="Srabon Rahman",
        email="srabon@finsphere.ai",
        phone_number="+8801782670589",
        country="Bangladesh",
        preferred_language="en",
        password_hash=hash_password("FraudShield#2026"),
        role="admin",
        status="active",
        email_verified=True,
        mfa_enabled=False,
        created_at=now - timedelta(days=120),
        last_login_at=now - timedelta(hours=2),
    )
    standard_user = User(
        user_code="USR-1002",
        full_name="Ayesha Siddiqua",
        email="ayesha@finsphere.ai",
        phone_number="+8801858500761",
        country="Bangladesh",
        preferred_language="en",
        password_hash=hash_password("AyeshaSafe#2026"),
        role="user",
        status="active",
        email_verified=True,
        mfa_enabled=False,
        created_at=now - timedelta(days=45),
        last_login_at=now - timedelta(days=1),
    )
    db.add_all([admin_user, standard_user])
    db.commit()
    db.refresh(admin_user)
    db.refresh(standard_user)

    db.add_all([
        SecurityPolicy(user_id=admin_user.id),
        SecurityPolicy(user_id=standard_user.id),
    ])
    db.commit()

    ensure_user_connectors(db, admin_user.id, connect_defaults=True)
    ensure_user_connectors(db, standard_user.id, connect_defaults=False)

    # 4. Seed Devices for admin_user (honest nulls for restricted mobile hardware/SIM fields)
    dev_trusted = Device(
        user_id=admin_user.id,
        device_fingerprint="fp_win11_chrome_92a1",
        device_name="Workstation Desktop (Windows)",
        device_model="Windows 11 PC",
        os="Windows 11",
        browser="Chrome 131",
        ip_address="103.148.72.14",
        approx_location="Dhaka, Bangladesh",
        battery_pct=None,
        sim_operator=None,
        phone_masked=None,
        trust_status="trusted",
        risk_score=12.0,
        unusual_tx_count=0,
        failed_auth_count=0,
        is_new_device=False,
        anomalies_json=json.dumps([]),
        login_history_json=json.dumps([
            {"time": (now - timedelta(hours=2)).isoformat(), "ip": "103.148.72.14", "location": "Dhaka, Bangladesh", "result": "Success"},
            {"time": (now - timedelta(days=2)).isoformat(), "ip": "103.148.72.14", "location": "Dhaka, Bangladesh", "result": "Success"},
        ]),
        last_active_at=now - timedelta(minutes=15),
    )
    dev_suspicious = Device(
        user_id=admin_user.id,
        device_fingerprint="fp_linux_tor_77f9",
        device_name="Unknown Linux Terminal",
        device_model="Generic x86_64 Client",
        os="Ubuntu Linux",
        browser="Firefox Privacy",
        ip_address="103.21.244.0",
        approx_location="Moscow, Russia (IP Approx)",
        battery_pct=None,
        sim_operator=None,
        phone_masked=None,
        trust_status="suspicious",
        risk_score=86.0,
        unusual_tx_count=2,
        failed_auth_count=4,
        is_new_device=True,
        anomalies_json=json.dumps([
            "New unknown device login",
            "IP & geographic location mismatch (Moscow vs Dhaka)",
            "TOR / Hosting Data Center exit node detected",
            "4 failed authentication attempts prior to session",
        ]),
        login_history_json=json.dumps([
            {"time": (now - timedelta(hours=5)).isoformat(), "ip": "103.21.244.0", "location": "Moscow, Russia", "result": "Flagged Login"},
        ]),
        last_active_at=now - timedelta(hours=5),
    )
    dev_mobile = Device(
        user_id=admin_user.id,
        device_fingerprint="fp_android_app_44b2",
        device_name="Samsung Galaxy S24 (Authorized App)",
        device_model="SM-S921B",
        os="Android 15",
        browser="FraudShield Mobile SDK",
        ip_address="172.104.180.55",
        approx_location="Singapore (VPN Approx)",
        battery_pct=78,  # Explicitly provided by authorized mobile app example
        sim_operator="Grameenphone (Authorized App)",
        phone_masked="****8821",
        trust_status="unverified",
        risk_score=48.0,
        unusual_tx_count=1,
        failed_auth_count=1,
        is_new_device=False,
        anomalies_json=json.dumps(["Commercial VPN detected during wallet transfer"]),
        login_history_json=json.dumps([
            {"time": (now - timedelta(days=1)).isoformat(), "ip": "172.104.180.55", "location": "Singapore", "result": "Step-Up Required"},
        ]),
        last_active_at=now - timedelta(days=1),
    )
    db.add_all([dev_trusted, dev_suspicious, dev_mobile])
    db.commit()
    db.refresh(dev_trusted)
    db.refresh(dev_suspicious)
    db.refresh(dev_mobile)

    # 5. Seed Realistic DEMO Transactions spanning 7d, 30d, and >30d
    demo_txs = [
        # Within Last 7 Days
        ("DEMO-TX-9001", now - timedelta(hours=5), 85000.0, "Transfer", "Srabon Rahman", "Alexey Volkov", "****4491", "BRAC Bank", "Offshore Exchange", "Flagged", dev_suspicious, "103.21.244.0", "Moscow, Russia", 55.7558, 37.6173, 85.0),
        ("DEMO-TX-9002", now - timedelta(hours=11), 42000.0, "Cash Out", "Srabon Rahman", "Unknown Agent 09", "****7732", "bKash", "bKash Agent", "Pending Review", dev_suspicious, "103.21.244.0", "Moscow, Russia", 55.7558, 37.6173, 85.0),
        ("DEMO-TX-9003", now - timedelta(days=1, hours=4), 18500.0, "Transfer", "Srabon Rahman", "TechGadgets BD", "****2210", "City Bank", "EBL", "Completed", dev_mobile, "172.104.180.55", "Singapore", 1.3521, 103.8198, 52.0),
        ("DEMO-TX-9004", now - timedelta(days=2), 3200.0, "Bill Pay", "Srabon Rahman", "DESCO Electricity", "****1104", "bKash", "DESCO", "Completed", dev_trusted, "103.148.72.14", "Dhaka, Bangladesh", 23.8103, 90.4125, 14.0),
        ("DEMO-TX-9005", now - timedelta(days=4), 6500.0, "Payment", "Srabon Rahman", "Shwapno Superstore", "****8831", "Nagad", "Nagad Merchant", "Completed", dev_trusted, "103.148.72.14", "Dhaka, Bangladesh", 23.8103, 90.4125, 14.0),
        ("DEMO-TX-9006", now - timedelta(days=6), 12000.0, "Transfer", "Srabon Rahman", "Nadia Rahman", "****5502", "BRAC Bank", "City Bank", "Failed", dev_trusted, "103.148.72.14", "Dhaka, Bangladesh", 23.8103, 90.4125, 14.0),
        # Within 8 - 30 Days
        ("DEMO-TX-9007", now - timedelta(days=12), 25000.0, "Transfer", "Srabon Rahman", "Nadia Rahman", "****5502", "City Bank", "BRAC Bank", "Completed", dev_trusted, "103.148.72.14", "Dhaka, Bangladesh", 23.8103, 90.4125, 14.0),
        ("DEMO-TX-9008", now - timedelta(days=18), 54000.0, "Payment", "Srabon Rahman", "CloudHost SG", "****9918", "City Bank", "International Card", "Pending Review", dev_mobile, "172.104.180.55", "Singapore", 1.3521, 103.8198, 52.0),
        ("DEMO-TX-9009", now - timedelta(days=24), 4800.0, "Payment", "Srabon Rahman", "Chaldal Groceries", "****3319", "bKash", "bKash Merchant", "Completed", dev_trusted, "103.148.72.14", "Dhaka, Bangladesh", 23.8103, 90.4125, 14.0),
        ("DEMO-TX-9010", now - timedelta(days=28), 15000.0, "Deposit", "Employer Payroll", "Srabon Rahman", "****1200", "BRAC Bank", "BRAC Bank", "Completed", dev_trusted, "103.148.72.14", "Dhaka, Bangladesh", 23.8103, 90.4125, 14.0),
        # Older than 30 Days (for All Transactions differentiation)
        ("DEMO-TX-9011", now - timedelta(days=42), 9500.0, "Transfer", "Srabon Rahman", "Nadia Rahman", "****5502", "Nagad", "bKash", "Completed", dev_trusted, "103.148.72.14", "Dhaka, Bangladesh", 23.8103, 90.4125, 14.0),
        ("DEMO-TX-9012", now - timedelta(days=58), 72000.0, "Transfer", "Srabon Rahman", "Alexey Volkov", "****4491", "City Bank", "Foreign Wire", "Flagged", dev_suspicious, "103.21.244.0", "Moscow, Russia", 55.7558, 37.6173, 85.0),
        ("DEMO-TX-9013", now - timedelta(days=75), 2100.0, "Bill Pay", "Srabon Rahman", "WASA Water", "****6102", "bKash", "Dhaka WASA", "Completed", dev_trusted, "103.148.72.14", "Dhaka, Bangladesh", 23.8103, 90.4125, 14.0),
    ]

    hist_amounts: list[float] = []
    hist_recipients: list[str] = []
    for ref, ts, amt, ttype, sender, rec, rec_acc, src_i, dst_i, st, dev, ip, loc, lat, lon, ip_risk in reversed(demo_txs):
        ml_res = score_transaction(
            amount=amt,
            tx_type=ttype,
            tx_timestamp=ts,
            recipient_account_masked=rec_acc,
            historical_amounts=hist_amounts,
            historical_recipients=hist_recipients,
            recent_tx_count_1h=2 if ip_risk >= 80 else 1,
            device_trust_status=dev.trust_status,
            is_new_device=dev.is_new_device,
            ip_risk_score=ip_risk,
            location_label=loc,
        )
        agent_res = run_agentic_decision_workflow(
            ml_score=ml_res["ml_score"],
            graph_score=62.0 if ip_risk >= 70 else 18.0,
            ip_risk_score=ip_risk,
            device_trust_status=dev.trust_status,
            amount=amt,
            feature_explanations=ml_res["feature_explanations"],
        )
        tx = Transaction(
            user_id=admin_user.id,
            device_id=dev.id,
            tx_ref=ref,
            tx_timestamp=ts,
            amount=amt,
            currency="BDT",
            tx_type=ttype,
            sender_name=sender,
            recipient_name=rec,
            recipient_account_masked=rec_acc,
            source_institution=src_i,
            dest_institution=dst_i,
            status=st,
            device_label=dev.device_name,
            ip_address=ip,
            location_label=loc,
            latitude=lat,
            longitude=lon,
            risk_score=agent_res["overall_score"],
            risk_level=agent_res["risk_level"],
            is_demo_data=True,
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

        db.add(
            RiskAssessment(
                transaction_id=tx.id,
                user_id=admin_user.id,
                ip_address=ip,
                overall_score=agent_res["overall_score"],
                risk_level=agent_res["risk_level"],
                ml_score=agent_res["ml_score"],
                graph_score=agent_res["graph_score"],
                rule_score=agent_res["rule_score"],
                indicators_json=json.dumps([f["label"] for f in ml_res["feature_explanations"] if f["severity"] != "low"]),
                feature_explanations_json=json.dumps(ml_res["feature_explanations"]),
                recommended_action=agent_res["recommended_action"],
                agent_rationale=agent_res["agent_rationale"],
            )
        )
        hist_amounts.append(amt)
        hist_recipients.append(rec_acc)

    # Seed security alerts & initial audit log
    db.add_all([
        SecurityAlert(
            user_id=admin_user.id,
            device_id=dev_suspicious.id,
            severity="critical",
            title="High-Risk TOR / Data Center Transfer Flagged (DEMO)",
            description="Transaction DEMO-TX-9001 (BDT 85,000) initiated from IP 103.21.244.0 (Moscow, Data Center/TOR) on an unverified Linux device.",
            status="open",
            is_demo_data=True,
        ),
        SecurityAlert(
            user_id=admin_user.id,
            device_id=dev_mobile.id,
            severity="medium",
            title="VPN Location Shift Detected (DEMO)",
            description="Commercial VPN exit IP in Singapore observed during City Bank transfer DEMO-TX-9003.",
            status="acknowledged",
            is_demo_data=True,
        ),
    ])
    db.add(
        AuditLog(
            user_id=admin_user.id,
            actor_email=admin_user.email,
            action="SYSTEM_SEED_DEMO_DATA",
            resource_type="database",
            resource_id="initial",
            ip_address="127.0.0.1",
            status="success",
            details_json=json.dumps({"note": "Synthetic DEMO DATA initialized for development"}),
        )
    )
    db.commit()
