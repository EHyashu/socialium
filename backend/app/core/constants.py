"""Application constants and enums."""

import enum


class Platform(str, enum.Enum):
    LINKEDIN = "linkedin"
    TWITTER = "twitter"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    WHATSAPP = "whatsapp"


class ContentStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"


class ApprovalAction(str, enum.Enum):
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_CHANGES = "request_changes"


class WorkspaceRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class ContentTone(str, enum.Enum):
    PROFESSIONAL = "professional"
    CASUAL = "casual"
    HUMOROUS = "humorous"
    INSPIRATIONAL = "inspirational"
    EDUCATIONAL = "educational"
    PROMOTIONAL = "promotional"


class SourceType(str, enum.Enum):
    MANUAL = "manual"
    AI_GENERATED = "ai_generated"
    TREND_BASED = "trend_based"
    TEMPLATE = "template"
    RECYCLED = "recycled"


class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    BUSINESS = "business"


PLATFORM_LIMITS: dict[Platform, dict[str, int]] = {
    Platform.LINKEDIN: {"max_chars": 3000, "max_hashtags": 5, "max_mentions": 10, "max_images": 9},
    Platform.TWITTER: {"max_chars": 280, "max_hashtags": 3, "max_mentions": 5, "max_images": 4},
    Platform.INSTAGRAM: {"max_chars": 2200, "max_hashtags": 30, "max_mentions": 10, "max_images": 10},
    Platform.FACEBOOK: {"max_chars": 63206, "max_hashtags": 10, "max_mentions": 50, "max_images": 10},
    Platform.WHATSAPP: {"max_chars": 4096, "max_hashtags": 0, "max_mentions": 0, "max_images": 1},
}


TIER_LIMITS: dict[SubscriptionTier, dict[str, int]] = {
    SubscriptionTier.FREE: {
        "max_workspaces": 1,
        "max_team_members": 1,
        "max_platforms": 2,
        "max_scheduled_posts": 10,
        "ai_generations_per_day": 5,
        "analytics_history_days": 7,
        "ab_testing_enabled": False,
    },
    SubscriptionTier.PRO: {
        "max_workspaces": 3,
        "max_team_members": 5,
        "max_platforms": 5,
        "max_scheduled_posts": 50,
        "ai_generations_per_day": 50,
        "analytics_history_days": 90,
        "ab_testing_enabled": True,
    },
    SubscriptionTier.BUSINESS: {
        "max_workspaces": 10,
        "max_team_members": 20,
        "max_platforms": 15,
        "max_scheduled_posts": 500,
        "ai_generations_per_day": 500,
        "analytics_history_days": 365,
        "ab_testing_enabled": True,
    },
}


AI_MODELS: dict[str, str] = {
    "content_generation": "gpt-4o",
    "quality_scoring": "claude-3-5-sonnet-20241022",
    "embedding": "text-embedding-3-large",
    "fallback": "llama-3.1-8b-instant",
}
