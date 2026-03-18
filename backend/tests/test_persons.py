"""
test_persons.py — Tests del módulo CRM — Personas y Leads (M02)

Cubre:
  - Endpoints: list, create, get, update, delete, interactions
  - Control de acceso por rol
  - Vendedor solo ve sus personas asignadas
  - Kanban de leads
  - Validaciones de enums (person_type, lead_status, origin_channel)
"""
import pytest
from unittest.mock import MagicMock

from tests.conftest import build_mock_db, authenticated_client

# ──────────────────────────────────────────────
# Datos de prueba
# ──────────────────────────────────────────────

PERSON_ID = "cccc0000-0000-0000-0000-000000000001"
SELLER_ID = "seller-000-0000-0000-000000000002"

PERSON_ROW = {
    "id": PERSON_ID,
    "person_type": "lead",
    "first_name": "Juan",
    "last_name": "Pérez",
    "dni_cuit": "30123456",
    "iva_condition": "consumidor_final",
    "birth_date": None,
    "email": "juan@test.com",
    "phone": "1123456789",
    "whatsapp": "1123456789",
    "address": "Av. Siempre Viva 742",
    "city": "Buenos Aires",
    "province": "Buenos Aires",
    "postal_code": "1425",
    "origin_channel": "instagram",
    "lead_status": "nuevo",
    "next_contact_date": None,
    "balance": 0,
    "assigned_seller_id": SELLER_ID,
    "notes": None,
    "deleted_at": None,
    "created_at": "2024-03-01T10:00:00Z",
    "updated_at": "2024-03-01T10:00:00Z",
}

PERSON_LIST_ROW = {
    "id": PERSON_ID,
    "person_type": "lead",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@test.com",
    "phone": "1123456789",
    "origin_channel": "instagram",
    "lead_status": "nuevo",
    "next_contact_date": None,
    "balance": 0,
    "created_at": "2024-03-01T10:00:00Z",
    "assigned_seller_id": SELLER_ID,
    "user_profiles": {"full_name": "Vendedor Test"},
}

PERSON_CREATE_PAYLOAD = {
    "first_name": "María",
    "last_name": "García",
    "person_type": "lead",
    "phone": "1198765432",
    "email": "maria@test.com",
    "origin_channel": "showroom",
    "lead_status": "nuevo",
}

INTERACTION_ROW = {
    "id": "inter-001-0000-0000-000000000001",
    "person_id": PERSON_ID,
    "interaction_type": "llamada",
    "notes": "Interesado en Corolla",
    "next_contact_date": None,
    "created_by": SELLER_ID,
    "created_at": "2024-03-02T10:00:00Z",
}


# ══════════════════════════════════════════════
# TESTS DE UNIDAD — PersonService
# ══════════════════════════════════════════════

class TestPersonServiceUnit:
    """Tests de lógica de negocio del service (sin HTTP)."""

    @pytest.mark.anyio
    async def test_seller_filter_applied_in_list(self, seller_user):
        """
        Al listar personas, el vendedor SOLO debe recibir las que
        tienen su ID en assigned_seller_id.
        """
        from app.services.person_service import PersonService
        from app.schemas.person_schemas import PersonFilters

        eq_calls: list = []

        mock_db = build_mock_db({
            "persons": {"data": [PERSON_LIST_ROW], "count": 1},
        })

        # Envolver side_effect para capturar llamadas a .eq() en la tabla "persons"
        original_side_effect = mock_db.table.side_effect

        def tracking_side_effect(name: str):
            chain = original_side_effect(name)
            if name == "persons":
                original_eq = chain.eq

                def tracked_eq(*args, **kwargs):
                    eq_calls.append(args)
                    return original_eq(*args, **kwargs)

                chain.eq = tracked_eq
            return chain

        mock_db.table.side_effect = tracking_side_effect

        service = PersonService(mock_db)
        filters = PersonFilters(page=1, per_page=20)
        await service.list_persons(filters, seller_user)

        # Verificar que la query incluyó filtro por assigned_seller_id
        seller_filter_applied = any(
            len(a) > 0 and a[0] == "assigned_seller_id"
            for a in eq_calls
        )
        assert seller_filter_applied, (
            "El service debe filtrar personas por assigned_seller_id para vendedor"
        )

    @pytest.mark.anyio
    async def test_admin_does_not_filter_by_seller(self, admin_user):
        """Admin lista todas las personas sin filtro de vendedor."""
        from app.services.person_service import PersonService
        from app.schemas.person_schemas import PersonFilters

        mock_db = build_mock_db({
            "persons": {"data": [PERSON_LIST_ROW], "count": 1},
        })
        service = PersonService(mock_db)
        filters = PersonFilters(page=1, per_page=20)
        result = await service.list_persons(filters, admin_user)

        # No debe filtrar por seller en el eq
        call_args = mock_db.table.return_value.eq.call_args_list
        seller_filter_applied = any(
            len(c.args) > 0 and c.args[0] == "assigned_seller_id"
            for c in call_args
        )
        assert not seller_filter_applied, "Admin NO debe filtrar por assigned_seller_id"

    @pytest.mark.anyio
    async def test_get_person_not_found_raises_404(self, admin_user):
        """Buscar persona inexistente lanza 404."""
        from app.services.person_service import PersonService
        from fastapi import HTTPException

        mock_db = build_mock_db({"persons": {"data": [], "count": 0}})
        service = PersonService(mock_db)

        with pytest.raises(HTTPException) as exc_info:
            await service.get_person(PERSON_ID, admin_user)

        assert exc_info.value.status_code == 404


