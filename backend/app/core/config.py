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
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

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
