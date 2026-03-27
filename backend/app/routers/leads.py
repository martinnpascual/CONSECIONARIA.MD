"""
routers/leads.py — Endpoints del pipeline CRM (leads)

Thin wrapper sobre persons que adapta el formato al que el frontend espera.
Un "Lead" en el frontend = una "Person" en el backend con campos CRM.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from app.schemas.person_schemas import (
    PersonCreate,
    PersonFilters,
    PersonUpdate,
)
from app.services.person_service import PersonService
from app.supabase_client import get_supabase_admin
from app.utils.security import (
    CurrentUser,
    get_current_user,
    require_admin,
    require_admin_or_seller,
)

router = APIRouter(prefix="/leads", tags=["CRM — Leads"])


def get_service(db: Client = Depends(get_supabase_admin)) -> PersonService:
    return PersonService(db)


def _person_to_lead(p: dict) -> dict:
    """Convierte un PersonOut (dict) al formato Lead que usa el frontend."""
    return {
        "id": str(p.get("id", "")),
        "status": p.get("lead_status", "nuevo"),
        "source": p.get("origin_channel"),
        "person_id": str(p.get("id", "")),
        "vehicle_id": None,
        "interested_description": None,
        "budget_min": None,
        "budget_max": None,
        "next_contact_date": str(p["next_contact_date"]) if p.get("next_contact_date") else None,
        "notes": p.get("notes"),
        "assigned_to": str(p["assigned_seller_id"]) if p.get("assigned_seller_id") else None,
        "created_at": str(p.get("created_at", "")),
        "updated_at": str(p.get("updated_at", "")),
        # Persona anidada para el LeadCard
        "person": {
            "id": str(p.get("id", "")),
            "person_type": p.get("person_type", "prospecto"),
            "first_name": p.get("first_name", ""),
            "last_name": p.get("last_name", ""),
            "full_name": p.get("full_name"),
            "phone": p.get("phone"),
            "email": p.get("email"),
            "dni": p.get("dni_cuit"),
            "notes": p.get("notes"),
            "created_at": str(p.get("created_at", "")),
            "updated_at": str(p.get("updated_at", "")),
        },
        "interested_vehicle": None,
    }


# ── GET /leads — Listado paginado ─────────────────────────────────
@router.get("")
async def list_leads(
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    assigned_to: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    current_user: CurrentUser = Depends(get_current_user),
    service: PersonService = Depends(get_service),
):
    """Lista leads (personas con rol CRM) del pipeline."""
    try:
        filters = PersonFilters(
            search=search,
            lead_status=status,
            assigned_seller_id=UUID(assigned_to) if assigned_to else None,
            page=page,
            per_page=per_page,
        )
        result = await service.list_persons(filters, current_user)
        leads = [_person_to_lead(p.model_dump()) for p in result.items]
        return {
            "items": leads,
            "total": result.total,
            "page": result.page,
            "per_page": result.per_page,
            "pages": result.pages,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Error en leads: {str(e)} | {traceback.format_exc()[-500:]}")


# ── GET /leads/{id} — Detalle ─────────────────────────────────────
@router.get("/{lead_id}")
async def get_lead(
    lead_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: PersonService = Depends(get_service),
):
    """Detalle de un lead."""
    person = await service.get_person(lead_id, current_user)
    if not person:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    return _person_to_lead(person if isinstance(person, dict) else person.model_dump())


# ── POST /leads — Crear lead ──────────────────────────────────────
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_lead(
    data: PersonCreate,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: PersonService = Depends(get_service),
):
    """Crea un nuevo lead."""
    person = await service.create_person(data, current_user)
    return _person_to_lead(person if isinstance(person, dict) else person.model_dump())


# ── PUT /leads/{id} — Actualizar lead ────────────────────────────
@router.put("/{lead_id}")
async def update_lead(
    lead_id: UUID,
    data: PersonUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    service: PersonService = Depends(get_service),
):
    """Actualiza datos de un lead."""
    person = await service.update_person(lead_id, data, current_user)
    return _person_to_lead(person if isinstance(person, dict) else person.model_dump())


# ── PATCH /leads/{id}/status — Mover en el Kanban ────────────────
@router.patch("/{lead_id}/status")
async def move_lead_status(
    lead_id: UUID,
    body: dict,
    current_user: CurrentUser = Depends(get_current_user),
    service: PersonService = Depends(get_service),
):
    """Actualiza el estado de un lead (para drag & drop en Kanban)."""
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(status_code=422, detail="Campo 'status' requerido")
    update = PersonUpdate(lead_status=new_status)
    person = await service.update_person(lead_id, update, current_user)
    return _person_to_lead(person if isinstance(person, dict) else person.model_dump())


# ── DELETE /leads/{id} — Soft delete ─────────────────────────────
@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    service: PersonService = Depends(get_service),
):
    """Soft delete de un lead. Solo admin."""
    await service.delete_person(lead_id)
