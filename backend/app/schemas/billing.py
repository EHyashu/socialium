"""Billing schemas."""

from pydantic import BaseModel, Field


class UpgradeRequest(BaseModel):
    plan: str = Field(description="Target plan: pro or business")


class BillingResponse(BaseModel):
    current_plan: str
    valid_until: str | None = None
    features: dict


class CheckoutSessionResponse(BaseModel):
    session_id: str
    url: str
