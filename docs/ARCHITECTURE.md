# FinSphere AI – FraudShield: System & Data Engineering Architecture

## 1. End-to-End System Architecture
- **Frontend (`frontend/`)**: React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons + Recharts + Google Maps JavaScript API.
- **Backend (`backend/`)**: Python FastAPI + SQLAlchemy 2.0 + Pydantic v2 + Argon2id + PyJWT + PyOTP + NetworkX + PyPDF.
- **Database**: SQLite (`fraudshield.db`) for zero-config local execution with PostgreSQL-compatible SQLAlchemy ORM schema (`DATABASE_URL` configurable in `.env`).

## 2. 18-Stage Data Engineering Lifecycle
1. **Data Source Management**: `connectors` table tracks 13 Bangladesh Banks & MFS institutions (`bKash`, `Nagad`, `upay`, `City Bank`, `DBBL`, `BRAC Bank`, etc.) with explicit `is_sandbox` flags.
2. **Data Acquisition**: Authorized OAuth/Sandbox sync metadata and secure CSV/PDF statement upload endpoint (`/api/v1/transactions/upload-statement`).
3. **API-Based Data Ingestion**: `POST /api/v1/transactions` accepts Pydantic-validated financial events.
4. **Secure Statement Uploads**: Extension allowlist (`.csv`, `.pdf`), max 5 MB size cap, `%PDF-` magic byte verification.
5. **Data Extraction**: `backend/app/ingestion/statement_parser.py` extracts tabular CSV rows and regex-matched PDF ledger lines via `pypdf`.
6. **PDF & CSV Parsing**: Normalizes diverse header names (`tx_ref`, `trx_id`, `date`, `amount`, `debit`, `credit`).
7. **Data Cleaning**: Strips currency symbols, enforces positive monetary values, normalizes UTC timestamps.
8. **Data Enrichment**: Joins IP intelligence (`ip_intelligence`), device trust (`devices`), and historical transaction averages.
9. **Schema Validation**: Strict Pydantic v2 models (`TransactionCreateRequest`, `UserRegisterRequest`, etc.).
10. **Database Storage**: Parameterized SQLAlchemy ORM inserts with `(user_id, tx_ref)` unique constraint deduplication.
11. **Data Visualization**: Recharts daily volume/frequency charts, institution breakdowns, risk tier pie charts, and SVG graph network.
12. **Machine Learning Analysis**: Explainable additive risk scorer (`backend/app/ml/risk_engine.py`).
13. **Scheduling & Orchestration**: Controlled Agentic Orchestrator (`backend/app/agents/orchestrator.py`) + Service Health monitor (`service_health`).
14. **Real-Time Processing**: Synchronous per-transaction evaluation on ingest; upgrade path to Apache Kafka + Flink documented in `app/ml/` and `app/graph/`.
15. **Data Quality Monitoring**: Duplicate skip counts, upload error handling, and service health latency/processed counters.
16. **Data Lineage**: Every imported statement transaction stores `source_file_hash` (SHA-256) and `is_demo_data` provenance flag.
17. **Observability**: Immutable `audit_logs` table + `/api/v1/services` health checks.
18. **Privacy & Compliance**: Sensitive account/phone masking (`****1234`), zero credential storage (no bank passwords, MFS PINs, or OTPs), and strict `user_id` owner isolation.
