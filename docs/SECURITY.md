# FinSphere AI – FraudShield: Security & Privacy Architecture (OWASP Aligned)

## Mandatory Security Controls Implemented
- **Password Hashing**: `Argon2id` (`argon2-cffi`, time_cost=3, memory_cost=65536, parallelism=4).
- **Multi-Factor Authentication (MFA)**: TOTP (`pyotp`) with secrets encrypted at rest via `Fernet` (`cryptography`).
- **Session Management**: JWT access/refresh tokens backed by `user_sessions` DB state (`jti` checked on every request) so session revocation takes effect immediately.
- **Re-Authentication**: Revoking individual sessions or logging out all other devices requires password verification.
- **CSRF Protection**: Double-submit `fs_csrf_token` cookie + `X-CSRF-Token` header enforcement on cookie-authenticated mutations.
- **Strict Owner Isolation & RBAC**: Every financial endpoint filters strictly by `current_user.id`; role updates are restricted to `admin` via `require_roles("admin")`.
- **Brute-Force & Rate Limiting**: Sliding-window per-IP rate limiting + per-user failed login lockout (`max_login_attempts`, `lockout_minutes`).
- **Security Headers & Safe Errors**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Cache-Control: no-store`, and sanitized 500 error responses (no stack traces leaked).
- **Honest Telemetry & Zero Credential Policy**:
  - Never collects or stores banking passwords, bKash/Nagad/upay PINs, or OTPs.
  - Browser sessions never fabricate SIM, phone number, or battery telemetry (`Not Available` displayed when inaccessible).
  - Approximate IP geolocation explicitly carries a privacy notice.
