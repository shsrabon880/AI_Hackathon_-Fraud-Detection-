# FinSphere AI – FraudShield: Cloud Deployment & Operations Guide

## 1. Target Cloud Architecture
- **Frontend Hosting:** Vercel (`https://aihackathon-fraud-detection-fronten.vercel.app/`) with `frontend/vercel.json` rewriting `/api/(.*)` and `/health*` over HTTPS to Render.
- **Backend Hosting:** Render Managed Web Service (`https://ai-hackathon-fraud-detection.onrender.com`), running `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- **Database:** Managed PostgreSQL (Render PostgreSQL, Neon, or Supabase) connected via `DATABASE_URL` (`postgresql+psycopg://...`).

## 2. Required Production Environment Variables (Render Dashboard)
Never commit real secrets to Git. Configure only in Render Dashboard → Environment:
- `ENVIRONMENT=production`
- `DATABASE_URL=<Managed PostgreSQL Connection URI with sslmode=require>`
- `SECRET_KEY=<64+ char random secret>`
- `ENCRYPTION_KEY=<Fernet 32-byte base64 key>`
- `ALLOWED_ORIGINS=https://aihackathon-fraud-detection-fronten.vercel.app`
- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=none` *(or `lax` when proxied through Vercel domain)*
- `RESEND_API_KEY=<Resend key>` *(or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`)*
- `OPENAI_API_KEY=<Optional OpenAI API Key>`

## 3. Health Checks & Rollback Procedures
- **Liveness Check:** `GET /health`
- **Database Connectivity Check:** `GET /health/database` (`SELECT 1` verification)
- **System Telemetry Status:** `GET /api/system/status`
- **Rollback:** Render & Vercel retain immutable deployment snapshots; use **"Rollback to previous deploy"** in Render or **Instant Rollback** in Vercel if a release fails health verification.
- **Automated Backups:** Enable scheduled daily snapshots in Managed PostgreSQL provider (Neon/Render Postgres) and verify restore drills quarterly.