# ══════════════════════════════════════════════
# TESTS DE ENDPOINT — via HTTP client
# ══════════════════════════════════════════════

class TestPersonsEndpoints:
    """Tests de integración de endpoints via HTTP."""

    # ── Autenticación ──────────────────────────

    @pytest.mark.anyio
    async def test_list_persons_without_auth_returns_401(self, client):
        """GET /api/v1/persons sin token devuelve 401."""
        response = await client.get("/api/v1/persons")
        assert response.status_code == 401

    @pytest.mark.anyio
    async def test_create_person_without_auth_returns_401(self, client):
        """POST /api/v1/persons sin token devuelve 401."""
        response = await client.post("/api/v1/persons", json=PERSON_CREATE_PAYLOAD)
        assert response.status_code == 401

    # ── Acceso por rol ─────────────────────────

    @pytest.mark.anyio
    async def test_mechanic_can_list_persons_200(self, mechanic_user):
        """
        El endpoint GET /persons usa Depends(get_current_user) — cualquier rol
        autenticado puede listar. El router no restringe a admin/vendedor.
        """
        mock_db = build_mock_db({
            "persons": {"data": [], "count": 0},
        })
        async with authenticated_client(mechanic_user, mock_db) as c:
            response = await c.get("/api/v1/persons")

        assert response.status_code == 200

    @pytest.mark.anyio
    async def test_cashier_can_list_persons_200(self, cashier_user):
        """
        Igual que mecánico — cajero puede listar personas (sin restricción de rol
        en el endpoint de listado).
        """
        mock_db = build_mock_db({
            "persons": {"data": [], "count": 0},
        })
        async with authenticated_client(cashier_user, mock_db) as c:
            response = await c.get("/api/v1/persons")

        assert response.status_code == 200

    # ── Listar personas ────────────────────────

    @pytest.mark.anyio
    async def test_list_persons_admin_returns_200(self, admin_user):
        """Admin lista personas con paginación correcta."""
        mock_db = build_mock_db({
            "persons": {"data": [PERSON_LIST_ROW], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get("/api/v1/persons")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert data["total"] == 1
        assert data["items"][0]["first_name"] == "Juan"

    @pytest.mark.anyio
    async def test_list_persons_seller_returns_200(self, seller_user):
        """Vendedor puede listar sus personas."""
        mock_db = build_mock_db({
            "persons": {"data": [PERSON_LIST_ROW], "count": 1},
        })
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.get("/api/v1/persons")

        assert response.status_code == 200

    @pytest.mark.anyio
    async def test_list_persons_with_search_filter(self, admin_user):
        """El parámetro `search` se acepta sin errores."""
        mock_db = build_mock_db({
            "persons": {"data": [], "count": 0},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get("/api/v1/persons?search=Juan")

        assert response.status_code == 200

    # ── Crear persona ──────────────────────────

    @pytest.mark.anyio
    async def test_create_person_admin_returns_201(self, admin_user):
        """Admin puede crear una persona."""
        mock_db = build_mock_db({
            "persons": {"data": [{**PERSON_ROW, "id": "new-person-id"}], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/persons", json=PERSON_CREATE_PAYLOAD)

        assert response.status_code == 201

    @pytest.mark.anyio
    async def test_create_person_seller_returns_201(self, seller_user):
        """Vendedor puede crear una persona."""
        mock_db = build_mock_db({
            "persons": {"data": [{**PERSON_ROW, "id": "new-person-id"}], "count": 1},
        })
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.post("/api/v1/persons", json=PERSON_CREATE_PAYLOAD)

        assert response.status_code == 201

    @pytest.mark.anyio
    async def test_create_person_invalid_type_returns_422(self, admin_user):
        """Tipo de persona inválido devuelve 422."""
        invalid_payload = {**PERSON_CREATE_PAYLOAD, "person_type": "robot"}
        mock_db = build_mock_db()
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/persons", json=invalid_payload)

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_create_person_invalid_channel_returns_422(self, admin_user):
        """Canal de origen inválido devuelve 422."""
        invalid_payload = {**PERSON_CREATE_PAYLOAD, "origin_channel": "tiktok"}
        mock_db = build_mock_db()
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/persons", json=invalid_payload)

        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_create_person_missing_required_field_returns_422(self, admin_user):
        """Falta first_name devuelve 422."""
        incomplete_payload = {k: v for k, v in PERSON_CREATE_PAYLOAD.items()
                              if k != "first_name"}
        mock_db = build_mock_db()
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post("/api/v1/persons", json=incomplete_payload)

        assert response.status_code == 422

    # ── Detalle de persona ─────────────────────

    @pytest.mark.anyio
    async def test_get_person_not_found_returns_404(self, admin_user):
        """GET de persona inexistente devuelve 404."""
        mock_db = build_mock_db({
            "persons": {"data": [], "count": 0},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get(f"/api/v1/persons/{PERSON_ID}")

        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_get_person_admin_returns_200(self, admin_user):
        """Admin puede ver el detalle de una persona."""
        mock_db = build_mock_db({
            "persons": {"data": [PERSON_ROW], "count": 1},
            "interactions": {"data": [], "count": 0},
            "sales": {"data": [], "count": 0},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get(f"/api/v1/persons/{PERSON_ID}")

        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == "Juan"

    # ── Interacciones ──────────────────────────

    @pytest.mark.anyio
    async def test_create_interaction_admin_returns_201(self, admin_user):
        """Admin puede registrar una interacción para una persona."""
        interaction_payload = {
            "interaction_type": "llamada",
            "notes": "Interesado en Corolla",
        }
        mock_db = build_mock_db({
            "persons": {"data": [PERSON_ROW], "count": 1},
            "interactions": {"data": [INTERACTION_ROW], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.post(
                f"/api/v1/persons/{PERSON_ID}/interactions",
                json=interaction_payload,
            )

        assert response.status_code == 201

    @pytest.mark.anyio
    async def test_create_interaction_seller_returns_201(self, seller_user):
        """Vendedor puede registrar interacciones."""
        interaction_payload = {
            "interaction_type": "whatsapp",
            "notes": "Se envió cotización",
        }
        mock_db = build_mock_db({
            "persons": {"data": [PERSON_ROW], "count": 1},
            "interactions": {"data": [INTERACTION_ROW], "count": 1},
        })
        async with authenticated_client(seller_user, mock_db) as c:
            response = await c.post(
                f"/api/v1/persons/{PERSON_ID}/interactions",
                json=interaction_payload,
            )

        assert response.status_code == 201

    # ── Kanban de leads ────────────────────────

    @pytest.mark.anyio
    async def test_get_kanban_admin_returns_200(self, admin_user):
        """Admin puede ver el tablero Kanban de leads."""
        mock_db = build_mock_db({
            "persons": {"data": [PERSON_LIST_ROW], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.get("/api/v1/persons/kanban")

        assert response.status_code == 200
        data = response.json()
        assert "columns" in data

    @pytest.mark.anyio
    async def test_mechanic_can_see_kanban_200(self, mechanic_user):
        """
        GET /persons/kanban también usa get_current_user (cualquier rol autenticado).
        """
        mock_db = build_mock_db({
            "persons": {"data": [], "count": 0},
        })
        async with authenticated_client(mechanic_user, mock_db) as c:
            response = await c.get("/api/v1/persons/kanban")

        assert response.status_code == 200

    # ── Delete persona ─────────────────────────

    @pytest.mark.anyio
    async def test_delete_person_admin_returns_200(self, admin_user):
        """Admin puede dar de baja (soft-delete) una persona."""
        mock_db = build_mock_db({
            "persons": {"data": [PERSON_ROW], "count": 1},
        })
        async with authenticated_client(admin_user, mock_db) as c:
            response = await c.delete(f"/api/v1/persons/{PERSON_ID}")

        assert response.status_code == 200

    @pytest.mark.anyio
    async def test_delete_person_mechanic_forbidden_403(self, mechanic_user):
        """Mecánico no puede dar de baja personas."""
        mock_db = build_mock_db()
        async with authenticated_client(mechanic_user, mock_db) as c:
            response = await c.delete(f"/api/v1/persons/{PERSON_ID}")

        assert response.status_code == 403
