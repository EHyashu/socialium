"""Auto-reply & memory schemas."""

from pydantic import BaseModel, Field


class AutoReplyConfig(BaseModel):
    workspace_id: str
    platform: str
    is_enabled: bool = True
    reply_tone: str = "professional"
    max_replies_per_day: int = 20
    target_keywords: list[str] | None = None
    exclude_keywords: list[str] | None = None


class AutoReplyResponse(BaseModel):
    id: str
    workspace_id: str
    platform: str
    is_enabled: bool
    reply_tone: str
    max_replies_per_day: int
    replies_today: int = 0


class MemorySearchRequest(BaseModel):
    query: str
    collection: str = "brand_memory"
    limit: int = Field(default=5, ge=1, le=20)
    threshold: float = Field(default=0.6, ge=0.0, le=1.0)


class MemorySearchResult(BaseModel):
    id: str | int
    score: float
    payload: dict


class MemorySearchResponse(BaseModel):
    results: list[MemorySearchResult]
    query: str
