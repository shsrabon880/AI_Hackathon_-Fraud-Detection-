from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded securely from environment variables."""

    APP_NAME: str = "FinSphere AI - FraudShield"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "sqlite:///./fraudshield.db"
    SECRET_KEY: str = "dev-secret-change-in-production-min-32-chars"
    ENCRYPTION_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    GOOGLE_MAPS_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    # Real email delivery for Sign-Up OTP verification
    RESEND_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True
    EMAIL_OTP_EXPIRE_SECONDS: int = 300
    EMAIL_OTP_RESEND_COOLDOWN_SECONDS: int = 60
    EMAIL_OTP_MAX_ATTEMPTS: int = 5

    # Security defaults
    MAX_UPLOAD_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB max statement upload
    DEFAULT_RATE_LIMIT_PER_MIN: int = 120
    LOGIN_RATE_LIMIT_PER_MIN: int = 15

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
