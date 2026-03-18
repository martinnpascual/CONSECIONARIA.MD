"""
conftest.py — Configuración compartida para todos los tests de DM Cars.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock

# Mockear Supabase antes de importar la app (evita conexión real en tests)
mock_supabase = MagicMock()
mock_supabase.auth.get_user.return_value = MagicMock(
    user=MagicMock(id="test-user-id")
)

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="session")
async def client():
    """Cliente HTTP async para testear los endpoints."""
    # Parchear variables de entorno mínimas para inicializar la app
    env_vars = {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "test-service-key",
        "JWT_SECRET": "test-jwt-secret-32-characters-long",
        "APP_ENV": "test",
    }
    with patch.dict("os.environ", env_vars):
        # Importar app después del patch para que Settings tome los valores mock
        from app.main import app
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as ac:
            yield ac
