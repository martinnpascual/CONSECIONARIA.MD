"""
test_vehicles.py — Tests del módulo Stock de Vehículos (M01)

Cubre:
  - Endpoints: list, create, get, update, delete, reserve
  - Control de acceso por rol (admin / vendedor / cajero / mecanico)
  - Regla de negocio: precio de costo solo visible para admin
  - Regla de negocio: soft-delete, no borrar vendidos
  - Regla de negocio: no reservar un vehículo que no está disponible
"""
import pytest
from decimal import Decimal
from unittest.mock import MagicMock

from tests.conftest import build_mock_db, authenticated_client

# ──────────────────────────────────────────────
# Datos de prueba
# ──────────────────────────────────────────────

VEHICLE_ID = "aaaa0000-0000-0000-0000-000000000001"
SALE_ID = "bbbb0000-0000-0000-0000-000000000002"

VEHICLE_ROW = {
    "id": VEHICLE_ID,
    "vehicle_type": "usado",
    "status": "disponible",
    "brand": "Toyota",
    "model": "Corolla",
    "version": "XEI AT",
    "year": 2020,
    "model_year": 2021,
    "color": "Blanco",
    "interior_color": None,
    "fuel_type": "nafta",
    "transmission": "automatica",
    "doors": 4,
    "body_type": "sedan",
    "chassis_number": "JTDKN3DU9A0123456",
    "engine_number": "1NZ0123456",
    "plate": "AB123CD",
    "mileage": 45000,
    "previous_owners": 1,
    "list_price": 18000000.00,
    "cost_price": 15000000.00,
    "min_price": 16000000.00,
    "currency": "ARS",
    "location": "Salón",
    "provenance": None,
    "description": "Excelente estado",
    "equipment": ["aire", "GPS"],
    "entry_date": "2024-01-15",
    "sale_date": None,
    "deleted_at": None,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z",
    "vehicle_photos": [],
    "sale_id": None,
    "consignment_id": None,
}

VEHICLE_CREATE_PAYLOAD = {
    "vehicle_type": "usado",
    "brand": "Ford",
    "model": "Ranger",
    "version": "XLS 4x2",
    "year": 2022,
    "fuel_type": "diesel",
    "transmission": "manual",
    "list_price": 25000000,
    "cost_price": 20000000,
}

LIST_ROW = {
    "id": VEHICLE_ID,
    "vehicle_type": "usado",
    "status": "disponible",
    "brand": "Toyota",
    "model": "Corolla",
    "version": "XEI AT",
    "year": 2020,
    "color": "Blanco",
    "fuel_type": "nafta",
    "transmission": "automatica",
    "mileage": 45000,
    "list_price": 18000000.00,
    "currency": "ARS",
    "location": "Salón",
    "entry_date": "2024-01-15",
}


# ══════════════════════════════════════════════
# TESTS DE UNIDAD — VehicleService (sin HTTP)
# ══════════════════════════════════════════════

