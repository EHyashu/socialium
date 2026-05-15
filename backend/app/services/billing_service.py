"""Billing service — Stripe integration with PostHog tracking."""

import logging

import stripe
from posthog import Posthog

from app.config import get_settings
from app.core.constants import SubscriptionTier, TIER_LIMITS

logger = logging.getLogger(__name__)
settings = get_settings()

stripe.api_key = settings.stripe_secret_key

_posthog: Posthog | None = None


def _get_posthog() -> Posthog | None:
    """Get PostHog client if configured."""
    global _posthog
    if _posthog is None and settings.posthog_api_key:
        _posthog = Posthog(
            project_api_key=settings.posthog_project_id or settings.posthog_api_key,
            host=settings.posthog_host,
        )
    return _posthog


def _track_plan_upgrade(user_id: str, tier: str, amount: float, previous_tier: str) -> None:
    """Track plan upgrade in PostHog."""
    try:
        ph = _get_posthog()
        if ph:
            ph.capture(
                distinct_id=user_id,
                event="plan_upgraded",
                properties={
                    "plan": tier,
                    "amount": amount,
                    "currency": "USD",
                    "previous_plan": previous_tier,
                    "plan_upgraded": True,
                    "plan_tier": tier,
                },
            )
    except Exception as e:
        logger.error(f"PostHog plan_upgraded tracking failed: {e}")


async def get_current_plan(user_tier: str) -> dict:
    """Get current plan details."""
    tier = SubscriptionTier(user_tier) if user_tier in [t.value for t in SubscriptionTier] else SubscriptionTier.FREE
    limits = TIER_LIMITS.get(tier, TIER_LIMITS[SubscriptionTier.FREE])

    feature_list = {
        "free": ["1 workspace", "2 platforms", "10 scheduled posts", "5 AI generations/day", "7 days analytics"],
        "pro": ["3 workspaces", "5 platforms", "50 scheduled posts", "50 AI generations/day", "90 days analytics", "A/B testing", "Priority support"],
        "business": ["10 workspaces", "15 platforms", "500 scheduled posts", "500 AI generations/day", "365 days analytics", "A/B testing", "Dedicated support", "Custom branding"],
    }

    return {
        "current_plan": tier.value,
        "valid_until": None,
        "features": {
            "tier": tier.value,
            "limits": limits,
            "feature_list": feature_list.get(tier.value, feature_list["free"]),
        },
    }


async def upgrade_plan(user_id: str, user_email: str, target_tier: str, current_tier: str) -> dict:
    """Upgrade user's subscription plan."""
    prices = {"pro": 29.00, "business": 99.00}
    amount = prices.get(target_tier, 29.00)

    try:
        # Create Stripe checkout session
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"Socialium {target_tier.capitalize()}"},
                    "unit_amount": int(amount * 100),
                    "recurring": {"interval": "month"},
                },
                "quantity": 1,
            }],
            customer_email=user_email,
            success_url=f"{settings.frontend_url}/settings/billing?success=true",
            cancel_url=f"{settings.frontend_url}/settings/billing?canceled=true",
        )

        # Track in PostHog
        _track_plan_upgrade(user_id, target_tier, amount, current_tier)

        return {"session_id": session.id, "url": session.url}

    except Exception as e:
        logger.error(f"Stripe checkout creation failed: {e}")
        # Even if Stripe fails, track the intent
        _track_plan_upgrade(user_id, target_tier, amount, current_tier)
        return {"session_id": "", "url": "", "error": str(e)}
