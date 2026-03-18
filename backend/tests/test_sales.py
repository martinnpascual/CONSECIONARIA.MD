"""
test_sales.py — Tests del módulo de Ventas (M03)

Cubre:
  - Calculadora de financiamiento (sistema francés) — tests PUROS sin DB
  - Endpoints: list, create, get, update
  - Control de acceso por rol
  - Vendedor solo ve sus propias ventas
  - Calculadora endpoint POST /sales/financing/calculate
"""
import pytest
from decimal import Decimal

from tests.conftest import build_mock_db, authenticated_client

# ──────────────────────────────────────────────
# Datos de prueba
# ──────────────────────────────────────────────

SALE_ID = "dddd0000-0000-0000-0000-000000000001"
VEHICLE_ID = "aaaa0000-0000-0000-0000-000000000001"
CLIENT_ID = "cccc0000-0000-0000-0000-000000000001"
SELLER_ID = "5e110000-0000-0000-0000-000000000002"  # UUID hex válido

SALE_ROW = {
    "id": SALE_ID,
    "sale_number": "2024-0001",
    "status": "cotizacion",
    "sale_date": "2024-03-01",
    "operation_type": "contado",
    # Precios — deben coincidir con SaleOut schema
    "list_price": 18000000.00,
    "sale_price": 18000000.00,
    "discount": 0.00,
    "final_price": 18000000.00,
    # Financiamiento (opcionales)
    "financed_amount": None,
    "financing_bank": None,
    "installments": None,
    "installment_value": None,
    "interest_rate": None,
    "savings_plan_name": None,
    # Comisiones
    "commission_amount": None,
    "commission_paid": False,
    # Claves foráneas
    "client_id": CLIENT_ID,
    "vehicle_id": VEHICLE_ID,
    "seller_id": SELLER_ID,
    "trade_in_id": None,
    # Metadatos
    "observations": None,
    "cancellation_reason": None,
    "delivery_date": None,
    "deleted_at": None,
    "created_at": "2024-03-01T09:00:00Z",
    "updated_at": "2024-03-01T09:00:00Z",
    # Joins anidados (popeados por el servicio al enriquecer)
    "persons": {"first_name": "Juan", "last_name": "Pérez"},
    "vehicles": {
        "brand": "Toyota", "model": "Corolla",
        "year": 2020, "version": "XEI",
        "list_price": 18000000, "cost_price": 15000000,
    },
    "user_profiles": {"full_name": "Vendedor Test"},
}

SALE_CREATE_PAYLOAD = {
    "client_id": CLIENT_ID,
    "vehicle_id": VEHICLE_ID,
    "operation_type": "contado",
    "sale_price": 18000000,
    "discount": 0,
}


# ══════════════════════════════════════════════
# TESTS DE UNIDAD — Calculadora Francesa (sin DB, sin HTTP)
# ══════════════════════════════════════════════

