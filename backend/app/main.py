from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from loguru import logger
import time
import sys

from app.core.config import settings
from app.core.database import init_db
from app.core.redis_client import get_redis, close_redis
from app.api.v1.router import api_router
from app.api.ws import router as ws_router
from app.tasks.background_tasks import setup_scheduler, shutdown_scheduler
from app.scripts.seed import seed_database

# Configure loguru
logger.remove()
logger.add(sys.stdout, format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{line} | {message}", level="INFO")
logger.add("logs/salon_saas_{time:YYYY-MM-DD}.log", rotation="1 day", retention="30 days", level="DEBUG")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    from app.core.ws_manager import appointment_sync

    logger.info("Starting SalonSaaS API...")

    # On Vercel there's no long-running process between requests, so the
    # in-process scheduler, WebSocket backplane, and startup seeding either
    # can't function or would re-run on every cold start. Schema/data setup
    # runs once via `alembic upgrade head` / scripts.seed in CI/deploy instead,
    # and the scheduled jobs move to Vercel Cron (see app/api/v1/cron.py).
    if not settings.IS_SERVERLESS:
        await init_db()
        await seed_database()

    redis = await get_redis()   # optional — warns and continues if Redis unavailable

    backplane_task = None
    if not settings.IS_SERVERLESS:
        setup_scheduler()

        # Start Redis backplane for multi-worker WebSocket fan-out
        if redis:
            backplane_task = asyncio.create_task(
                appointment_sync.start_backplane(redis),
                name="ws_backplane",
            )
            logger.info("WS backplane task started")

    logger.info("SalonSaaS API started successfully")
    yield

    logger.info("Shutting down SalonSaaS API...")
    if backplane_task:
        backplane_task.cancel()
        try:
            await backplane_task
        except asyncio.CancelledError:
            pass
    await close_redis()
    if not settings.IS_SERVERLESS:
        shutdown_scheduler()


app = FastAPI(
    title="SalonSaaS API",
    description="Enterprise Salon Management SaaS Platform",
    version="1.0.0",
    docs_url="/docs" if settings.APP_DEBUG else None,
    redoc_url="/redoc" if settings.APP_DEBUG else None,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted hosts (security hardening in production)
if not settings.APP_DEBUG:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["salonsaas.com", "*.salonsaas.com"])


@app.middleware("http")
async def request_timing_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(round(process_time * 1000, 2))
    return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error",
            "errors": [
                {
                    "field": " -> ".join(str(loc) for loc in err["loc"]),
                    "message": err["msg"],
                }
                for err in exc.errors()
            ],
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


app.include_router(api_router)
app.include_router(ws_router)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "environment": settings.APP_ENV,
    }


@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.APP_NAME} API", "docs": "/docs"}
