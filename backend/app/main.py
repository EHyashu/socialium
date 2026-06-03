"""FastAPI application entry point with lifespan management."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.langfuse_setup import langfuse_health_check, langfuse_flush
from app.core.logging_setup import setup_logging
from app.core.qdrant_client import create_all_collections
from app.core.sentry_setup import setup_sentry
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.rate_limiter import RateLimiterMiddleware
from app.routers import (
    ab_testing,
    analytics,
    approvals,
    auth,
    auto_reply,
    content,
    memory,
    notifications,
    oauth,
    platforms,
    publish_management,
    scheduling,
    trends,
    whatsapp_webhook,
    twilio_webhook,
    platform_webhooks,
    workspace,
)
from app.services import (
    ab_testing_service,
    auto_reply_service,
    trend_detection_service,
    whatsapp_notification_service,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan - startup and shutdown events."""
    
    # Initialize Sentry FIRST (before any other initialization)
    setup_sentry()
    
    # Configure structured logging
    setup_logging(settings.app_env)
    
    print(f"Starting {settings.app_name} in {settings.app_env} mode")

    # ── Database Initialization ──
    from app.database import Base, engine
    # Import all models so they register on Base.metadata
    from app.models.user import User
    from app.models.workspace import Workspace
    from app.models.workspace_member import WorkspaceMember
    from app.models.content import Content
    from app.models.platform_account import PlatformAccount
    from app.models.approval import Approval
    from app.models.ab_test import ABTest
    from app.models.analytics import AnalyticsEvent
    from app.models.audience_activity import AudienceActivitySnapshot
    from app.models.notification import Notification
    from app.models.trend import Trend
    from app.models.viral_score import ViralScore

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Database tables verified/created successfully.")
    except Exception as e:
        print(f"Error during database initialization: {e}")

    # ── Qdrant collection setup ──
    try:
        create_all_collections()
        print("Qdrant collections verified")
    except Exception as e:
        print(f"Warning: Qdrant initialization failed: {e}")

    # ── APScheduler ──
    try:
        from celery_config import start_scheduler
        start_scheduler()
        print("Scheduler started")
    except Exception as e:
        print(f"Warning: Scheduler failed to start: {e}")

    # ── Langfuse health check (non-fatal) ──
    langfuse_health_check()

    yield

    # ── Shutdown ──
    print(f"Shutting down {settings.app_name}...")
    langfuse_flush()
    try:
        from celery_config import stop_scheduler
        stop_scheduler()
    except Exception:
        pass


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url, 
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https?://localhost:\d+|https?://127\.0\.0\.1:\d+" if settings.debug else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request ID middleware (must be added AFTER CORS)
app.add_middleware(RequestIDMiddleware)

# Rate limiting middleware (applied after CORS and Request ID)
app.add_middleware(RateLimiterMiddleware)

# Exception handlers
register_exception_handlers(app)

# Routers
api_prefix = settings.api_v1_prefix
app.include_router(auth.router, prefix=api_prefix)
app.include_router(workspace.router, prefix=api_prefix)
app.include_router(content.router, prefix=f"{api_prefix}/content", tags=["Content"])
app.include_router(platforms.router, prefix=f"{api_prefix}/platforms", tags=["Platforms"])
app.include_router(oauth.router, prefix=f"{api_prefix}/oauth", tags=["OAuth"])
app.include_router(approvals.router, prefix=f"{api_prefix}/approvals", tags=["Approvals"])
app.include_router(scheduling.router, prefix=f"{api_prefix}/scheduling", tags=["Scheduling"])
app.include_router(analytics.router, prefix=f"{api_prefix}/analytics", tags=["Analytics"])
app.include_router(memory.router, prefix=f"{api_prefix}/memory", tags=["Memory"])
app.include_router(notifications.router, prefix=f"{api_prefix}/notifications", tags=["Notifications"])
app.include_router(trends.router, prefix=f"{api_prefix}/trends", tags=["Trends"])
app.include_router(ab_testing.router, prefix=f"{api_prefix}/ab-testing", tags=["A/B Testing"])
app.include_router(auto_reply.router, prefix=f"{api_prefix}/auto-reply", tags=["Auto Reply"])
app.include_router(whatsapp_webhook.router, prefix=f"{api_prefix}/whatsapp", tags=["WhatsApp"])
app.include_router(twilio_webhook.router, prefix=f"{api_prefix}/twilio", tags=["Twilio"])
app.include_router(platform_webhooks.router, prefix=f"{api_prefix}/webhooks", tags=["Platform Webhooks"])
app.include_router(publish_management.router, prefix=f"{api_prefix}/publish", tags=["Publish Management"])
app.include_router(platform_webhooks.router, prefix=f"{api_prefix}/platforms", tags=["Platform Webhooks"])


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "SOCIALIUM API"}


@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.app_name} API"}
