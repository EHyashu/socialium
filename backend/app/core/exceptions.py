"""Application-wide exception classes and handlers."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class SocialiumError(Exception):
    """Base exception for the application."""
    status_code: int = 500
    detail: str = "Internal server error"

    def __init__(self, detail: str | None = None):
        self.detail = detail or self.detail
        super().__init__(self.detail)


class NotFoundError(SocialiumError):
    status_code = 404
    detail = "Resource not found"


class UnauthorizedError(SocialiumError):
    status_code = 401
    detail = "Unauthorized"


class ForbiddenError(SocialiumError):
    status_code = 403
    detail = "Forbidden"


class ConflictError(SocialiumError):
    status_code = 409
    detail = "Resource already exists"


class ValidationError(SocialiumError):
    status_code = 422
    detail = "Validation error"


class RateLimitError(SocialiumError):
    status_code = 429
    detail = "Rate limit exceeded"


class OAuthError(SocialiumError):
    status_code = 400
    detail = "OAuth error"


class PlatformConnectionError(SocialiumError):
    status_code = 502
    detail = "Failed to connect to platform"


class QuotaExceededError(SocialiumError):
    status_code = 403
    detail = "Plan quota exceeded"


class AIGenerationError(SocialiumError):
    status_code = 500
    detail = "AI generation failed"


def register_exception_handlers(app: FastAPI) -> None:
    """Register exception handlers on the FastAPI app."""

    @app.exception_handler(SocialiumError)
    async def socialium_exception_handler(
        request: Request, exc: SocialiumError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "error_type": type(exc).__name__},
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "error_type": type(exc).__name__},
        )
