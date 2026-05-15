"""Application configuration using pydantic-settings."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "Socialium"
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    secret_key: str = "change-me-in-production"
    api_v1_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/socialium"
    database_echo: bool = False

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "change-me-jwt-secret"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # Encryption
    encryption_key: str = "change-me-32-byte-encryption-key!!"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-large"

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-sonnet-20241022"

    # Groq (Fallback LLM)
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"

    # WhatsApp (WapiHub)
    wapihub_api_key: str = ""
    wapihub_url: str = "https://app.whapihub.com/api/v2/whatsapp-business"
    wapihub_webhook_secret: str = ""

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""

    # Langfuse
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_base_url: str = "https://cloud.langfuse.com"

    # PostHog
    posthog_api_key: str = ""
    posthog_host: str = "https://us.i.posthog.com"
    posthog_project_id: str = ""
    posthog_personal_api_key: str = ""

    # Celery / APScheduler
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Social Platform OAuth
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    linkedin_redirect_uri: str = "http://localhost:3000/platforms"
    twitter_client_id: str = ""
    twitter_client_secret: str = ""
    instagram_client_id: str = ""
    instagram_client_secret: str = ""
    facebook_app_id: str = ""
    facebook_app_secret: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # Frontend
    frontend_url: str = "http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def qdrant_collections(self) -> dict[str, int]:
        """Qdrant collections and their vector dimensions."""
        return {
            "brand_memory": 3072,
            "successful_content": 3072,
            "rejected_patterns": 3072,
            "hook_library": 3072,
            "content_drafts": 3072,
        }


# Required env vars per environment
_REQUIRED_ALWAYS = [
    "supabase_url",
    "supabase_anon_key",
    "supabase_service_role_key",
    "supabase_jwt_secret",
    "database_url",
]

_REQUIRED_PRODUCTION = [
    *_REQUIRED_ALWAYS,
    "openai_api_key",
    "stripe_secret_key",
    "stripe_webhook_secret",
    "encryption_key",
    "redis_url",
]


class StartupConfigError(SystemExit):
    """Raised when required env vars are missing at startup."""

    def __init__(self, missing: list[str]):
        vars_str = ", ".join(missing)
        super().__init__(
            f"\n\n❌ MISSING REQUIRED ENV VARS: {vars_str}\n"
            f"Set them in .env or your environment before starting.\n"
        )


def _validate_settings(s: Settings) -> None:
    """Validate required settings are present. Crash immediately if not."""
    required = _REQUIRED_PRODUCTION if s.is_production else _REQUIRED_ALWAYS
    missing: list[str] = []
    for var in required:
        val = getattr(s, var, "")
        if not val or val in (
            "change-me-in-production",
            "change-me-jwt-secret",
            "change-me-32-byte-encryption-key!!",
        ):
            # In dev mode, only flag truly empty vars (allow placeholder secrets)
            if s.is_production or not val:
                missing.append(var.upper())
    if missing:
        raise StartupConfigError(missing)


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings with validation."""
    s = Settings()
    _validate_settings(s)
    return s
