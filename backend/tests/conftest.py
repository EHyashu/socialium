import asyncio
from collections.abc import AsyncGenerator, Generator
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.main import app
from app.database import Base, get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.core.constants import SubscriptionTier

# Test database URL (in-memory SQLite)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_engine():
    """Create in-memory SQLite database engine for testing."""
    engine = create_async_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    yield engine
    
    # Cleanup tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional database session for each test case."""
    async_session_factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session_factory() as session:
        yield session
        # Rollback any uncommitted transactions to keep tests isolated
        await session.rollback()

@pytest.fixture
def mock_user() -> User:
    """Provide a mock user instance."""
    return User(
        id=User.id.default.arg if hasattr(User.id.default, 'arg') else None,
        email="testuser@example.com",
        username="testuser",
        full_name="Test User",
        subscription_tier=SubscriptionTier.FREE,
        is_active=True,
    )

@pytest.fixture
async def client(db_session, mock_user) -> AsyncGenerator[AsyncClient, None]:
    """Provide an HTTPX AsyncClient with overridden dependencies."""
    # Override get_db dependency
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session
        
    # Override get_current_user dependency
    async def override_get_current_user() -> User:
        # Mock user needs to be persistent/attached if queried, but this mock works for simple route tests
        mock_user.id = mock_user.id or User.id.default.arg
        return mock_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as async_client:
        yield async_client
        
    # Clean up overrides
    app.dependency_overrides.clear()
