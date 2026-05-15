"""Qdrant collection migration script.

Creates/updates all required Qdrant collections with correct dimensions.
Run: python migrate_collections.py
"""

from app.core.qdrant_client import create_all_collections


def main():
    """Run collection migration."""
    print("Migrating Qdrant collections...")
    create_all_collections()
    print("Migration complete!")


if __name__ == "__main__":
    main()