class TestFinancingCalculator:
    """
    Tests PUROS de la calculadora de cuotas (sistema francés).
    No requieren mock de DB ni cliente HTTP.
    """

    def _get_service(self):
        """Instancia del SaleService con DB mock vacío (no se usa en estos tests)."""
        from app.services.sale_service import SaleService
        from unittest.mock import MagicMock
        return SaleService(MagicMock())

    def _make_request(self, **kwargs):
        from app.schemas.sale_schemas import FinancingRequest
        defaults = {
            "vehicle_price": Decimal("10000000"),
            "down_payment": Decimal("0"),
            "trade_in_value": Decimal("0"),
            "annual_rate": Decimal("60"),
            "installments": 12,
        }
        defaults.update(kwargs)
        return FinancingRequest(**defaults)

    def test_financed_amount_is_price_minus_down_minus_tradein(self):
        """financed_amount = vehicle_price - down_payment - trade_in_value."""
        service = self._get_service()
        req = self._make_request(
            vehicle_price=Decimal("10000000"),
            down_payment=Decimal("2000000"),
            trade_in_value=Decimal("1000000"),
        )
        result = service.calculate_financing(req)
        assert result.financed_amount == Decimal("7000000")

    def test_total_equals_installment_times_count(self):
        """total_to_pay == installment_value * installments."""
        service = self._get_service()
        req = self._make_request(
            vehicle_price=Decimal("5000000"),
            annual_rate=Decimal("48"),
            installments=24,
        )
        result = service.calculate_financing(req)
        expected_total = result.installment_value * result.installments
        assert abs(result.total_to_pay - expected_total) < Decimal("1"), (
            "total_to_pay debe ser igual a installment_value × installments"
        )

    def test_total_interest_is_total_minus_principal(self):
        """total_interest = total_to_pay - financed_amount."""
        service = self._get_service()
        req = self._make_request(
            vehicle_price=Decimal("8000000"),
            annual_rate=Decimal("72"),
            installments=36,
        )
        result = service.calculate_financing(req)
        assert abs(result.total_interest - (result.total_to_pay - result.financed_amount)) < Decimal("1")

    def test_zero_rate_gives_equal_installments(self):
        """Con tasa 0%, todas las cuotas son iguales (capital / n)."""
        service = self._get_service()
        req = self._make_request(
            vehicle_price=Decimal("12000000"),
            annual_rate=Decimal("0.0001"),  # aprox cero (no puede ser exactamente 0 por el schema)
            installments=12,
        )
        result = service.calculate_financing(req)
        # Con tasa casi 0, la cuota debe ser ≈ capital / n
        expected = result.financed_amount / 12
        assert abs(result.installment_value - expected) < Decimal("10000"), (
            "Con tasa casi cero, cuota ≈ capital / n"
        )

    def test_down_payment_reduces_financed_amount(self):
        """Un pago inicial mayor reduce el monto financiado."""
        service = self._get_service()

        req_no_down = self._make_request(
            vehicle_price=Decimal("10000000"),
            down_payment=Decimal("0"),
            annual_rate=Decimal("60"),
            installments=12,
        )
        req_with_down = self._make_request(
            vehicle_price=Decimal("10000000"),
            down_payment=Decimal("3000000"),
            annual_rate=Decimal("60"),
            installments=12,
        )

        result_no = service.calculate_financing(req_no_down)
        result_with = service.calculate_financing(req_with_down)

        assert result_with.financed_amount < result_no.financed_amount
        assert result_with.installment_value < result_no.installment_value

    def test_trade_in_reduces_financed_amount(self):
        """El valor del tomado de usado reduce el monto financiado."""
        service = self._get_service()

        req_no_ti = self._make_request(
            vehicle_price=Decimal("15000000"),
            trade_in_value=Decimal("0"),
        )
        req_with_ti = self._make_request(
            vehicle_price=Decimal("15000000"),
            trade_in_value=Decimal("5000000"),
        )

        r_no = service.calculate_financing(req_no_ti)
        r_with = service.calculate_financing(req_with_ti)

        assert r_with.financed_amount == r_no.financed_amount - Decimal("5000000")

    def test_full_coverage_by_down_payment_raises_400(self):
        """Si down_payment + trade_in_value >= vehicle_price, lanza 400."""
        from fastapi import HTTPException
        service = self._get_service()
        req = self._make_request(
            vehicle_price=Decimal("5000000"),
            down_payment=Decimal("3000000"),
            trade_in_value=Decimal("2000000"),  # suma = precio -> financiado = 0
        )

        with pytest.raises(HTTPException) as exc_info:
            service.calculate_financing(req)

        assert exc_info.value.status_code == 400

    def test_monthly_rate_is_annual_divided_by_12(self):
        """Tasa mensual = tasa anual / 12 / 100."""
        service = self._get_service()
        req = self._make_request(annual_rate=Decimal("24"))
        result = service.calculate_financing(req)

        expected_monthly = Decimal("24") / 12 / 100
        assert abs(result.monthly_rate - expected_monthly) < Decimal("0.00001")

    def test_installment_is_positive(self):
        """La cuota siempre es un valor positivo."""
        service = self._get_service()
        req = self._make_request(
            vehicle_price=Decimal("20000000"),
            annual_rate=Decimal("90"),
            installments=48,
        )
        result = service.calculate_financing(req)
        assert result.installment_value > 0

    def test_result_fields_are_decimal(self):
        """Todos los montos del resultado son Decimal (no float)."""
        service = self._get_service()
        req = self._make_request()
        result = service.calculate_financing(req)

        for field_name in (
            "financed_amount", "installment_value",
            "total_to_pay", "total_interest", "cft",
        ):
            value = getattr(result, field_name)
            assert isinstance(value, Decimal), (
                f"{field_name} debe ser Decimal, no {type(value).__name__}"
            )


