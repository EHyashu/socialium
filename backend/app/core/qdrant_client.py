"""Qdrant vector database client and collection management."""

from functools import lru_cache

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from app.config import get_settings

settings = get_settings()


@lru_cache
def get_qdrant_client() -> QdrantClient:
    """Get or create a cached Qdrant client instance."""
    kwargs = {"url": settings.qdrant_url}
    if settings.qdrant_api_key:
        kwargs["api_key"] = settings.qdrant_api_key
    return QdrantClient(**kwargs)


def create_all_collections() -> None:
    """Ensure all required Qdrant collections exist."""
    client = get_qdrant_client()
    for name, dim in settings.qdrant_collections.items():
        if not client.collection_exists(name):
            client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
            )
            print(f"Created Qdrant collection: {name} ({dim}d)")
        else:
            print(f"Qdrant collection exists: {name}")


def upsert_points(
    collection_name: str,
    points: list[dict],
) -> None:
    """Upsert points into a Qdrant collection."""
    client = get_qdrant_client()
    from qdrant_client.models import PointStruct

    point_structs = [
        PointStruct(id=p["id"], vector=p["vector"], payload=p.get("payload", {}))
        for p in points
    ]
    client.upsert(collection_name=collection_name, points=point_structs)


def search(
    collection_name: str,
    query_vector: list[float],
    limit: int = 5,
    score_threshold: float = 0.6,
) -> list[dict]:
    """Search for similar vectors in a Qdrant collection."""
    client = get_qdrant_client()
    results = client.search(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=limit,
        score_threshold=score_threshold,
    )
    return [
        {"id": r.id, "score": r.score, "payload": r.payload} for r in results
    ]


def delete_points(collection_name: str, ids: list[int | str]) -> None:
    """Delete points from a Qdrant collection."""
    client = get_qdrant_client()
    client.delete(collection_name=collection_name, points_selector=ids)
