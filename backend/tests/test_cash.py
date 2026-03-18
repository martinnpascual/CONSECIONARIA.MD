"""
test_cash.py — Tests del módulo Caja y Movimientos Financieros (M06)

Cubre:
  - Control de acceso por rol (solo admin/cajero)
  - Apertura de caja: no puede haber dos cajas abiertas simultáneamente
  - Cierre de caja ya cerrada → 422
  - Sin caja abierta, no se pueden agregar movimientos → 422
  - Resumen de caja del día

Rutas reales del router:
  POST /cash/registers/open         — Abrir caja
  POST /cash/registers/{id}/close   — Cerrar caja
  GET  /cash/registers              — Listar cajas
  GET  /cash/summary                — Resumen de caja activa
  POST /cash/movements              — Agregar movimiento a la caja abierta
  GET  /cash/movements              — Listar movimientos
"""
import pytest
from datetime import date
from unittest.mock import MagicMock

from tests.conftest import build_mock_db, authenticated_client

# ──────────────────────────────────────────────
# Datos de prueba — UUIDs deben ser hexadecimales válidos
# ──────────────────────────────────────────────

REGISTER_ID = "ee000000-0000-0000-0000-000000000001"
ADMIN_ID     = "aa000000-0000-0000-0000-000000000001"  # noqa: E221
CASHIER_ID   = "ca000000-0000-0000-0000-000000000003"  # noqa: E221
MOVEMENT_ID  = "ff000000-0000-0000-0000-000000000001"  # noqa: E221

OPEN_REGISTER = {
    "id": REGISTER_ID,
    "opened_by": ADMIN_ID,
    "closed_by": None,
    "open_date": date.today().isoformat(),
    "opened_at": "2024-03-01T08:00:00+00:00",
    "closed_at": None,
    "status": "abierta",
    "opening_balance_ars": 50000.0,
    "opening_balance_usd": 0.0,
    "closing_balance_ars": None,
    "closing_balance_usd": None,
    "usd_rate": 1100.0,
    "notes": None,
    # opened_by_name / closed_by_name son campos calculados por _enrich_register
    # NO deben estar en los datos que simula la DB o se producirá un TypeError
    # por kwargs duplicados al construir CashRegisterOut(**row, opened_by_name=...).
    "created_at": "2024-03-01T08:00:00+00:00",
    "updated_at": "2024-03-01T08:00:00+00:00",
}

CLOSED_REGISTER = {
    **OPEN_REGISTER,
    "status": "cerrada",
    "closed_by": ADMIN_ID,
    "closed_at": "2024-03-01T18:00:00+00:00",
    "closing_balance_ars": 120000.0,
}

MOVEMENT_ROW = {
    "id": MOVEMENT_ID,
    "cash_register_id": REGISTER_ID,
    "movement_type": "ingreso",
    "category": "cobro_venta",
    "description": "Cobro venta 2024-0001",
    "amount": 500000.0,
    "currency": "ARS",
    "usd_rate": None,
    "payment_method": "transferencia",
    "reference_type": None,
    "reference_id": None,
    "person_id": None,
    "movement_date": date.today().isoformat(),
    "reference": None,
    "notes": None,
    "registered_by": ADMIN_ID,
    # registered_by_name / person_name son calculados por _enrich_movement
    # NO deben estar en los datos simulados de la DB.
    "created_at": "2024-03-01T10:00:00+00:00",
}

OPEN_PAYLOAD = {
    "opening_balance_ars": 50000.0,
    "opening_balance_usd": 0.0,
    "usd_rate": 1100.0,
    "notes": "Apertura de caja del lunes",
}

MOVEMENT_PAYLOAD = {
    "movement_type": "ingreso",
    "category": "cobro_venta",
    "description": "Cobro de venta al contado",
    "amount": 500000.0,
    "currency": "ARS",
    "payment_method": "transferencia",
}


def _build_cash_mock(open_register=None, closed_register=None) -> MagicMock:
    """
    Construye un mock de DB pensado para tests de caja.

    `open_register`:   la caja que get_open_register() va a encontrar (o None).
    `closed_register`: la caja que close_register() va a leer (o None).
    """
    registers = [open_register] if open_register else []
    return build_mock_db({
        "cash_registers": {"data": registers, "count": len(registers)},
        "cash_movements": {"data": [MOVEMENT_ROW], "count": 1},
        "user_profiles": {"data": [{"full_name": "Admin Test"}], "count": 1},
        "v_cash_summary": {"data": [], "count": 0},
    })