# ══════════════════════════════════════════════
# TESTS DE ENDPOINT — via HTTP client
# ══════════════════════════════════════════════

class TestSalesEndpoints:
    """Tests de integración de endpoints via HTTP."""

    # ── Autenticación ──────────────────────────

    @pytest.mark.anyio
    async def test_list_sales_without_auth_returns_401(self, client):
        """GET /api/v1/sales sin token devuelve 401."""
        response = await client.get("/api/v1/sales")
        assert response.status_code == 401

    # ── Calculadora de financiamiento ──────────

    @pytest.mark.anyio
    async def test_financing_endpoint_ok(self, seller_user):
        """POST /sales/financing/calculate devuelve resultado correcto."""
        payload = {
            "vehicle_price": 10000000,
            "down_payment": 2000000,
            "trade_in_value": 0,
            "annual_rate": 60,
            "installments": 12,
        }
        mock_db = build_mock_db()
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.post("/api/v1/sales/financing/calculate", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "installment_value" in data
        assert "total_to_pay" in data
        assert "financed_amount" in data
        assert float(data["financed_amount"]) == 8000000.0

    @pytest.mark.anyio
    async def test_financing_endpoint_negative_financed_returns_400(self, seller_user):
        """Si el pago cubre el total, devuelve 400."""
        payload = {
            "vehicle_price": 5000000,
            "down_payment": 3000000,
            "trade_in_value": 2000000,  # suma = precio -> financiado = 0
            "annual_rate": 60,
            "installments": 12,
        }
        mock_db = build_mock_db()
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.post("/api/v1/sales/financing/calculate", json=payload)

        assert response.status_code == 400

    @pytest.mark.anyio
    async def test_financing_endpoint_invalid_installments_returns_422(self, seller_user):
        """Cuotas fuera de rango (> 120) devuelve 422."""
        payload = {
            "vehicle_price": 10000000,
            "down_payment": 0,
            "trade_in_value": 0,
            "annual_rate": 60,
            "installments": 200,  # > 120
        }
        mock_db = build_mock_db()
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.post("/api/v1/sales/financing/calculate", json=payload)

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_financing_mechanic_allowed_200(self, mechanic_user):
        """
        El endpoint /sales/financing/calculate usa get_current_user (no require_admin_or_seller).
        Cualquier usuario autenticado puede usar la calculadora.
        """
        payload = {
            "vehicle_price": 10000000,
            "down_payment": 0,
            "trade_in_value": 0,
            "annual_rate": 60,
            "installments": 12,
        }
        mock_db = build_mock_db()
        async with authenticated_client(mechanic_user, mock_db) as c:
            response = await c.post("/api/v1/sales/financing/calculate", json=payload)

        assert response.status_code == 200

    # ── Listar ventas ──────────────────────────

    @pytest.mark.anyio
    async def test_list_sales_admin_returns_200(self, admin_user):
        """Admin puede listar ventas con paginación."""
        mock_db = build_mock_db({
            "sales": {"data": [{**SALE_ROW}], "count": 1},
            "sale_payments": {"data": [], "count": 0},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get("/api/v1/sales")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert data["total"] == 1

    @pytest.mark.anyio
    async def test_list_sales_cashier_allowed_200(self, cashier_user):
        """
        GET /api/v1/sales usa get_current_user — cualquier rol autenticado puede listar.
        El filtro es por vendedor, no bloquea el acceso a otros roles.
        """
        mock_db = build_mock_db({"sales": {"data": [], "count": 0}})
        async with authenticated_client(cashier_user, mock_db) as c:
            response = await c.get("/api/v1/sales")

        assert response.status_code == 200

    @pytest.mark.anyio
    async def test_list_sales_mechanic_allowed_200(self, mechanic_user):
        """
        GET /api/v1/sales usa get_current_user — mecánico también puede listar.
        """
        mock_db = build_mock_db({"sales": {"data": [], "count": 0}})
        async with authenticated_client(mechanic_user, mock_db) as c:
            response = await c.get("/api/v1/sales")

        assert response.status_code == 200

    # ── Crear venta ────────────────────────────

    @pytest.mark.anyio
    async def test_create_sale_admin_returns_201(self, admin_user):
        """Admin puede crear una venta."""
        mock_db = build_mock_db({
            "vehicles": {
                "data": [{"id": VEHICLE_ID, "status": "disponible",
                          "list_price": 18000000, "cost_price": 15000000}],
                "count": 1,
            },
            "persons": {"data": [{"id": CLIENT_ID}], "count": 1},
            "sales": {"data": [{**SALE_ROW}], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/sales", json=SALE_CREATE_PAYLOAD)

        assert response.status_code == 201

    @pytest.mark.anyio
    async def test_create_sale_seller_returns_201(self, seller_user):
        """Vendedor puede crear una venta."""
        mock_db = build_mock_db({
            "vehicles": {
                "data": [{"id": VEHICLE_ID, "status": "disponible",
                          "list_price": 18000000, "cost_price": 15000000}],
                "count": 1,
            },
            "persons": {"data": [{"id": CLIENT_ID}], "count": 1},
            "sales": {"data": [{**SALE_ROW}], "count": 1},
        })
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.post("/api/v1/sales", json=SALE_CREATE_PAYLOAD)

        assert response.status_code == 201

    @pytest.mark.anyio
    async def test_create_sale_cashier_forbidden_403(self, cashier_user):
        """Cajero no puede crear ventas."""
        mock_db = build_mock_db()
        async with authenticated_client(cashier_user, mock_db) as c:
            response = await c.post("/api/v1/sales", json=SALE_CREATE_PAYLOAD)

        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_create_sale_mechanic_forbidden_403(self, mechanic_user):
        """Mecánico no puede crear ventas."""
        mock_db = build_mock_db()
        async with authenticated_client(mechanic_user, mock_db) as c:
            response = await c.post("/api/v1/sales", json=SALE_CREATE_PAYLOAD)

        assert response.status_code == 403

    # ── Detalle de venta ───────────────────────

    @pytest.mark.anyio
    async def test_get_sale_admin_returns_200(self, admin_user):
        """Admin puede ver el detalle de una venta."""
        mock_db = build_mock_db({
            # Usar copia para que las mutaciones (pop) no afecten SALE_ROW global
            "sales": {"data": [{**SALE_ROW}], "count": 1},
            "sale_payments": {"data": [], "count": 0},
            "trade_ins": {"data": [], "count": 0},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get(f"/api/v1/sales/{SALE_ID}")

        assert response.status_code == 200
        data = response.json()
        assert data["sale_number"] == "2024-0001"

    @pytest.mark.anyio
    async def test_get_sale_not_found_returns_404(self, admin_user):
        """GET de venta inexistente devuelve 404."""
        mock_db = build_mock_db({"sales": {"data": [], "count": 0}})
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get(f"/api/v1/sales/{SALE_ID}")

        assert response.status_code == 404

    # ── Ventas del vendedor ────────────────────

    @pytest.mark.anyio
    async def test_seller_only_sees_own_sales(self, seller_user):
        """El servicio aplica filtro por seller_id para vendedores."""
        from app.services.sale_service import SaleService
        from app.schemas.sale_schemas import SaleFilters

        eq_calls: list = []

        mock_db = build_mock_db({
            "sales": {"data": [], "count": 0},
            "sale_payments": {"data": [], "count": 0},
        })

        # Envolver side_effect para capturar llamadas a .eq() en la tabla "sales"
        original_side_effect = mock_db.table.side_effect

        def tracking_side_effect(name: str):
            chain = original_side_effect(name)
            if name == "sales":
                original_eq = chain.eq

                def tracked_eq(*args, **kwargs):
                    eq_calls.append(args)
                    return original_eq(*args, **kwargs)

                chain.eq = tracked_eq
            return chain

        mock_db.table.side_effect = tracking_side_effect

        service = SaleService(mock_db)
        filters = SaleFilters(page=1, per_page=20)
        await service.list_sales(filters, seller_user)

        seller_filter_applied = any(
            len(a) > 0 and a[0] == "seller_id"
            for a in eq_calls
        )
        assert seller_filter_applied, (
            "El service debe filtrar ventas por seller_id para vendedor"
        )
