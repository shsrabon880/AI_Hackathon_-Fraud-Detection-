# FinSphere AI – FraudShield: Security Audit & Hardening Report

## 1. Enforced Security Controls (Verified in Codebase)
- **Password Storage:** `Argon2id` (`argon2-cffi`, time_cost=3, memory_cost=65536 KB, parallelism=4). Never stores plaintext passwords.
- **Sign-Up Email & Password Reset OTP Security:** Cryptographically generated via Python `secrets.randbelow`, stored solely as keyed HMAC-SHA256 hashes (`hash_otp`), single-use (`used_at`), 5-minute TTL, max 5 failed attempts, 60-second resend cooldown, and rate-limited. Never logged or returned in API responses.
- **Zero-Credential Policy:** FraudShield never asks for, transmits, logs, or persists banking login passwords, bKash/Nagad/upay wallet PINs, card CVVs, or third-party bank OTPs.
- **Session & CSRF Defense:** `PyJWT` HS256 access/refresh tokens validated against active DB `user_sessions.session_token_jti`; `HttpOnly`, `SameSite`, and environment-controlled `Secure` cookies; double-submit CSRF validation (`fs_csrf_token` + `X-CSRF-Token`).
- **Owner Isolation & IDOR Mitigation:** Every query filters by `current_user.id` derived strictly from the server-verified token/session; frontend-supplied user IDs are never trusted.
- **Injection & Upload Hardening:** SQLAlchemy parameterized ORM queries; strict Pydantic v2 validation; `.csv`/`.pdf` extension allowlist, 5 MB limit, `%PDF-` signature validation, and SHA-256 lineage tracking.
- **HTTP Headers & Safe Errors:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store`, sanitized global 500 error responses, and masked financial account labels (`****XXXX`).

## 2. Residual Risks & Operational Limitations
- **Local Development Windows Policy:** Host Windows Application Control policy may restrict unsigned `.pyd` extensions in local `.venv`; production runs cleanly on managed Linux containers (Render).
- **Rate Limiter Scope:** Current sliding-window rate limiter operates in-memory per worker process; horizontal multi-instance scaling requires upgrading `_rate_buckets` to distributed Redis.
- **Malware Scanning:** Uploaded CSV/PDF files undergo strict extension, size, signature, and parser checks; binary antivirus daemon scanning (e.g., ClamAV) is planned if multi-tenant file storage expands.
- **External Financial Holds:** Rejecting a transfer in FraudShield blocks pending authorization inside FraudShield; blocking real funds at external banks requires official Open Banking / MFS provider API webhooks.
