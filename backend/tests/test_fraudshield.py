import asyncio
import os
import sys
from pathlib import Path

import httpx
import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{BACKEND_ROOT / 'test_fraudshield.db'}"

from app.db.database import Base, SessionLocal, engine  # noqa: E402
from app.db.seed import seed_initial_data  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    test_db = BACKEND_ROOT / "test_fraudshield.db"
    if test_db.exists():
        test_db.unlink()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield
    engine.dispose()
    if test_db.exists():
        test_db.unlink()


def _run(coro):
    return asyncio.run(coro)


async def _login_headers(client: httpx.AsyncClient, email: str, password: str) -> dict:
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health_and_seeded_login():
    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            r = await client.get("/api/health")
            assert r.status_code == 200
            assert r.json()["status"] == "ok"

            headers = await _login_headers(client, "srabon@finsphere.ai", "FraudShield#2026")
            me = await client.get("/api/v1/auth/me", headers=headers)
            assert me.status_code == 200
            assert me.json()["role"] == "admin"

    _run(run())


def test_user_registration_isolation_and_rbac():
    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            reg = await client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Test User Isolation",
                    "email": "isolated@finsphere.ai",
                    "password": "StrongPassword!99",
                },
            )
            assert reg.status_code == 201, reg.text
            iso_headers = await _login_headers(client, "isolated@finsphere.ai", "StrongPassword!99")

            # Isolated user must have 0 transactions (strict owner isolation)
            tx_resp = await client.get("/api/v1/transactions?range=all", headers=iso_headers)
            assert tx_resp.status_code == 200
            assert tx_resp.json()["analytics"]["total_transactions"] == 0

            # Isolated user cannot access admin transaction #1 directly
            admin_tx = await client.get("/api/v1/transactions/1", headers=iso_headers)
            assert admin_tx.status_code == 404

            # Regular user cannot update roles (RBAC)
            rbac_attempt = await client.patch(
                "/api/v1/users/1",
                json={"role": "admin"},
                headers=iso_headers,
            )
            assert rbac_attempt.status_code == 403

    _run(run())


def test_transaction_filters_analytics_and_exports():
    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers = await _login_headers(client, "srabon@finsphere.ai", "FraudShield#2026")

            tx_7d = (await client.get("/api/v1/transactions?range=7d", headers=headers)).json()
            tx_30d = (await client.get("/api/v1/transactions?range=30d", headers=headers)).json()
            tx_all = (await client.get("/api/v1/transactions?range=all", headers=headers)).json()

            assert tx_7d["analytics"]["total_transactions"] == 6
            assert tx_30d["analytics"]["total_transactions"] == 10
            assert tx_all["analytics"]["total_transactions"] == 13
            assert (
                tx_7d["analytics"]["total_volume"]
                < tx_30d["analytics"]["total_volume"]
                < tx_all["analytics"]["total_volume"]
            )

            csv_resp = await client.get("/api/v1/transactions/export/csv?range=7d", headers=headers)
            assert csv_resp.status_code == 200
            assert "Transaction ID,Date,Time" in csv_resp.text

            pdf_resp = await client.get("/api/v1/transactions/export/pdf?range=7d", headers=headers)
            assert pdf_resp.status_code == 200
            assert pdf_resp.content.startswith(b"%PDF-1.4")

    _run(run())


def test_statement_upload_validation_and_deduplication():
    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers = await _login_headers(client, "srabon@finsphere.ai", "FraudShield#2026")
            csv_content = (
                "tx_ref,date,amount,type,recipient,recipient_account,source_institution,status\n"
                "UP-CSV-001,2026-11-17 14:20:00,15000,Transfer,Karim Traders,01711009988,bKash,Completed\n"
                "UP-CSV-002,2026-11-16 02:15:00,95000,Cash Out,Unknown Agent,01999887766,Nagad,Completed\n"
            ).encode("utf-8")

            up1 = await client.post(
                "/api/v1/transactions/upload-statement",
                data={"institution": "bKash"},
                files={"file": ("bkash_statement.csv", csv_content, "text/csv")},
                headers=headers,
            )
            assert up1.status_code == 200, up1.text
            assert up1.json()["imported_count"] == 2
            assert up1.json()["skipped_duplicates"] == 0

            # Re-uploading same CSV must deduplicate
            up2 = await client.post(
                "/api/v1/transactions/upload-statement",
                data={"institution": "bKash"},
                files={"file": ("bkash_statement.csv", csv_content, "text/csv")},
                headers=headers,
            )
            assert up2.status_code == 200
            assert up2.json()["imported_count"] == 0
            assert up2.json()["skipped_duplicates"] == 2

            # Invalid extension rejected
            up_bad = await client.post(
                "/api/v1/transactions/upload-statement",
                data={"institution": "bKash"},
                files={"file": ("evil.exe", b"MZ", "application/octet-stream")},
                headers=headers,
            )
            assert up_bad.status_code == 400

    _run(run())


