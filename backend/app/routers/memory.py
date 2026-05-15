"""Memory router — Qdrant vector search for brand knowledge."""

from fastapi import APIRouter, HTTPException

from app.core.qdrant_client import search as qdrant_search
from app.schemas.automation import MemorySearchRequest, MemorySearchResponse, MemorySearchResult

router = APIRouter()


@router.post("/search", response_model=MemorySearchResponse)
async def search_memory(body: MemorySearchRequest):
    """Search brand memory / content vectors."""
    # For a real implementation, we'd embed the query first
    # This is a simplified version
    try:
        results = qdrant_search(
            collection_name=body.collection,
            query_vector=[0.0] * 3072,  # Placeholder — needs real embedding
            limit=body.limit,
            score_threshold=body.threshold,
        )
        return MemorySearchResponse(
            results=[
                MemorySearchResult(
                    id=str(r["id"]),
                    score=r["score"],
                    payload=r["payload"],
                )
                for r in results
            ],
            query=body.query,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
