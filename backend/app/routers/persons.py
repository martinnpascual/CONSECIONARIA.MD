"""
routers/persons.py — Endpoints del módulo CRM

Personas (leads/clientes), interacciones y pipeline Kanban.
Los routers solo coordinan; toda la lógica está en person_service.py.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from supabase import Client

from app.schemas.person_schemas import (
    AccountStatement,
    InteractionCreate,
    KanbanBoard,
    PaginatedPersons,
    PersonCreate,
    PersonFilters,
    PersonUpdate,
    VehicleInterestCreate,
)
from app.services.person_service import PersonService
from app.supabase_client import get_supabase_admin
from app.utils.security import (
    CurrentUser,
    get_current_user,
    require_admin,
    require_admin_or_seller,
)

router = APIRouter(prefix="/persons", tags=["CRM — Personas"])


def get_person_service(db: Client = Depends(get_supabase_admin)) -> PersonService:
    return PersonService(db)


# ──────────────────────────────────────────────
# GET /persons — Listar personas
# ──────────────────────────────────────────────
@router.get("", response_model=PaginatedPersons)
async def list_persons(
    search: Optional[str] = Query(default=None, description="Nombre, DNI, email, teléfono"),
    person_type: Optional[str] = Query(default=None),
    lead_status: Optional[str] = Query(default=None),
    origin_channel: Optional[str] = Query(default=None),
    assigned_seller_id: Optional[UUID] = Query(default=None),
    has_pending_contact: Optional[bool] = Query(default=None, description="Filtrar con seguimiento vencido"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    service: PersonService = Depends(get_person_service),
):
    """
    Lista personas con filtros. Vendedores solo ven las suyas.
    """
    filters = PersonFilters(
        search=search,
        person_type=person_type,
        lead_status=lead_status,
        origin_channel=origin_channel,
        assigned_seller_id=assigned_seller_id,
        has_pending_contact=has_pending_contact,
        page=page,
        per_page=per_page,
    )
    return await service.list_persons(filters, current_user)


# ──────────────────────────────────────────────
# GET /persons/kanban — Pipeline Kanban
# ──────────────────────────────────────────────
@router.get("/kanban", response_model=KanbanBoard)
async def get_kanban(
    seller_id: Optional[UUID] = Query(default=None, description="Filtrar por vendedor (solo admin)"),
    current_user: CurrentUser = Depends(get_current_user),
    service: PersonService = Depends(get_person_service),
):
    """
    Pipeline Kanban de leads agrupado por etapa.
    Incluye última interacción, días sin contacto y vehículos de interés.
    Vendedor: solo sus leads. Admin: todos o por vendedor.
    """
    return await service.get_kanban(current_user, seller_id)


# ──────────────────────────────────────────────
# GET /persons/{id} — Detalle de persona
# ──────────────────────────────────────────────
@router.get("/{person_id}")
async def get_person(
    person_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: PersonService = Depends(get_person_service),
):
    """Detalle completo de una persona con su perfil CRM."""
    return await service.get_person(person_id, current_user)


# ──────────────────────────────────────────────
# POST /persons — Crear persona
# ──────────────────────────────────────────────
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_person(
    data: PersonCreate,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: PersonService = Depends(get_person_service),
):
    """Crea un nuevo lead o cliente. El vendedor queda asignado automáticamente."""
    return await service.create_person(data, current_user)


# ──────────────────────────────────────────────
# PUT /persons/{id} — Actualizar persona
# ──────────────────────────────────────────────
@router.put("/{person_id}")
async def update_person(
    person_id: UUID,
    data: PersonUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    service: PersonService = Depends(get_person_service),
):
    """
    Actualiza datos de una persona.
    Vendedor: solo puede actualizar sus propias personas y no puede reasignar.
    """
    return await service.update_person(person_id, data, current_user)


# ──────────────────────────────────────────────
# DELETE /persons/{id} — Soft delete
# ──────────────────────────────────────────────
@router.delete("/{person_id}")
async def delete_person(
    person_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    service: PersonService = Depends(get_person_service),
):
    """Soft delete de persona. Solo admin."""
    return await service.delete_person(person_id)


# ──────────────────────────────────────────────
# GET /persons/{id}/interactions — Historial CRM
# ──────────────────────────────────────────────
@router.get("/{person_id}/interactions", response_model=list[dict])
async def list_interactions(
    person_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: PersonService = Depends(get_person_service),
):
    """Lista todas las interacciones de una persona, de más reciente a más antigua."""
    return await service.list_interactions(person_id, current_user)


# ──────────────────────────────────────────────
# POST /persons/{id}/interactions — Registrar interacción
# ──────────────────────────────────────────────
@router.post("/{person_id}/interactions", status_code=status.HTTP_201_CREATED)
async def create_interaction(
    person_id: UUID,
    data: InteractionCreate,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: PersonService = Depends(get_person_service),
):
    """
    Registra una nueva interacción (llamada, whatsApp, visita, etc.).
    Si el lead estaba en 'nuevo', pasa a 'contactado' automáticamente.
    Actualiza next_contact_date si se especifica.
    """
    return await service.create_interaction(person_id, data, current_user)


# ──────────────────────────────────────────────
# GET /persons/{id}/vehicle-interests
# ──────────────────────────────────────────────
@router.get("/{person_id}/vehicle-interests", response_model=list[dict])
async def list_vehicle_interests(
    person_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: PersonService = Depends(get_person_service),
):
    """Lista los vehículos de interés de un lead."""
    return await service.list_vehicle_interests(person_id, current_user)


# ──────────────────────────────────────────────
# POST /persons/{id}/vehicle-interests
# ──────────────────────────────────────────────
@router.post("/{person_id}/vehicle-interests", status_code=status.HTTP_201_CREATED)
async def add_vehicle_interest(
    person_id: UUID,
    data: VehicleInterestCreate,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: PersonService = Depends(get_person_service),
):
    """Agrega un vehículo de interés al lead (específico del stock o descripción libre)."""
    return await service.add_vehicle_interest(person_id, data, current_user)


# ──────────────────────────────────────────────
# GET /persons/{id}/sales — Historial de compras
# ──────────────────────────────────────────────
@router.get("/{person_id}/sales", response_model=list[dict])
async def get_person_sales(
    person_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: PersonService = Depends(get_person_service),
):
    """Historial de ventas del cliente."""
    return await service.get_person_sales(person_id, current_user)


# ──────────────────────────────────────────────
# GET /persons/{id}/account — Cuenta corriente
# ──────────────────────────────────────────────
@router.get("/{person_id}/account", response_model=AccountStatement)
async def get_account_statement(
    person_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: PersonService = Depends(get_person_service),
):
    """Estado de cuenta corriente del cliente (saldo + movimientos)."""
    return await service.get_account_statement(person_id, current_user)
