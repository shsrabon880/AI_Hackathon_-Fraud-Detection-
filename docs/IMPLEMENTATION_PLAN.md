# FinSphere AI – FraudShield: Technical Implementation Plan

## Execution Phases

1. **Phase 1 — Audit & Governance Documentation:** Author `PROJECT_AUDIT.md`, `IMPLEMENTATION_PLAN.md`, `SECURITY_AUDIT.md`, and `DEPLOYMENT_GUIDE.md` with honest classification of implemented vs. provider-dependent capabilities.
2. **Phase 2 — Cloud Readiness, PostgreSQL & Public Health APIs:** Add `psycopg[binary]` to `backend/requirements.txt`, configure PostgreSQL SSL/pooling in `database.py`, add `GZipMiddleware` & timing headers in `main.py`, implement `GET /health`, `GET /health/database`, `GET /api/system/status`, add `render.yaml`, and update `frontend/vercel.json`.
3. **Phase 3 — Registration, Login (`Remember Me`, `Forgot Password`) & Profile Management:** Extend `User` model (`phone_number`, `country`, `preferred_language`), enforce strong password rules, add `PasswordResetOTP` flow (`/forgot-password`, `/reset-password`), `/profile`, `/change-password`, and `/account` deletion.
4. **Phase 4 — Unified Smart Fraud Alert Engine & Connector Disclosure:** Align all backend/frontend thresholds strictly to `0–29%` (Low/Normal), `30–79%` (Interactive `CONFIRM` / `REJECT` Fraud Alert), and `80–100%` (Backend-enforced Auto-Reject + 5-second non-overridable countdown alert). Clarify `"Integration Not Available Yet"` on connectors lacking live open APIs.
5. **Phase 5 — Real-Time Notifications & SSE Stream:** Implement `notifications` & `notification_preferences` tables, `/api/v1/notifications/*` including SSE `/stream`, and a real-time Notification Center bell drawer.
6. **Phase 6 — 8-Language Localization & Arabic RTL:** Centralize `en`, `bn`, `zh`, `fr`, `es`, `ru`, `ar` (RTL), `de` translations, add Noto Sans Bengali / Arabic / SC fonts, and sync language preferences to user profiles.
7. **Phase 7 — Mobile Responsive UI & Route Code Splitting:** Add `React.lazy` + `Suspense` route splitting, mobile drawer + bottom navigation bar, and responsive transaction/dashboard views for `360px–1920px`.
8. **Phase 8 — Testing, Performance Measurement & Verification:** Update automated tests, measure before/after Vite bundle metrics (`PERFORMANCE_REPORT.md`), and verify live in browser.
