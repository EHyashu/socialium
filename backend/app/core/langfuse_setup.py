"""Langfuse observability setup — centralized initialization for LLM tracing.

This module provides:
1. Langfuse-wrapped OpenAI clients (drop-in replacement that auto-traces all calls)
2. The @observe() decorator for creating trace hierarchies
3. A health-check function called at startup
4. A flush function called at shutdown

Usage:
    from app.core.langfuse_setup import get_openai_client, observe, langfuse_flush

    @observe(name="my-operation")
    async def my_function():
        client = get_openai_client()
        response = await client.chat.completions.create(...)
        return response

Best practices (per Langfuse skill):
- Import langfuse BEFORE OpenAI so the wrapper can patch properly
- Use descriptive trace names (e.g., "content-generation", "viral-scoring")
- Token usage is tracked automatically by the drop-in replacement
- Call langfuse_flush() on shutdown to ensure all events are sent
"""

import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── Determine if Langfuse is configured ──────────────────────────────────────
_langfuse_enabled = bool(settings.langfuse_public_key and settings.langfuse_secret_key)

# ─── Import strategy: use Langfuse-wrapped OpenAI if configured ───────────────
# Per Langfuse docs: import from langfuse.openai instead of openai
# This automatically captures model, tokens, cost, latency on every call.

if _langfuse_enabled:
    try:
        from langfuse.openai import AsyncOpenAI as _AsyncOpenAI  # noqa: F401
        from langfuse import observe as _observe  # noqa: F401
        from langfuse import get_client as _get_langfuse_client

        # Initialize global Langfuse client with credentials
        # The env vars are read automatically, but we set them explicitly for safety
        import os
        os.environ.setdefault("LANGFUSE_PUBLIC_KEY", settings.langfuse_public_key)
        os.environ.setdefault("LANGFUSE_SECRET_KEY", settings.langfuse_secret_key)
        os.environ.setdefault("LANGFUSE_HOST", settings.langfuse_base_url)

        logger.info("Langfuse tracing enabled — OpenAI calls will be auto-traced")
        _TRACING_ACTIVE = True

    except ImportError:
        logger.warning("langfuse package not installed — tracing disabled")
        from openai import AsyncOpenAI as _AsyncOpenAI  # noqa: F401
        _TRACING_ACTIVE = False
        _observe = None
        _get_langfuse_client = None
else:
    from openai import AsyncOpenAI as _AsyncOpenAI  # noqa: F401
    _TRACING_ACTIVE = False
    _observe = None
    _get_langfuse_client = None
    logger.info("Langfuse not configured — tracing disabled")


# ─── Public API ───────────────────────────────────────────────────────────────

def get_openai_client(**kwargs: Any) -> "_AsyncOpenAI":
    """Get an AsyncOpenAI client (Langfuse-wrapped if tracing is enabled).

    Automatically captures:
    - Model name
    - Token usage (prompt_tokens, completion_tokens, total_tokens)
    - Latency
    - Cost (USD)
    - Input/output messages
    """
    if "api_key" not in kwargs:
        kwargs["api_key"] = settings.openai_api_key
    return _AsyncOpenAI(**kwargs)


def observe(name: str | None = None, **kwargs: Any):
    """Decorator to create a Langfuse trace/span for a function.

    Falls back to a no-op decorator if Langfuse is not configured.

    Usage:
        @observe(name="content-generation")
        async def generate_content(...):
            ...
    """
    if _observe is not None:
        return _observe(name=name, **kwargs)
    else:
        # No-op decorator
        def noop_decorator(func):
            return func
        return noop_decorator


def is_tracing_enabled() -> bool:
    """Check if Langfuse tracing is active."""
    return _TRACING_ACTIVE


def langfuse_health_check() -> bool:
    """Validate Langfuse connection at startup. Returns True if healthy."""
    if not _langfuse_enabled or _get_langfuse_client is None:
        return False
    try:
        client = _get_langfuse_client()
        result = client.auth_check()
        if result:
            logger.info(f"Langfuse connected: {settings.langfuse_base_url}")
        else:
            logger.warning(
                "Langfuse auth check returned False — "
                "verify LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY"
            )
        return result
    except Exception as e:
        logger.warning(f"Langfuse health check failed (non-fatal): {e}")
        return False


def langfuse_flush() -> None:
    """Flush all pending Langfuse events. Call on shutdown."""
    if _get_langfuse_client is None:
        return
    try:
        client = _get_langfuse_client()
        client.flush()
        logger.info("Langfuse events flushed")
    except Exception as e:
        logger.debug(f"Langfuse flush failed: {e}")


def langfuse_score(
    trace_id: str,
    name: str,
    value: float | int | str,
    comment: str | None = None,
) -> None:
    """Send a score to Langfuse linked to a trace (e.g., approval feedback).

    Per project requirements: approval feedback (approve/reject) must be
    sent as scores linked to the original generation trace ID.
    """
    if _get_langfuse_client is None:
        return
    try:
        client = _get_langfuse_client()
        client.score(
            trace_id=trace_id,
            name=name,
            value=value,
            comment=comment,
        )
    except Exception as e:
        logger.debug(f"Langfuse score submission failed: {e}")