class TestVehicleServiceUnit:
    """Tests de lógica de negocio directamente en el service (sin HTTP)."""

    @pytest.mark.anyio
    async def test_seller_cannot_set_cost_price_on_create(self, seller_user):
        """Un vendedor no puede setear el precio de costo al crear un vehículo."""
        from app.services.vehicle_service import VehicleService
        from app.schemas.vehicle_schemas import VehicleCreate

        vehicle_with_cost = VehicleCreate(
            vehicle_type="usado",
            brand="Ford",
            model="Ranger",
            year=2022,
            fuel_type="diesel",
            transmission="manual",
            cost_price=Decimal("20000000"),
            list_price=Decimal("25000000"),
        )

        # Capturar el payload que llega al insert mediante un mock con seguimiento
        inserted_payloads = []

        def _make_chain(data, count):
            result = MagicMock()
            result.data = data
            result.count = count
            chain = MagicMock()
            for method in ("select", "eq", "neq", "is_", "ilike", "or_", "not_",
                           "order", "range", "limit", "single", "update",
                           "delete", "in_", "lte", "gte"):
                getattr(chain, method).return_value = chain
            chain.execute.return_value = result

            def _capture_insert(payload):
                inserted_payloads.append(payload)
                return chain
            chain.insert.side_effect = _capture_insert
            return chain

        mock_db = MagicMock()
        mock_db.table.return_value = _make_chain(
            [{**VEHICLE_ROW, "id": "new-id"}], 1
        )
        mock_db.storage = MagicMock()

        service = VehicleService(mock_db)
        await service.create_vehicle(vehicle_with_cost, seller_user)

        assert len(inserted_payloads) == 1, "El service debe llamar a insert exactamente una vez"
        inserted_data = inserted_payloads[0]
        assert "cost_price" not in inserted_data, (
            "El vendedor NO debe poder enviar cost_price al crear un vehículo"
        )

    @pytest.mark.anyio
    async def test_seller_can_set_cost_price_admin(self, admin_user):
        """El admin SÍ puede setear el precio de costo al crear."""
        from app.services.vehicle_service import VehicleService
        from app.schemas.vehicle_schemas import VehicleCreate

        vehicle_with_cost = VehicleCreate(
            vehicle_type="nuevo",
            brand="Toyota",
            model="Hilux",
            year=2024,
            fuel_type="diesel",
            transmission="automatica",
            cost_price=Decimal("35000000"),
            list_price=Decimal("42000000"),
        )

        inserted_payloads = []

        def _make_chain(data, count):
            result = MagicMock()
            result.data = data
            result.count = count
            chain = MagicMock()
            for method in ("select", "eq", "neq", "is_", "ilike", "or_", "not_",
                           "order", "range", "limit", "single", "update",
                           "delete", "in_", "lte", "gte"):
                getattr(chain, method).return_value = chain
            chain.execute.return_value = result

            def _capture_insert(payload):
                inserted_payloads.append(payload)
                return chain
            chain.insert.side_effect = _capture_insert
            return chain

        mock_db = MagicMock()
        mock_db.table.return_value = _make_chain(
            [{**VEHICLE_ROW, "cost_price": 35000000}], 1
        )
        mock_db.storage = MagicMock()

        service = VehicleService(mock_db)
        await service.create_vehicle(vehicle_with_cost, admin_user)

        assert len(inserted_payloads) == 1
        inserted_data = inserted_payloads[0]
        assert "cost_price" in inserted_data, "Admin DEBE poder enviar cost_price"

    @pytest.mark.anyio
    async def test_admin_sees_cost_price_in_detail(self, admin_user):
        """El admin ve el campo cost_price en el detalle de un vehículo."""
        from app.services.vehicle_service import VehicleService

        mock_db = build_mock_db({
            "vehicles": {"data": [VEHICLE_ROW], "count": 1},
        })
        service = VehicleService(mock_db)
        result = await service.get_vehicle(VEHICLE_ID, admin_user)

        assert "cost_price" in result, "Admin debe ver cost_price"
        assert result["cost_price"] == 15000000.00

    @pytest.mark.anyio
    async def test_seller_does_not_see_cost_price(self, seller_user):
        """El vendedor NO ve el campo cost_price en el detalle de un vehículo."""
        from app.services.vehicle_service import VehicleService

        mock_db = build_mock_db({
            "vehicles": {"data": [VEHICLE_ROW.copy()], "count": 1},
        })
        service = VehicleService(mock_db)
        result = await service.get_vehicle(VEHICLE_ID, seller_user)

        assert "cost_price" not in result, "Vendedor NO debe ver cost_price"

    @pytest.mark.anyio
    async def test_cannot_delete_sold_vehicle(self, admin_user):
        """No se puede dar de baja (soft-delete) un vehículo con estado 'vendido'."""
        from app.services.vehicle_service import VehicleService
        from fastapi import HTTPException

        sold_vehicle = {**VEHICLE_ROW, "status": "vendido"}
        mock_db = build_mock_db({
            "vehicles": {"data": [sold_vehicle], "count": 1},
        })
        service = VehicleService(mock_db)

        with pytest.raises(HTTPException) as exc_info:
            await service.delete_vehicle(VEHICLE_ID, admin_user)

        assert exc_info.value.status_code == 400
        assert "vendido" in exc_info.value.detail.lower()

    @pytest.mark.anyio
    async def test_cannot_reserve_unavailable_vehicle(self, seller_user):
        """No se puede reservar un vehículo que no está en estado 'disponible'."""
        from app.services.vehicle_service import VehicleService
        from fastapi import HTTPException

        reserved_vehicle = {**VEHICLE_ROW, "status": "reservado"}
        mock_db = build_mock_db({
            "vehicles": {"data": [reserved_vehicle], "count": 1},
        })
        service = VehicleService(mock_db)

        with pytest.raises(HTTPException) as exc_info:
            await service.reserve_vehicle(VEHICLE_ID, SALE_ID, seller_user)

        assert exc_info.value.status_code == 409

    @pytest.mark.anyio
    async def test_get_vehicle_not_found_raises_404(self, admin_user):
        """Buscar un vehículo inexistente lanza 404."""
        from app.services.vehicle_service import VehicleService
        from fastapi import HTTPException

        mock_db = build_mock_db({"vehicles": {"data": [], "count": 0}})
        service = VehicleService(mock_db)

        with pytest.raises(HTTPException) as exc_info:
            await service.get_vehicle("non-existent-id", admin_user)

        assert exc_info.value.status_code == 404

    @pytest.mark.anyio
    async def test_seller_cannot_mark_vehicle_as_sold(self, seller_user):
        """Un vendedor no puede cambiar el estado a 'vendido' (solo admin)."""
        from app.services.vehicle_service import VehicleService
        from app.schemas.vehicle_schemas import VehicleUpdate
        from fastapi import HTTPException

        # Usar copia para que el pop de cost_price (por rol vendedor en get_vehicle)
        # no mute el dict VEHICLE_ROW compartido entre tests.
        mock_db = build_mock_db({
            "vehicles": {"data": [{**VEHICLE_ROW}], "count": 1},
        })
        service = VehicleService(mock_db)
        update = VehicleUpdate(status="vendido")

        with pytest.raises(HTTPException) as exc_info:
            await service.update_vehicle(VEHICLE_ID, update, seller_user)

        assert exc_info.value.status_code == 403