def test_dashboard_devices_connectors_and_session_revocation():
    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers = await _login_headers(client, "srabon@finsphere.ai", "FraudShield#2026")

            dash = await client.get("/api/v1/dashboard/overview?ip_address=103.21.244.0", headers=headers)
            assert dash.status_code == 200
            assert dash.json()["intel"]["risk_score"] == 85
            assert dash.json()["intel"]["risk_level"] == "High Risk"

            devices = (await client.get("/api/v1/devices", headers=headers)).json()["items"]
            assert any(d["sim_operator"] == "Not Available" for d in devices)

            conns = (await client.get("/api/v1/connectors", headers=headers)).json()["items"]
            codes = {c["institution_code"] for c in conns}
            assert {"city_bank", "dbbl", "bkash", "nagad", "upay"}.issubset(codes)

            conn_res = await client.post(
                "/api/v1/connectors/upay/connect",
                json={"masked_account": "01712345678", "is_sandbox": True},
                headers=headers,
            )
            assert conn_res.status_code == 200
            assert conn_res.json()["connection_status"] == "Connected"
            assert conn_res.json()["masked_account"].endswith("5678")

            sessions = (await client.get("/api/v1/sessions", headers=headers)).json()["items"]
            current = next(s for s in sessions if s["is_current"])
            wrong_pw = await client.post(
                f"/api/v1/sessions/{current['id']}/revoke",
                json={"password": "wrong"},
                headers=headers,
            )
            assert wrong_pw.status_code == 403

            revoke_ok = await client.post(
                f"/api/v1/sessions/{current['id']}/revoke",
                json={"password": "FraudShield#2026"},
                headers=headers,
            )
            assert revoke_ok.status_code == 200

            after_revoke = await client.get("/api/v1/auth/me", headers=headers)
            assert after_revoke.status_code == 401

    _run(run())


def test_three_tier_risk_engine_and_assistant():
    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers = await _login_headers(client, "srabon@finsphere.ai", "FraudShield#2026")

            # Assistant chat guidance
            chat = await client.post(
                "/api/v1/assistant/chat",
                json={"message": "Explain 3-Tier Risk Thresholds"},
                headers=headers,
            )
            assert chat.status_code == 200
            assert "AUTO_APPROVED" in chat.json()["reply"]
            assert "PENDING_USER_APPROVAL" in chat.json()["reply"]
            assert "AUTO_REJECTED" in chat.json()["reply"]

            # Tier 1: Low Risk (25%) -> AUTO_APPROVED
            t1 = await client.post(
                "/api/v1/transactions",
                json={
                    "amount": 2500,
                    "recipient_name": "DESCO",
                    "recipient_account": "01711001122",
                    "source_institution": "bKash",
                    "simulated_risk_score": 25,
                },
                headers=headers,
            )
            assert t1.status_code == 201, t1.text
            assert t1.json()["tier"] == "AUTO_APPROVED"
            assert t1.json()["status"] == "Completed"

            # Tier 2: Medium Risk (65%) -> PENDING_USER_APPROVAL -> Approve
            t2 = await client.post(
                "/api/v1/transactions",
                json={
                    "amount": 42000,
                    "recipient_name": "Merchant X",
                    "recipient_account": "01855992211",
                    "source_institution": "City Bank",
                    "simulated_risk_score": 65,
                },
                headers=headers,
            )
            assert t2.status_code == 201
            assert t2.json()["tier"] == "PENDING_USER_APPROVAL"
            assert t2.json()["status"] == "Pending Review"

            dec = await client.post(
                f"/api/v1/transactions/{t2.json()['id']}/tier-decision",
                json={"action": "APPROVE"},
                headers=headers,
            )
            assert dec.status_code == 200
            assert dec.json()["status"] == "Approved by User"

            # Tier 3: High Risk (92%) -> AUTO_REJECTED
            t3 = await client.post(
                "/api/v1/transactions",
                json={
                    "amount": 145000,
                    "recipient_name": "Offshore Wallet",
                    "recipient_account": "01999884433",
                    "source_institution": "BRAC Bank",
                    "ip_address": "103.21.244.0",
                    "simulated_risk_score": 92,
                },
                headers=headers,
            )
            assert t3.status_code == 201
            assert t3.json()["tier"] == "AUTO_REJECTED"
            assert t3.json()["status"] == "Auto-Rejected"

            # Recipient Phone / Bank Account Risk Lookup
            high_lk = await client.get("/api/v1/intelligence/recipient-lookup?query=01999884433", headers=headers)
            assert high_lk.status_code == 200
            assert high_lk.json()["risk_summary"]["risk_percentage"] >= 80
            assert high_lk.json()["person_profile"]["valid_person"] is False
            assert high_lk.json()["risk_summary"]["prior_high_risk_count"] >= 1

            ok_lk = await client.get("/api/v1/intelligence/recipient-lookup?query=01711889900", headers=headers)
            assert ok_lk.status_code == 200
            assert ok_lk.json()["person_profile"]["valid_person"] is True
            assert ok_lk.json()["person_profile"]["full_name"].startswith("Rahim Enterprise")
            assert ok_lk.json()["risk_summary"]["risk_percentage"] <= 30

            ext_lk = await client.get("/api/v1/intelligence/recipient-lookup?query=01555123456", headers=headers)
            assert ext_lk.status_code == 200
            assert ext_lk.json()["input_type"] == "BD Mobile / MFS Number"

    _run(run())


