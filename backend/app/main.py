from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import (
    assistant,
    auth,
    connectors,
    dashboard,
    devices,
    intelligence,
    policies,
    services,
    sessions,
    transactions,
    users,
)
from app.core.config import get_settings
from app.db.database import Base, SessionLocal, engine
from app.db.seed import seed_initial_data

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
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


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": settings.APP_NAME}


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