# ══════════════════════════════════════════════
# TESTS DE ENDPOINT — via HTTP client
# ══════════════════════════════════════════════

class TestVehiclesEndpoints:
    """Tests de integración de endpoints via HTTP."""

    # ── Autenticación ──────────────────────────

    @pytest.mark.anyio
    async def test_list_vehicles_without_auth_returns_401(self, client):
        """GET /api/v1/vehicles sin token devuelve 401."""
        response = await client.get("/api/v1/vehicles")
        assert response.status_code == 401

    @pytest.mark.anyio
    async def test_get_vehicle_without_auth_returns_401(self, client):
        """GET /api/v1/vehicles/{id} sin token devuelve 401."""
        response = await client.get(f"/api/v1/vehicles/{VEHICLE_ID}")
        assert response.status_code == 401

    # ── Listar vehículos ───────────────────────

    @pytest.mark.anyio
    async def test_list_vehicles_admin_returns_200(self, admin_user):
        """Admin puede listar vehículos con paginación."""
        mock_db = build_mock_db({
            "vehicles": {"data": [LIST_ROW], "count": 1},
            "vehicle_photos": {"data": [], "count": 0},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get("/api/v1/vehicles")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "pages" in data
        assert data["total"] == 1

    @pytest.mark.anyio
    async def test_list_vehicles_seller_returns_200(self, seller_user):
        """Vendedor puede listar vehículos."""
        mock_db = build_mock_db({
            "vehicles": {"data": [LIST_ROW], "count": 1},
            "vehicle_photos": {"data": [], "count": 0},
        })
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.get("/api/v1/vehicles")

        assert response.status_code == 200

    @pytest.mark.anyio
    async def test_list_vehicles_cashier_returns_200(self, cashier_user):
        """Cajero también puede listar vehículos (todos los roles autenticados)."""
        mock_db = build_mock_db({
            "vehicles": {"data": [], "count": 0},
            "vehicle_photos": {"data": [], "count": 0},
        })
        async with authenticated_client(cashier_user, mock_db) as c:
            response = await c.get("/api/v1/vehicles")

        assert response.status_code == 200

    # ── Crear vehículo ─────────────────────────

    @pytest.mark.anyio
    async def test_create_vehicle_admin_returns_201(self, admin_user):
        """Admin puede crear un vehículo (incluyendo cost_price)."""
        mock_db = build_mock_db({
            "vehicles": {"data": [{**VEHICLE_ROW, "id": "new-vehicle-id"}], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/vehicles", json=VEHICLE_CREATE_PAYLOAD)

        assert response.status_code == 201

    @pytest.mark.anyio
    async def test_create_vehicle_seller_returns_201(self, seller_user):
        """Vendedor puede crear un vehículo (sin cost_price)."""
        payload_without_cost = {k: v for k, v in VEHICLE_CREATE_PAYLOAD.items()
                                if k != "cost_price"}
        mock_db = build_mock_db({
            "vehicles": {"data": [{**VEHICLE_ROW, "id": "new-id"}], "count": 1},
        })
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.post("/api/v1/vehicles", json=payload_without_cost)

        assert response.status_code == 201

    @pytest.mark.anyio
    async def test_create_vehicle_cashier_forbidden_403(self, cashier_user):
        """Cajero NO puede crear vehículos."""
        mock_db = build_mock_db()
        async with authenticated_client(cashier_user, mock_db) as c:
            response = await c.post("/api/v1/vehicles", json=VEHICLE_CREATE_PAYLOAD)

        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_create_vehicle_mechanic_forbidden_403(self, mechanic_user):
        """Mecánico NO puede crear vehículos."""
        mock_db = build_mock_db()
        async with authenticated_client(mechanic_user, mock_db) as c:
            response = await c.post("/api/v1/vehicles", json=VEHICLE_CREATE_PAYLOAD)

        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_create_vehicle_invalid_type_returns_422(self, admin_user):
        """Tipo de vehículo inválido devuelve 422."""
        invalid_payload = {**VEHICLE_CREATE_PAYLOAD, "vehicle_type": "invalido"}
        mock_db = build_mock_db()
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/vehicles", json=invalid_payload)

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_create_vehicle_invalid_fuel_returns_422(self, admin_user):
        """Tipo de combustible inválido devuelve 422."""
        invalid_payload = {**VEHICLE_CREATE_PAYLOAD, "fuel_type": "gasolina"}
        mock_db = build_mock_db()
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/vehicles", json=invalid_payload)

        assert response.status_code == 422

    # ── Detalle de vehículo ────────────────────

    @pytest.mark.anyio
    async def test_get_vehicle_admin_returns_cost_price(self, admin_user):
        """Admin recibe cost_price en el detalle."""
        mock_db = build_mock_db({
            "vehicles": {"data": [VEHICLE_ROW], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get(f"/api/v1/vehicles/{VEHICLE_ID}")

        assert response.status_code == 200
        data = response.json()
        assert "cost_price" in data
        assert data["cost_price"] == 15000000.00

    @pytest.mark.anyio
    async def test_get_vehicle_seller_excludes_cost_price(self, seller_user):
        """Vendedor NO recibe cost_price en el detalle."""
        mock_db = build_mock_db({
            "vehicles": {"data": [VEHICLE_ROW.copy()], "count": 1},
        })
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.get(f"/api/v1/vehicles/{VEHICLE_ID}")

        assert response.status_code == 200
        data = response.json()
        assert "cost_price" not in data, "Vendedor NO debe ver cost_price"

    # ── Soft delete ────────────────────────────

    @pytest.mark.anyio
    async def test_delete_vehicle_seller_forbidden_403(self, seller_user):
        """Vendedor NO puede eliminar vehículos."""
        mock_db = build_mock_db()
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.delete(f"/api/v1/vehicles/{VEHICLE_ID}")

        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_delete_vehicle_admin_ok(self, admin_user):
        """Admin puede eliminar (soft-delete) un vehículo disponible."""
        mock_db = build_mock_db({
            "vehicles": {"data": [VEHICLE_ROW], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.delete(f"/api/v1/vehicles/{VEHICLE_ID}")

        assert response.status_code == 200
        assert "baja" in response.json().get("message", "").lower()

    # ── Vehículos con alta antigüedad ──────────

    @pytest.mark.anyio
    async def test_stale_vehicles_requires_admin(self, seller_user):
        """GET /vehicles/stale requiere rol admin."""
        mock_db = build_mock_db()
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.get("/api/v1/vehicles/stale")

        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_stale_vehicles_admin_ok(self, admin_user):
        """Admin puede consultar vehículos con alta antigüedad."""
        mock_db = build_mock_db({
            "vehicles": {"data": [LIST_ROW], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get("/api/v1/vehicles/stale?days=90")

        assert response.status_code == 200
        assert isinstance(response.json(), list)

    # ── Historial de precios ───────────────────

    @pytest.mark.anyio
    async def test_price_history_requires_admin(self, seller_user):
        """Historial de precios requiere rol admin."""
        mock_db = build_mock_db()
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.get(f"/api/v1/vehicles/{VEHICLE_ID}/price-history")

        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_price_history_admin_ok(self, admin_user):
        """Admin puede ver el historial de precios."""
        mock_db = build_mock_db({
            "vehicle_price_history": {
                "data": [
                    {
                        "id": "ph-001",
                        "vehicle_id": VEHICLE_ID,
                        "old_price": 16000000,
                        "new_price": 18000000,
                        "created_at": "2024-06-01T10:00:00Z",
                        "changed_by": None,
                    }
                ],
                "count": 1,
            }
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get(f"/api/v1/vehicles/{VEHICLE_ID}/price-history")

        assert response.status_code == 200
        assert isinstance(response.json(), list)