def test_recipient_intelligence_center_and_bank_lookup():
    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers = await _login_headers(client, "srabon@finsphere.ai", "FraudShield#2026")

            # 1. Demo scenarios & 5 team profiles
            scen = await client.get("/api/v1/recipient-intel/scenarios", headers=headers)
            assert scen.status_code == 200
            phones = {p["phone"] for p in scen.json()["team_profiles"]}
            assert {"01782670589", "01858500761", "01788930055", "01776277356", "01315244948"}.issubset(phones)

            # 2. Phone Intelligence for Srabon (01782670589) & +880 format
            ph1 = await client.get("/api/v1/recipient-intel/phone?phone=%2B8801782670589", headers=headers)
            assert ph1.status_code == 200
            assert ph1.json()["profile"]["verified_name"] == "Srabon"
            assert ph1.json()["profile"]["mobile_operator"] == "Grameenphone"
            assert ph1.json()["risk_analysis"]["risk_level"] == "Low Risk"

            # 3. Unknown external number must NOT fabricate identity or age
            ph_ext = await client.get("/api/v1/recipient-intel/phone?phone=01612345678", headers=headers)
            assert ph_ext.status_code == 200
            assert ph_ext.json()["profile"]["age"] == "Not Available"
            assert ph_ext.json()["profile"]["account_verification_status"] == "Verification Unavailable"

            # 4. Bank Account Lookup (Verified Demo + Unavailable External)
            bk_ok = await client.post(
                "/api/v1/recipient-intel/bank",
                json={"bank_code": "brac_bank", "bank_name": "BRAC Bank", "account_number": "100234567890"},
                headers=headers,
            )
            assert bk_ok.status_code == 200
            assert bk_ok.json()["account_verification_status"] == "Verified"
            assert bk_ok.json()["masked_account"] == "********7890"

            bk_flag = await client.post(
                "/api/v1/recipient-intel/bank",
                json={"bank_code": "islami_bank", "bank_name": "Islami Bank Bangladesh", "account_number": "400999884491"},
                headers=headers,
            )
            assert bk_flag.status_code == 200
            assert bk_flag.json()["account_verification_status"] == "Not Verified"
            assert bk_flag.json()["risk_score"] >= 80

            # 5. AI Report requires explicit consent
            ai_no = await client.post(
                "/api/v1/recipient-intel/ai-report",
                json={
                    "subject_type": "phone",
                    "masked_identifier": "****0589",
                    "risk_score": 12,
                    "risk_level": "Low Risk",
                    "verification_status": "Verified",
                    "consent_granted": False,
                },
                headers=headers,
            )
            assert ai_no.status_code == 400

            ai_ok = await client.post(
                "/api/v1/recipient-intel/ai-report",
                json={
                    "subject_type": "phone",
                    "masked_identifier": "****0589",
                    "risk_score": 12,
                    "risk_level": "Low Risk",
                    "verification_status": "Verified",
                    "consent_granted": True,
                },
                headers=headers,
            )
            assert ai_ok.status_code == 200
            assert "Low Risk" in ai_ok.json()["summary"]

    _run(run())
