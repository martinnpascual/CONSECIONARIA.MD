"""
conftest.py — Fixtures compartidas para todos los tests de DM Cars.

Estrategia de mocking:
- WeasyPrint (necesita GTK en Linux/Windows) se mockea a nivel de sys.modules
  antes de cualquier import de la app, para que los tests funcionen sin GTK.
- Se parchean las variables de entorno antes de importar la app.
- `get_current_user` se sobreescribe por rol (sin JWT real, sin DB).
- `get_supabase_admin` se sobreescribe con un mock configurado por tabla.
- Los tests de unidad pura (calculadora francesa) no necesitan cliente HTTP.
"""
import sys
from unittest.mock import MagicMock

# ──────────────────────────────────────────────
# Mock de WeasyPrint ANTES de cualquier import de la app.
# WeasyPrint requiere GTK (libgobject) que no existe en entornos de test
# sin interfaz gráfica (Windows sin GTK, CI/CD, Docker sin libs nativas).
# ──────────────────────────────────────────────
_weasyprint_mock = MagicMock()
sys.modules.setdefault("weasyprint", _weasyprint_mock)
sys.modules.setdefault("weasyprint.text", _weasyprint_mock)
sys.modules.setdefault("weasyprint.fonts", _weasyprint_mock)

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch
from contextlib import asynccontextmanager

# ──────────────────────────────────────────────
# Variables de entorno de test (usadas en todos los fixtures)
# ──────────────────────────────────────────────
TEST_ENV = {
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_ANON_KEY": "test-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
    "JWT_SECRET": "test-jwt-secret-at-least-32-chars!",
    "APP_ENV": "test",
}


# ──────────────────────────────────────────────
# Backend anyio
# ──────────────────────────────────────────────
@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


# ──────────────────────────────────────────────
# Usuarios de prueba por rol
# ──────────────────────────────────────────────
@pytest.fixture(scope="session")
def admin_user():
    with patch.dict("os.environ", TEST_ENV):
        from app.utils.security import CurrentUser
        return CurrentUser(
            id="admin-0000-0000-0000-000000000001",
            email="admin@dmcars.test",
            role="admin",
            full_name="Admin Test",
        )


@pytest.fixture(scope="session")
def seller_user():
    with patch.dict("os.environ", TEST_ENV):
        from app.utils.security import CurrentUser
        return CurrentUser(
            id="seller-000-0000-0000-000000000002",
            email="vendedor@dmcars.test",
            role="vendedor",
            full_name="Vendedor Test",
        )


@pytest.fixture(scope="session")
def cashier_user():
    with patch.dict("os.environ", TEST_ENV):
        from app.utils.security import CurrentUser
        return CurrentUser(
            id="cashier-00-0000-0000-000000000003",
            email="cajero@dmcars.test",
            role="cajero",
            full_name="Cajero Test",
        )


@pytest.fixture(scope="session")
def mechanic_user():
    with patch.dict("os.environ", TEST_ENV):
        from app.utils.security import CurrentUser
        return CurrentUser(
            id="mechanic-0-0000-0000-000000000004",
            email="mecanico@dmcars.test",
            role="mecanico",
            full_name="Mecanico Test",
        )


# ──────────────────────────────────────────────
# Helper: mock de Supabase configurable por tabla
# ──────────────────────────────────────────────
def build_mock_db(table_responses: dict | None = None) -> MagicMock:
    """
    Construye un mock de supabase Client donde cada tabla devuelve
    respuestas configuradas.

    Uso:
        db = build_mock_db({
            "vehicles": {"data": [VEHICLE_ROW], "count": 1},
            "vehicle_photos": {"data": [], "count": 0},
        })

    Cuando no se configura una tabla, devuelve data=[], count=0.
    """
    table_responses = table_responses or {}

    def _make_chain(data: list, count: int) -> MagicMock:
        """
        Mock fluido que termina en .execute() → result.

        .single() devuelve un sub-chain cuyo .execute().data es un dict
        (primer elemento) en vez de una lista — igual que el comportamiento
        real de supabase-py.
        """
        # Resultado para consultas de lista
        result_list = MagicMock()
        result_list.data = data
        result_list.count = count

        # Resultado para consultas `.single()` → data es dict o None
        result_single = MagicMock()
        result_single.data = data[0] if data else None
        result_single.count = 1 if data else 0

        # Sub-chain que se activa después de .single()
        single_chain = MagicMock()
        for method in (
            "select", "eq", "neq", "is_", "ilike", "or_", "not_",
            "order", "range", "limit", "insert", "update",
            "delete", "in_", "lte", "gte", "contains", "filter",
        ):
            getattr(single_chain, method).return_value = single_chain
        single_chain.execute.return_value = result_single

        # Chain principal
        chain = MagicMock()
        for method in (
            "select", "eq", "neq", "is_", "ilike", "or_", "not_",
            "order", "range", "limit", "insert", "update",
            "delete", "in_", "lte", "gte", "contains", "filter",
        ):
            getattr(chain, method).return_value = chain
        chain.single.return_value = single_chain
        chain.execute.return_value = result_list
        return chain

    db = MagicMock()
    db.storage = MagicMock()
    db.storage.from_.return_value = MagicMock(
        upload=MagicMock(return_value=None),
        remove=MagicMock(return_value=None),
        get_public_url=MagicMock(return_value="https://storage.test/photo.jpg"),
    )

    def _table_side_effect(name: str) -> MagicMock:
        resp = table_responses.get(name, {"data": [], "count": 0})
        data = resp.get("data", [])
        count = resp.get("count", len(data))
        return _make_chain(data, count)

    db.table.side_effect = _table_side_effect
    return db


# ──────────────────────────────────────────────
# Helper: cliente HTTP con dependencias sobreescritas
# ──────────────────────────────────────────────
@asynccontextmanager
async def authenticated_client(current_user, mock_db: MagicMock | None = None):
    """
    Context manager que devuelve un AsyncClient con get_current_user y
    get_supabase_admin sobreescritos para tests sin Supabase real.

    Uso:
        async with authenticated_client(admin_user, mock_db) as c:
            resp = await c.get("/api/v1/vehicles")
    """
    with patch.dict("os.environ", TEST_ENV):
        from app.main import app
        from app.utils.security import get_current_user
        from app.supabase_client import get_supabase_admin

        app.dependency_overrides[get_current_user] = lambda: current_user
        if mock_db is not None:
            app.dependency_overrides[get_supabase_admin] = lambda: mock_db

        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as ac:
                yield ac
        finally:
            app.dependency_overrides.clear()


# ──────────────────────────────────────────────
# Cliente sin autenticación (para tests de 401/403)
# ──────────────────────────────────────────────
@pytest.fixture(scope="session")
async def client():
    """Cliente HTTP sin auth — para health check y tests de 401."""
    with patch.dict("os.environ", TEST_ENV):
        from app.main import app
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac
