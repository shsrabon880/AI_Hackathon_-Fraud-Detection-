import asyncio
import os
import sys
from pathlib import Path

import httpx
import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))
os.environ["DATABASE_URL"] = f"sqlite:///{BACKEND_ROOT / 'test_fraudshield.db'}"

from datetime import datetime, timedelta, timezone  # noqa: E402
from app.api.v1 import auth as auth_router  # noqa: E402
from app.db.database import Base, SessionLocal, engine  # noqa: E402
from app.db.seed import seed_initial_data  # noqa: E402
from app.main import app  # noqa: E402
from app.models.models import SignupEmailOTP, User  # noqa: E402


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
            for endpoint in ("/health", "/api/health", "/health/database", "/api/system/status"):
                r = await client.get(endpoint)
                assert r.status_code == 200, f"{endpoint}: {r.text}"

            headers = await _login_headers(client, "srabon@finsphere.ai", "FraudShield#2026")
            me = await client.get("/api/v1/auth/me", headers=headers)
            assert me.status_code == 200
            assert me.json()["role"] == "admin"

    _run(run())


def test_user_registration_isolation_and_rbac(monkeypatch):
    captured = {}

    def fake_send_otp(recipient_email: str, full_name: str, otp_code: str):
        captured[recipient_email] = otp_code

    monkeypatch.setattr(auth_router, "send_signup_otp_email", fake_send_otp)

    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            reg = await client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Test User Isolation",
                    "email": "isolated@finsphere.ai",
                    "password": "StrongPassword!99",
                    "confirm_password": "StrongPassword!99",
                },
            )
            assert reg.status_code == 201, reg.text
            assert reg.json()["verification_required"] is True
            assert "isolated@finsphere.ai" in captured
            assert captured["isolated@finsphere.ai"] not in reg.text

            # Verify OTP to activate account before login
            ver = await client.post(
                "/api/v1/auth/verify-signup-otp",
                json={"email": "isolated@finsphere.ai", "otp": captured["isolated@finsphere.ai"]},
            )
            assert ver.status_code == 200, ver.text

            bad_reg = await client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Fake Domain User",
                    "email": "fake@notarealdomain123456.invalid",
                    "password": "StrongPassword!99",
                    "confirm_password": "StrongPassword!99",
                },
            )
            assert bad_reg.status_code == 400
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


