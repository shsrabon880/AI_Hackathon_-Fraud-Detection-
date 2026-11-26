# FinSphere AI – FraudShield: Project Audit Report

**Tagline:** Predict. Explain. Prevent. Protect.  
**Audit Date:** 2026-11-26  

---

## 1. Existing Stack & Architecture Inventory
- **Frontend (`frontend/`):** React 18.3, TypeScript 5.7, Vite 6.0, Tailwind CSS 3.4, React Router DOM 7.1, Recharts 2.15, Lucide React 0.468.
- **Backend (`backend/`):** Python FastAPI, Uvicorn, SQLAlchemy 2.0, Pydantic v2, Argon2-cffi, PyJWT, PyOTP, Cryptography (Fernet), NetworkX, pypdf, dnspython, mcp 2.3.0.
- **Database (`backend/app/db/`):** SQLAlchemy ORM on SQLite WAL (`fraudshield.db`), switchable to PostgreSQL via `DATABASE_URL`.
- **Deployment Config:** Frontend configured on Vercel (`frontend/vercel.json` rewriting `/api/(.*)` -> `https://ai-hackathon-fraud-detection.onrender.com/api/$1`). GitHub remote: `https://github.com/shsrabon880/Fraud-Detection.git`.

---

## 2. Requirements Classification Matrix (Pre-Upgrade Baseline)

| Requirement Area | Baseline Status | Audit Findings & Gaps |
|---|---|---|
| Core Fraud Dashboard, 8-Feature Scorer, NetworkX Graph, Statement Upload (CSV/PDF) | **ALREADY IMPLEMENTED** | Working and modular; needs alignment of `0–29%` vs `30–79%` vs `80–100%` tiers and pagination |
| Recipient Lookup (BD Phone & 10 Banks) + MCP Server | **ALREADY IMPLEMENTED** | Functional with consented demo data, anti-fabrication, and `mcp_server.py` |
| Cloud Server, Managed PostgreSQL & Health Endpoints | **PARTIALLY IMPLEMENTED** | Vercel + Render configs exist, but lacks `/health`, `/health/database`, `/api/system/status`, and `psycopg` driver in `requirements.txt` |
| Secure Sign Up & Email OTP Verification | **PARTIALLY IMPLEMENTED** | Email OTP & MX check exist, but Sign Up lacks `Phone Number`, `Country`, `Preferred Language`, and strong password complexity enforcement |
| Sign In (`Remember Me`, `Forgot Password`) & Profile Management | **PARTIALLY IMPLEMENTED** | Email + Password + TOTP MFA + Session Revocation work, but lacks `Remember Me`, `Forgot/Reset Password`, `Change Password`, `Profile Update`, and `Account Deletion` |
| User Data Isolation & Privacy | **ALREADY IMPLEMENTED** | Strict `user_id` ownership filtering across endpoints; extends cleanly to new notification/profile tables |
| Bank & MFS Account Connection (Zero-Credential Policy) | **PARTIALLY IMPLEMENTED** | 14 connectors & Zero-Credential Policy exist in sandbox; needs clearer `"Integration Not Available Yet"` disclosure for non-OAuth banks |
| Smart Fraud Alert (`0–29%`, `30–79%`, `80–100%` 5s Auto-Reject) | **PARTIALLY IMPLEMENTED** | 3-Tier modal + siren exist, but thresholds were `0–30%`/`31–79%` and Tier 3 lacked the 5-second automatic countdown & strict backend Confirm-override rejection |
| Real-Time Notifications Center (SSE / Preferences) | **NOT IMPLEMENTED** | Alerts table exists, but lacks unified Notification Center, user preferences, and SSE stream |
| Multi-Language Support (8 Languages + Arabic RTL) | **NOT IMPLEMENTED** | English-only UI; needs centralized translation dictionary, Arabic RTL, language persistence, and Bangla/Chinese/Arabic fonts |
| Responsive Desktop/Mobile Layout | **PARTIALLY IMPLEMENTED** | Tailwind grids adapt partially, but `Sidebar.tsx` lacks a mobile slide-over drawer / bottom navigation for `360px–390px` screens |
| Frontend/Backend Performance Optimization | **PARTIALLY IMPLEMENTED** | Initial JS bundle is `828.13 kB` single chunk; needs route-based `React.lazy`, GZip middleware, pagination, and DB indexes |
| Live External Bank/MFS OAuth & SMS Delivery | **NEEDS EXTERNAL PROVIDER** | Requires licensed Open Banking/MFS merchant credentials (`RESEND_API_KEY`/SMTP & external SMS gateway env vars) |
