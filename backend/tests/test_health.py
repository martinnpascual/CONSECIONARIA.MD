"""
test_health.py — Tests del health check y endpoints raíz.
Son los tests más simples, no requieren autenticación.
"""
import pytest


@pytest.mark.anyio
async def test_health_ok(client):
    """El endpoint /health debe responder 200 con status ok."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "DM Cars"
    assert "version" in data
    assert "env" in data


@pytest.mark.anyio
async def test_root_ok(client):
    """El endpoint raíz / debe responder 200."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["app"] == "DM Cars API"


@pytest.mark.anyio
async def test_docs_available_in_non_production(client):
    """En entorno test (no producción) la documentación debe estar disponible."""
    response = await client.get("/docs")
    # Redirige a la UI de Swagger — cualquier 2xx o 3xx está bien
    assert response.status_code in (200, 301, 302, 307)


@pytest.mark.anyio
async def test_vehicles_requires_auth(client):
    """GET /api/v1/vehicles sin token debe devolver 401 o 403."""
    response = await client.get("/api/v1/vehicles")
    assert response.status_code in (401, 403)


@pytest.mark.anyio
async def test_persons_requires_auth(client):
    """GET /api/v1/persons sin token debe devolver 401 o 403."""
    response = await client.get("/api/v1/persons")
    assert response.status_code in (401, 403)


@pytest.mark.anyio
async def test_config_requires_auth(client):
    """GET /api/v1/config sin token debe devolver 401 o 403."""
    response = await client.get("/api/v1/config")
    assert response.status_code in (401, 403)


@pytest.mark.anyio
async def test_cash_requires_auth(client):
    """GET /api/v1/cash/registers sin token debe devolver 401 o 403."""
    response = await client.get("/api/v1/cash/registers")
    assert response.status_code in (401, 403)


@pytest.mark.anyio
async def test_404_unknown_route(client):
    """Una ruta inexistente debe devolver 404."""
    response = await client.get("/api/v1/ruta-que-no-existe")
    assert response.status_code == 404