def test_signup_email_otp_verification_flow(monkeypatch):
    sent_otps = []

    def capture_email(recipient_email: str, full_name: str, otp_code: str):
        sent_otps.append((recipient_email, otp_code))

    monkeypatch.setattr(auth_router, "send_signup_otp_email", capture_email)

    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Invalid email format & password mismatch rejected
            bad_fmt = await client.post(
                "/api/v1/auth/register",
                json={"full_name": "Bad Email", "email": "not-an-email", "password": "Password#123", "confirm_password": "Password#123"},
            )
            assert bad_fmt.status_code == 422

            mismatch = await client.post(
                "/api/v1/auth/register",
                json={"full_name": "Mismatch User", "email": "otpuser@finsphere.ai", "password": "Password#123", "confirm_password": "Different#123"},
            )
            assert mismatch.status_code == 400

            # 2. Successful registration sends OTP (never returned in API response)
            r1 = await client.post(
                "/api/v1/auth/register",
                json={"full_name": "OTP Verified User", "email": "otpuser@finsphere.ai", "password": "Password#123", "confirm_password": "Password#123"},
            )
            assert r1.status_code == 201, r1.text
            assert r1.json()["verification_required"] is True
            assert len(sent_otps) == 1
            first_otp = sent_otps[-1][1]
            assert first_otp not in r1.text

            # 3. Duplicate email blocked (409)
            dup = await client.post(
                "/api/v1/auth/register",
                json={"full_name": "Dup", "email": "otpuser@finsphere.ai", "password": "Password#123", "confirm_password": "Password#123"},
            )
            assert dup.status_code == 409

            # 4. Login with unverified email must be blocked (403) without sending any Sign-In OTP
            unverified_login = await client.post(
                "/api/v1/auth/login",
                json={"email": "otpuser@finsphere.ai", "password": "Password#123"},
            )
            assert unverified_login.status_code == 403
            assert len(sent_otps) == 1  # No OTP sent on Sign In

            # 5. Incorrect OTP & Max 5 attempts lockout
            wrong_otp = "000000" if first_otp != "000000" else "999999"
            for i in range(4):
                fail_try = await client.post(
                    "/api/v1/auth/verify-signup-otp",
                    json={"email": "otpuser@finsphere.ai", "otp": wrong_otp},
                )
                assert fail_try.status_code == 400
            fifth_try = await client.post(
                "/api/v1/auth/verify-signup-otp",
                json={"email": "otpuser@finsphere.ai", "otp": wrong_otp},
            )
            assert fifth_try.status_code == 429

            # 6. Resend cooldown enforced (< 60s -> 429)
            cool_try = await client.post(
                "/api/v1/auth/resend-signup-otp",
                json={"email": "otpuser@finsphere.ai"},
            )
            assert cool_try.status_code == 429

            # Bypass cooldown in DB to test Resend + Expired + Valid + Reuse
            db = SessionLocal()
            try:
                user_obj = db.query(User).filter(User.email == "otpuser@finsphere.ai").first()
                latest = db.query(SignupEmailOTP).filter(SignupEmailOTP.user_id == user_obj.id).order_by(SignupEmailOTP.id.desc()).first()
                latest.resend_available_at = datetime.now(timezone.utc) - timedelta(seconds=5)
                db.commit()
            finally:
                db.close()

            resend_ok = await client.post(
                "/api/v1/auth/resend-signup-otp",
                json={"email": "otpuser@finsphere.ai"},
            )
            assert resend_ok.status_code == 200
            second_otp = sent_otps[-1][1]
            assert second_otp not in resend_ok.text

            # 7. Expired OTP check (mark expired, expect 400)
            db = SessionLocal()
            try:
                user_obj = db.query(User).filter(User.email == "otpuser@finsphere.ai").first()
                latest = db.query(SignupEmailOTP).filter(SignupEmailOTP.user_id == user_obj.id).order_by(SignupEmailOTP.id.desc()).first()
                latest.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
                db.commit()
            finally:
                db.close()

            expired_try = await client.post(
                "/api/v1/auth/verify-signup-otp",
                json={"email": "otpuser@finsphere.ai", "otp": second_otp},
            )
            assert expired_try.status_code == 400

            # Restore expiry and verify successfully
            db = SessionLocal()
            try:
                user_obj = db.query(User).filter(User.email == "otpuser@finsphere.ai").first()
                latest = db.query(SignupEmailOTP).filter(SignupEmailOTP.user_id == user_obj.id).order_by(SignupEmailOTP.id.desc()).first()
                latest.expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
                db.commit()
            finally:
                db.close()

            verify_ok = await client.post(
                "/api/v1/auth/verify-signup-otp",
                json={"email": "otpuser@finsphere.ai", "otp": second_otp},
            )
            assert verify_ok.status_code == 200
            assert verify_ok.json()["verified"] is True

            # 8. Reused OTP must fail
            reuse_try = await client.post(
                "/api/v1/auth/verify-signup-otp",
                json={"email": "otpuser@finsphere.ai", "otp": second_otp},
            )
            assert reuse_try.status_code == 400

            # 9. Normal Sign In with verified email works WITHOUT any OTP
            otp_count_before_login = len(sent_otps)
            login_ok = await client.post(
                "/api/v1/auth/login",
                json={"email": "otpuser@finsphere.ai", "password": "Password#123"},
            )
            assert login_ok.status_code == 200
            assert "access_token" in login_ok.json()
            assert len(sent_otps) == otp_count_before_login

            # 10. Existing seeded account logs in normally without OTP
            existing_ok = await client.post(
                "/api/v1/auth/login",
                json={"email": "srabon@finsphere.ai", "password": "FraudShield#2026", "remember_me": True},
            )
            assert existing_ok.status_code == 200
            assert "access_token" in existing_ok.json()
            assert len(sent_otps) == otp_count_before_login

    _run(run())


def test_boundary_risk_tiers_notifications_and_profile(monkeypatch):
    def fake_reset_email(recipient_email: str, full_name: str, otp_code: str):
        assert len(otp_code) == 6

    monkeypatch.setattr(auth_router, "send_password_reset_otp_email", fake_reset_email)

    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers = await _login_headers(client, "srabon@finsphere.ai", "FraudShield#2026")

            # Boundary tests: 29% (Low), 30% & 79% (Interactive), 80% & 100% (Auto-Rejected + No Override)
            for score, expected_tier in [
                (29, "AUTO_APPROVED"),
                (30, "PENDING_USER_APPROVAL"),
                (79, "PENDING_USER_APPROVAL"),
                (80, "AUTO_REJECTED"),
                (100, "AUTO_REJECTED"),
            ]:
                tx_r = await client.post(
                    "/api/v1/transactions",
                    json={
                        "amount": 12000,
                        "recipient_name": f"Boundary {score}",
                        "recipient_account": "01711001122",
                        "source_institution": "bKash",
                        "simulated_risk_score": score,
                    },
                    headers=headers,
                )
                assert tx_r.status_code == 201, tx_r.text
                assert tx_r.json()["tier"] == expected_tier
                if score >= 80:
                    override = await client.post(
                        f"/api/v1/transactions/{tx_r.json()['id']}/tier-decision",
                        json={"action": "APPROVE"},
                        headers=headers,
                    )
                    assert override.status_code == 403

            # Profile language persistence + Notification preferences
            prof = await client.patch(
                "/api/v1/auth/profile",
                json={"preferred_language": "ar", "country": "Bangladesh"},
                headers=headers,
            )
            assert prof.status_code == 200
            assert prof.json()["preferred_language"] == "ar"

            notifs = await client.get("/api/v1/notifications", headers=headers)
            assert notifs.status_code == 200
            assert len(notifs.json()["items"]) >= 1

    _run(run())
