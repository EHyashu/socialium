from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Verify that the health check endpoint returns 200 and healthy status."""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "SOCIALIUM API"}

@pytest.mark.asyncio
@patch("app.routers.auth.supabase_sign_up")
@patch("app.routers.auth.supabase_sign_in")
async def test_signup_route(mock_sign_in, mock_sign_up, client: AsyncClient):
    """Verify that signup route registers user successfully and creates database record."""
    # Setup mocks
    mock_sign_up.return_value = {
        "id": "24a84859-d193-4c1c-80e3-b685f3f23429",
        "user": {"id": "24a84859-d193-4c1c-80e3-b685f3f23429", "email": "newuser@example.com"},
        "access_token": "mock-access-token",
        "refresh_token": "mock-refresh-token",
        "expires_in": 3600
    }
    mock_sign_in.return_value = mock_sign_up.return_value
    
    payload = {
        "email": "newuser@example.com",
        "password": "strong-password-123",
        "username": "newuser",
        "full_name": "New User"
    }
    
    response = await client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    assert data["access_token"] == "mock-access-token"
    assert data["user"]["email"] == "newuser@example.com"
    assert data["user"]["username"] == "newuser"
    
    assert mock_sign_up.called

@pytest.mark.asyncio
@patch("app.routers.auth.supabase_sign_in")
async def test_login_route_success(mock_sign_in, client: AsyncClient):
    """Verify login route works when credentials match."""
    mock_sign_in.return_value = {
        "id": "24a84859-d193-4c1c-80e3-b685f3f23429",
        "user": {"id": "24a84859-d193-4c1c-80e3-b685f3f23429", "email": "newuser@example.com"},
        "access_token": "mock-access-token",
        "refresh_token": "mock-refresh-token",
        "expires_in": 3600
    }
    
    payload = {
        "email": "newuser@example.com",
        "password": "strong-password-123"
    }
    
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    assert data["access_token"] == "mock-access-token"
    assert data["user"]["email"] == "newuser@example.com"
    
    assert mock_sign_in.called
