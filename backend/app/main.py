from contextlib import asynccontextmanager
import time

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1 import (
    assistant,
    auth,
    connectors,
    dashboard,
    devices,
    intelligence,
    notifications,
    policies,
    recipient_intel,
    services,
    sessions,
    transactions,
    users,
)
from app.core.config import get_settings
from app.db.database import Base, SessionLocal, engine, ensure_sqlite_schema, get_db
from app.db.seed import seed_initial_data
from app.models.models import ServiceHealth

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_schema()
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Enterprise-grade AI-powered financial fraud detection & security platform.",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(elapsed_ms)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(Exception)
async def safe_error_handler(_request: Request, _exc: Exception):
    # Never leak stack traces or DB internals to clients
    return JSONResponse(status_code=500, content={"detail": "An unexpected internal error occurred."})


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": settings.APP_NAME, "version": "1.0.0"}


@app.get("/health/database")
def database_health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "unavailable"})


@app.get("/api/system/status")
def system_status(db: Session = Depends(get_db)):
    db_ok = True
    services_summary = []
    try:
        db.execute(text("SELECT 1"))
        services = db.query(ServiceHealth).order_by(ServiceHealth.id.asc()).all()
        services_summary = [
            {"name": s.service_name, "display_name": s.display_name, "status": s.status, "latency_ms": s.latency_ms}
            for s in services
        ]
    except Exception:
        db_ok = False

    return {
        "backend_status": "online",
        "database_connectivity": "connected" if db_ok else "unavailable",
        "api_version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "services": services_summary,
    }


API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(assistant.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(devices.router, prefix=API_PREFIX)
app.include_router(connectors.router, prefix=API_PREFIX)
app.include_router(transactions.router, prefix=API_PREFIX)
app.include_router(services.router, prefix=API_PREFIX)
app.include_router(policies.router, prefix=API_PREFIX)
app.include_router(sessions.router, prefix=API_PREFIX)
app.include_router(intelligence.router, prefix=API_PREFIX)
app.include_router(recipient_intel.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)
