"""Memory router — Qdrant vector search for brand knowledge."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.qdrant_client import search as qdrant_search
from app.core.auth import get_current_user
from app.models.user import User
from app.schemas.automation import MemorySearchRequest, MemorySearchResponse, MemorySearchResult

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/search", response_model=MemorySearchResponse)
async def search_memory(
    body: MemorySearchRequest,
    current_user: User = Depends(get_current_user),
):
    """Search brand memory / content vectors."""
    try:
        # Generate real embedding using OpenAI
        import openai
        from app.config import get_settings
        
        settings = get_settings()
        
        # Use OpenAI embeddings for the query
        embedding_response = openai.embeddings.create(
            model=settings.openai_embedding_model,
            input=body.query,
        )
        
        query_vector = embedding_response.data[0].embedding
        logger.info(f"Generated embedding for query: {body.query[:50]}... (dim: {len(query_vector)})")
        
        results = qdrant_search(
            collection_name=body.collection,
            query_vector=query_vector,
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
        logger.error(f"Memory search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