# ══════════════════════════════════════════════
# TESTS DE UNIDAD — CashService (sin HTTP)
# ══════════════════════════════════════════════

class TestCashServiceUnit:
    """Tests de lógica de negocio del CashService."""

    @pytest.mark.anyio
    async def test_open_register_conflict_when_already_open(self, admin_user):
        """No se puede abrir una caja si ya hay una abierta → 409."""
        from app.services.cash_service import CashService
        from app.schemas.cash_schemas import CashRegisterOpen
        from fastapi import HTTPException

        mock_db = build_mock_db({
            "cash_registers": {"data": [OPEN_REGISTER], "count": 1},
        })
        service = CashService(mock_db)
        open_data = CashRegisterOpen(opening_balance_ars=0.0, usd_rate=1000.0)

        with pytest.raises(HTTPException) as exc_info:
            await service.open_register(open_data, admin_user)

        assert exc_info.value.status_code == 409
        assert "caja abierta" in exc_info.value.detail.lower()

    @pytest.mark.anyio
    async def test_close_already_closed_register_raises_422(self, admin_user):
        """Cerrar una caja que ya está cerrada lanza 422."""
        from app.services.cash_service import CashService
        from app.schemas.cash_schemas import CashRegisterClose
        from fastapi import HTTPException

        mock_db = build_mock_db({
            "cash_registers": {"data": [CLOSED_REGISTER], "count": 1},
        })
        service = CashService(mock_db)
        close_data = CashRegisterClose(closing_balance_ars=0.0)

        with pytest.raises(HTTPException) as exc_info:
            await service.close_register(REGISTER_ID, close_data, admin_user)

        assert exc_info.value.status_code == 422
        assert "cerrada" in exc_info.value.detail.lower()

    @pytest.mark.anyio
    async def test_require_open_register_raises_422_when_none(self):
        """require_open_register lanza 422 cuando no hay caja abierta."""
        from app.services.cash_service import CashService
        from fastapi import HTTPException

        mock_db = build_mock_db({
            "cash_registers": {"data": [], "count": 0},
        })
        service = CashService(mock_db)

        with pytest.raises(HTTPException) as exc_info:
            await service.require_open_register()

        assert exc_info.value.status_code == 422

    @pytest.mark.anyio
    async def test_add_movement_without_open_register_raises_422(self, admin_user):
        """
        add_movement llama a require_open_register() primero.
        Si no hay caja abierta → 422.
        """
        from app.services.cash_service import CashService
        from app.schemas.cash_schemas import CashMovementCreate
        from fastapi import HTTPException

        # No hay caja abierta
        mock_db = build_mock_db({
            "cash_registers": {"data": [], "count": 0},
        })
        service = CashService(mock_db)
        movement = CashMovementCreate(
            movement_type="ingreso",
            category="cobro_venta",
            description="Test movement",
            amount=1000.0,
            currency="ARS",
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.add_movement(movement, admin_user)

        assert exc_info.value.status_code == 422

    @pytest.mark.anyio
    async def test_get_open_register_returns_none_when_empty(self):
        """get_open_register devuelve None cuando no hay caja abierta."""
        from app.services.cash_service import CashService

        mock_db = build_mock_db({"cash_registers": {"data": [], "count": 0}})
        service = CashService(mock_db)
        result = await service.get_open_register()
        assert result is None

    @pytest.mark.anyio
    async def test_get_open_register_returns_register_when_exists(self):
        """get_open_register devuelve la caja cuando hay una abierta."""
        from app.services.cash_service import CashService

        mock_db = build_mock_db({
            "cash_registers": {"data": [OPEN_REGISTER], "count": 1},
        })
        service = CashService(mock_db)
        result = await service.get_open_register()
        assert result is not None
        assert result["status"] == "abierta"


# ══════════════════════════════════════════════
# TESTS DE ENDPOINT — via HTTP client
# ══════════════════════════════════════════════

class TestCashEndpoints:
    """Tests de integración de endpoints via HTTP."""

    # ── Autenticación ──────────────────────────

    @pytest.mark.anyio
    async def test_list_registers_without_auth_returns_401(self, client):
        """GET /api/v1/cash/registers sin token devuelve 401."""
        response = await client.get("/api/v1/cash/registers")
        assert response.status_code == 401

    @pytest.mark.anyio
    async def test_open_register_without_auth_returns_401(self, client):
        """POST /api/v1/cash/registers/open sin token devuelve 401."""
        response = await client.post("/api/v1/cash/registers/open", json=OPEN_PAYLOAD)
        assert response.status_code == 401

    # ── Control de acceso por rol ──────────────

    @pytest.mark.anyio
    async def test_seller_cannot_list_registers_403(self, seller_user):
        """Vendedor NO puede acceder al módulo de caja."""
        mock_db = build_mock_db()
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.get("/api/v1/cash/registers")

        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_mechanic_cannot_list_registers_403(self, mechanic_user):
        """Mecánico NO puede acceder al módulo de caja."""
        mock_db = build_mock_db()
        async with authenticated_client(mechanic_user, mock_db) as c:
            response = await c.get("/api/v1/cash/registers")

        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_admin_can_list_registers_200(self, admin_user):
        """Admin puede listar cajas."""
        mock_db = build_mock_db({
            "cash_registers": {"data": [], "count": 0},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get("/api/v1/cash/registers")

        assert response.status_code == 200

    @pytest.mark.anyio
    async def test_cashier_can_list_registers_200(self, cashier_user):
        """Cajero puede listar cajas."""
        mock_db = build_mock_db({
            "cash_registers": {"data": [], "count": 0},
        })
        async with authenticated_client(cashier_user, mock_db) as c:
            response = await c.get("/api/v1/cash/registers")

        assert response.status_code == 200

    # ── Apertura de caja ───────────────────────

    @pytest.mark.anyio
    async def test_seller_cannot_open_register_403(self, seller_user):
        """Vendedor NO puede abrir caja."""
        mock_db = build_mock_db()
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.post("/api/v1/cash/registers/open", json=OPEN_PAYLOAD)

        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_mechanic_cannot_open_register_403(self, mechanic_user):
        """Mecánico NO puede abrir caja."""
        mock_db = build_mock_db()
        async with authenticated_client(mechanic_user, mock_db) as c:
            response = await c.post("/api/v1/cash/registers/open", json=OPEN_PAYLOAD)

        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_open_register_admin_returns_201(self, admin_user):
        """Admin puede abrir una caja cuando no hay ninguna abierta → 201."""
        mock_db = _build_open_sequence_mock()
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/cash/registers/open", json=OPEN_PAYLOAD)

        assert response.status_code == 201

    @pytest.mark.anyio
    async def test_cajero_can_open_register_201(self, cashier_user):
        """Cajero también puede abrir caja → 201."""
        mock_db = _build_open_sequence_mock()
        async with authenticated_client(cashier_user, mock_db) as c:
            response = await c.post("/api/v1/cash/registers/open", json=OPEN_PAYLOAD)

        assert response.status_code == 201

    @pytest.mark.anyio
    async def test_open_second_register_returns_409(self, admin_user):
        """Abrir segunda caja cuando ya hay una abierta → 409."""
        mock_db = build_mock_db({
            "cash_registers": {"data": [OPEN_REGISTER], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/cash/registers/open", json=OPEN_PAYLOAD)

        assert response.status_code == 409

    @pytest.mark.anyio
    async def test_open_register_invalid_balance_returns_422(self, admin_user):
        """Saldo inicial negativo devuelve 422."""
        invalid_payload = {**OPEN_PAYLOAD, "opening_balance_ars": -1000}
        mock_db = build_mock_db()
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/cash/registers/open", json=invalid_payload)

        assert response.status_code == 422

    # ── Cierre de caja ─────────────────────────

    @pytest.mark.anyio
    async def test_close_register_admin_returns_200(self, admin_user):
        """Admin puede cerrar una caja abierta → 200."""
        close_payload = {"closing_balance_ars": 120000.0}
        mock_db = build_mock_db({
            "cash_registers": {"data": [OPEN_REGISTER], "count": 1},
            "user_profiles": {"data": [{"full_name": "Admin Test"}], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post(
                f"/api/v1/cash/registers/{REGISTER_ID}/close",
                json=close_payload,
            )

        assert response.status_code == 200

    @pytest.mark.anyio
    async def test_close_nonexistent_register_returns_404(self, admin_user):
        """Cerrar caja inexistente devuelve 404."""
        mock_db = build_mock_db({"cash_registers": {"data": [], "count": 0}})
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post(
                f"/api/v1/cash/registers/{REGISTER_ID}/close",
                json={"closing_balance_ars": 0.0},
            )

        assert response.status_code == 404

    # ── Movimientos ────────────────────────────

    @pytest.mark.anyio
    async def test_add_movement_requires_open_register(self, admin_user):
        """Si no hay caja abierta, agregar movimiento devuelve 422."""
        mock_db = build_mock_db({
            "cash_registers": {"data": [], "count": 0},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/cash/movements", json=MOVEMENT_PAYLOAD)

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_add_movement_to_open_register_returns_201(self, admin_user):
        """Admin puede agregar un movimiento a la caja abierta."""
        mock_db = build_mock_db({
            "cash_registers": {"data": [OPEN_REGISTER], "count": 1},
            "cash_movements": {"data": [MOVEMENT_ROW], "count": 1},
            "user_profiles": {"data": [{"full_name": "Admin Test"}], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/cash/movements", json=MOVEMENT_PAYLOAD)

        assert response.status_code == 201

    @pytest.mark.anyio
    async def test_movement_missing_description_returns_422(self, admin_user):
        """Movimiento sin descripción (required) devuelve 422."""
        invalid_movement = {k: v for k, v in MOVEMENT_PAYLOAD.items()
                            if k != "description"}
        mock_db = build_mock_db()
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/cash/movements", json=invalid_movement)

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_movement_negative_amount_returns_422(self, admin_user):
        """Monto negativo en movimiento devuelve 422."""
        invalid_movement = {**MOVEMENT_PAYLOAD, "amount": -100.0}
        mock_db = build_mock_db()
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/cash/movements", json=invalid_movement)

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_movement_seller_forbidden_403(self, seller_user):
        """Vendedor NO puede registrar movimientos de caja."""
        mock_db = build_mock_db()
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.post("/api/v1/cash/movements", json=MOVEMENT_PAYLOAD)

        assert response.status_code == 403

    # ── Resumen de caja ────────────────────────

    @pytest.mark.anyio
    async def test_get_cash_summary_admin_returns_200(self, admin_user):
        """Admin puede obtener el resumen de caja del día."""
        mock_db = build_mock_db({
            "cash_registers": {"data": [OPEN_REGISTER], "count": 1},
            "v_cash_summary": {"data": [], "count": 0},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get("/api/v1/cash/summary")

        # 200 si hay caja abierta; 404 si no hay datos del summary view
        assert response.status_code in (200, 404)

    @pytest.mark.anyio
    async def test_seller_cannot_get_summary_403(self, seller_user):
        """Vendedor NO puede ver el resumen de caja."""
        mock_db = build_mock_db()
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.get("/api/v1/cash/summary")

        assert response.status_code == 403


# ──────────────────────────────────────────────
# Helpers locales
# ──────────────────────────────────────────────

def _build_open_sequence_mock() -> MagicMock:
    """
    Mock que simula la secuencia de apertura de caja:
    1ª consulta a cash_registers → vacío (no hay caja abierta)
    2ª consulta a cash_registers → la caja recién creada
    """
    call_count = [0]

    def _make_chain(data, count):
        result = MagicMock()
        result.data = data
        result.count = count
        single_result = MagicMock()
        single_result.data = data[0] if data else None

        single_chain = MagicMock()
        for m in ("select", "eq", "is_", "order", "range", "limit",
                  "insert", "update", "delete"):
            getattr(single_chain, m).return_value = single_chain
        single_chain.execute.return_value = single_result

        chain = MagicMock()
        for m in ("select", "eq", "is_", "order", "range", "limit",
                  "insert", "update", "delete"):
            getattr(chain, m).return_value = chain
        chain.single.return_value = single_chain
        chain.execute.return_value = result
        return chain

    db = MagicMock()

    def _table_effect(name):
        if name == "cash_registers":
            call_count[0] += 1
            if call_count[0] == 1:
                # Primera llamada: no hay caja abierta
                return _make_chain([], 0)
            else:
                # Segunda llamada (insert/read): devuelve la caja creada
                return _make_chain([OPEN_REGISTER], 1)
        elif name == "user_profiles":
            return _make_chain([{"full_name": "Admin Test"}], 1)
        else:
            return _make_chain([], 0)

    db.table.side_effect = _table_effect
    db.storage = MagicMock()
    return db
