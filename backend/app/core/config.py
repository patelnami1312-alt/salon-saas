from pydantic_settings import BaseSettings
from typing import List
from urllib.parse import quote_plus
import os
import secrets


class Settings(BaseSettings):
    # App
    APP_NAME: str = "SalonSaaS"
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    APP_DEBUG: bool = True
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database - PostgreSQL
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "salon_saas"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_SSL_REQUIRE: bool = False  # set True for Supabase / other hosted Postgres
    # True when connecting through Supabase's pgbouncer transaction-mode pooler
    # (port 6543). Disables asyncpg's prepared-statement cache, which pgbouncer
    # transaction mode does not support (causes "prepared statement already exists").
    DB_PGBOUNCER: bool = False

    # Set automatically by Vercel on every deployment — used to skip startup
    # work that doesn't make sense in a stateless serverless function
    # (in-process scheduler, WebSocket backplane, dev-only seeding).
    @property
    def IS_SERVERLESS(self) -> bool:
        return os.environ.get("VERCEL") == "1"

    # Vercel sends this as `Authorization: Bearer <CRON_SECRET>` on cron-triggered
    # requests (see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
    # Required in production so the cron endpoint can't be triggered by anyone else.
    CRON_SECRET: str = ""

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0
    REDIS_CACHE_TTL: int = 3600

    # Email
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@salonsaas.com"
    MAIL_FROM_NAME: str = "SalonSaaS"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False

    # SMS
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # Storage
    STORAGE_PROVIDER: str = "local"
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_BUCKET_NAME: str = ""
    AWS_REGION: str = "us-east-1"

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Loyalty
    LOYALTY_POINTS_PER_CURRENCY: float = 1.0
    LOYALTY_REDEEM_RATE: float = 0.01

    # AI
    ANTHROPIC_API_KEY: str = ""

    # Card terminal / payment gateway (optional — leave blank for manual card recording).
    # PAYMENT_GATEWAY_PROVIDER must match a key registered in app/services/terminal_service.py.
    # No adapter is implemented yet — see that file before setting this.
    PAYMENT_GATEWAY_PROVIDER: str = ""
    PAYMENT_GATEWAY_MERCHANT_ID: str = ""
    PAYMENT_GATEWAY_API_KEY: str = ""
    PAYMENT_GATEWAY_ENV: str = "sandbox"   # "sandbox" or "production"

    @property
    def PAYMENT_GATEWAY_ENABLED(self) -> bool:
        return bool(self.PAYMENT_GATEWAY_PROVIDER and self.PAYMENT_GATEWAY_API_KEY)

    # Stripe (online/manual card entry — no physical hardware required)
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    @property
    def STRIPE_ENABLED(self) -> bool:
        return bool(self.STRIPE_SECRET_KEY and self.STRIPE_PUBLISHABLE_KEY)

    # Super Admin
    SUPER_ADMIN_EMAIL: str = "admin@salonsaas.com"
    SUPER_ADMIN_PASSWORD: str = "Admin@12345"

    @property
    def DATABASE_URL(self) -> str:
        pwd = quote_plus(self.DB_PASSWORD)
        url = f"postgresql+psycopg2://{self.DB_USER}:{pwd}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        if self.DB_SSL_REQUIRE:
            url += "?sslmode=require"
        return url

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        pwd = quote_plus(self.DB_PASSWORD)
        url = f"postgresql+asyncpg://{self.DB_USER}:{pwd}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        if self.DB_SSL_REQUIRE:
            url += "?ssl=require"
        return url

    @property
    def REDIS_URL(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return [self.FRONTEND_URL, "http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
