"""Publish failure reason classifier — diagnoses WHY content failed to publish."""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


class PublishFailureReason:
    """Categorizes and explains publish failures."""
    
    # Failure categories
    NO_PLATFORM_CONNECTED = "no_platform_connected"
    OAUTH_TOKEN_EXPIRED = "oauth_token_expired"
    OAUTH_TOKEN_REVOKED = "oauth_token_revoked"
    NETWORK_ERROR = "network_error"
    NO_INTERNET = "no_internet_connection"
    API_RATE_LIMIT = "api_rate_limit"
    API_AUTHORIZATION = "api_authorization_error"
    API_SERVER_ERROR = "api_server_error"
    CONTENT_TOO_LONG = "content_exceeds_length_limit"
    INVALID_CONTENT = "invalid_content_format"
    PLATFORM_ACCOUNT_INACTIVE = "platform_account_deactivated"
    SCHEDULER_NOT_RUNNING = "scheduler_not_running"
    UNKNOWN_ERROR = "unknown_error"
    
    @classmethod
    def classify(cls, error_message: str, status_code: int | None = None) -> dict[str, Any]:
        """Classify the failure reason and return actionable info.
        
        Returns:
            {
                "category": str,  # Machine-readable category
                "reason": str,    # Human-readable explanation
                "action": str,    # What user should do to fix
                "retryable": bool,  # Can we retry automatically?
                "severity": str   # "critical", "warning", "info"
            }
        """
        error_lower = error_message.lower() if error_message else ""
        
        # Check for no platform connected
        if any(keyword in error_lower for keyword in [
            "no linkedin account connected",
            "no twitter account connected",
            "no instagram account connected",
            "no facebook account connected",
            "no platform account",
            "platform_accounts"
        ]):
            return {
                "category": cls.NO_PLATFORM_CONNECTED,
                "reason": f"No social media account connected. You need to connect your {cls._extract_platform(error_lower)} account in Settings > Platforms.",
                "action": "Go to Settings > Platforms and connect your social media account via OAuth.",
                "retryable": False,
                "severity": "critical"
            }
        
        # Check for OAuth token expired
        if any(keyword in error_lower for keyword in [
            "token expired",
            "access token expired",
            "expired token",
            "token has expired",
            "401",
            "unauthorized"
        ]) and "expired" in error_lower:
            return {
                "category": cls.OAUTH_TOKEN_EXPIRED,
                "reason": "Your social media authentication token has expired. This happens every 60 days for security.",
                "action": "Reconnect your account in Settings > Platforms to refresh the token.",
                "retryable": False,
                "severity": "critical"
            }
        
        # Check for OAuth token revoked
        if any(keyword in error_lower for keyword in [
            "token revoked",
            "access revoked",
            "permission denied",
            "revoked access"
        ]):
            return {
                "category": cls.OAUTH_TOKEN_REVOKED,
                "reason": "Your social media access has been revoked. You may have removed the app permission.",
                "action": "Re-authorize the app in Settings > Platforms.",
                "retryable": False,
                "severity": "critical"
            }
        
        # Check for no internet connection
        if any(keyword in error_lower for keyword in [
            "connection refused",
            "network is unreachable",
            "name resolution failed",
            "temporary failure in name resolution",
            "nodename nor servname provided",
            "errno 8",
            "errno 61",
            "getaddrinfo failed"
        ]):
            return {
                "category": cls.NO_INTERNET,
                "reason": "No internet connection or DNS resolution failed. The server cannot reach the social media API.",
                "action": "Check your internet connection and DNS settings. The publish will retry automatically when connection is restored.",
                "retryable": True,
                "severity": "warning"
            }
        
        # Check for general network errors
        if any(keyword in error_lower for keyword in [
            "connection error",
            "network error",
            "timeout",
            "timed out",
            "connection reset",
            "connection aborted"
        ]):
            return {
                "category": cls.NETWORK_ERROR,
                "reason": "Network connection error. The social media API may be temporarily unavailable.",
                "action": "The publish will retry automatically. If this persists, check your network connection.",
                "retryable": True,
                "severity": "warning"
            }
        
        # Check for API rate limit
        if any(keyword in error_lower for keyword in [
            "rate limit",
            "too many requests",
            "429",
            "rate_limit",
            "throttl"
        ]):
            return {
                "category": cls.API_RATE_LIMIT,
                "reason": "You've exceeded the social media platform's API rate limit. This is a temporary restriction.",
                "action": "Wait a few minutes and the publish will retry automatically. Consider spacing out your posts.",
                "retryable": True,
                "severity": "warning"
            }
        
        # Check for API authorization errors
        if any(keyword in error_lower for keyword in [
            "401",
            "unauthorized",
            "invalid token",
            "invalid access token",
            "bad authentication"
        ]):
            return {
                "category": cls.API_AUTHORIZATION,
                "reason": "Authentication failed with the social media platform. Your credentials may be invalid.",
                "action": "Reconnect your account in Settings > Platforms to refresh credentials.",
                "retryable": False,
                "severity": "critical"
            }
        
        # Check for API server errors (5xx)
        if status_code and status_code >= 500:
            return {
                "category": cls.API_SERVER_ERROR,
                "reason": f"The social media platform's server is experiencing issues (HTTP {status_code}). This is temporary.",
                "action": "The publish will retry automatically. The platform should resolve this soon.",
                "retryable": True,
                "severity": "warning"
            }
        
        # Check for content length issues
        if any(keyword in error_lower for keyword in [
            "too long",
            "exceeds",
            "character limit",
            "max length",
            "content too long"
        ]):
            return {
                "category": cls.CONTENT_TOO_LONG,
                "reason": f"Your content exceeds the {cls._extract_platform(error_lower)} character limit.",
                "action": "Edit your content to fit within the platform's character limits and try again.",
                "retryable": False,
                "severity": "critical"
            }
        
        # Check for invalid content format
        if any(keyword in error_lower for keyword in [
            "invalid",
            "bad request",
            "400",
            "validation error",
            "malformed"
        ]):
            return {
                "category": cls.INVALID_CONTENT,
                "reason": "The content format is invalid for this platform. It may contain unsupported characters or formatting.",
                "action": "Review your content and ensure it follows the platform's formatting rules.",
                "retryable": False,
                "severity": "critical"
            }
        
        # Check for platform account inactive
        if any(keyword in error_lower for keyword in [
            "account disabled",
            "account suspended",
            "account inactive",
            "account deactivated"
        ]):
            return {
                "category": cls.PLATFORM_ACCOUNT_INACTIVE,
                "reason": "Your social media account has been disabled or suspended by the platform.",
                "action": "Check your social media account status and resolve any platform violations.",
                "retryable": False,
                "severity": "critical"
            }
        
        # Default: unknown error
        return {
            "category": cls.UNKNOWN_ERROR,
            "reason": f"An unexpected error occurred: {error_message[:100]}",
            "action": "Check the logs for more details. If this persists, contact support.",
            "retryable": True,
            "severity": "warning"
        }
    
    @staticmethod
    def _extract_platform(error_message: str) -> str:
        """Extract platform name from error message."""
        for platform in ["linkedin", "twitter", "instagram", "facebook", "whatsapp"]:
            if platform in error_message:
                return platform.title()
        return "social media"
    
    @classmethod
    def should_retry(cls, failure_info: dict[str, Any]) -> bool:
        """Determine if this failure should be retried automatically."""
        return failure_info.get("retryable", False)
    
    @classmethod
    def get_retry_delay(cls, failure_info: dict[str, Any], retry_count: int) -> int:
        """Calculate retry delay in seconds based on failure type and attempt count.
        
        Uses exponential backoff with different strategies per failure type.
        """
        category = failure_info.get("category", cls.UNKNOWN_ERROR)
        
        # Rate limits: wait longer (15 min, 30 min, 1 hour)
        if category == cls.API_RATE_LIMIT:
            delays = [900, 1800, 3600]  # 15min, 30min, 1hr
            return delays[min(retry_count, len(delays) - 1)]
        
        # Network errors: retry quickly (1 min, 5 min, 15 min)
        if category in [cls.NETWORK_ERROR, cls.NO_INTERNET]:
            delays = [60, 300, 900]  # 1min, 5min, 15min
            return delays[min(retry_count, len(delays) - 1)]
        
        # API server errors: moderate delay (5 min, 15 min, 30 min)
        if category == cls.API_SERVER_ERROR:
            delays = [300, 900, 1800]  # 5min, 15min, 30min
            return delays[min(retry_count, len(delays) - 1)]
        
        # Default: exponential backoff (1 min, 2 min, 4 min, 8 min, max 15 min)
        return min(60 * (2 ** retry_count), 900)  # Max 15 minutes
