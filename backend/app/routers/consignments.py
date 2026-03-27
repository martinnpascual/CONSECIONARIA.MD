"""
routers/consignments.py — Endpoints del módulo de Consignaciones

Vehículos de terceros que la concesionaria vende a cambio de una comisión.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from supabase import Client

from app.schemas.consignment_schemas import (
    ConsignmentCreate,
    ConsignmentFilters,
    ConsignmentOut,
    ConsignmentSell,
    ConsignmentUpdate,
    PaginatedConsignments,
)
from app.services.consignment_service import ConsignmentService
from app.supabase_client import get_supabase_admin
from app.utils.security import (
    CurrentUser,
    get_current_user,
    require_admin,
    require_admin_or_cashier,
    require_admin_or_seller,
)

router = APIRouter(prefix="/consignments", tags=["Consignaciones"])


def get_service(db: Client = Depends(get_supabase_admin)) -> ConsignmentService:
    return ConsignmentService(db)


# ──────────────────────────────────────────────
# GET /consignments — Listar consignaciones
# ──────────────────────────────────────────────
@router.get("", response_model=PaginatedConsignments)
async def list_consignments(
    search: Optional[str] = Query(default=None, description="Número, propietario, patente"),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    settlement_paid: Optional[bool] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    service: ConsignmentService = Depends(get_service),
):
    """Lista consignaciones con filtros y paginación."""
    from datetime import date as date_type
    from fastapi import HTTPException
    import traceback
    try:
        filters = ConsignmentFilters(
            search=search,
            status=status_filter,
            settlement_paid=settlement_paid,
            date_from=date_type.fromisoformat(date_from) if date_from else None,
            date_to=date_type.fromisoformat(date_to) if date_to else None,
            page=page,
            per_page=per_page,
        )
        return await service.list_consignments(filters)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consignments: {str(e)} | {traceback.format_exc()[-600:]}")


# ──────────────────────────────────────────────
# POST /consignments — Crear consignación
# ──────────────────────────────────────────────
@router.post("", status_code=status.HTTP_201_CREATED, response_model=ConsignmentOut)
async def create_consignment(
    data: ConsignmentCreate,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: ConsignmentService = Depends(get_service),
):
    """
    Crea una nueva consignación.
    El vehículo debe existir en el stock con type='consignacion' y no tener otra consignación activa.
    """
    return await service.create_consignment(data, current_user)


# ──────────────────────────────────────────────
# GET /consignments/{id} — Detalle de consignación
# ──────────────────────────────────────────────
@router.get("/{consignment_id}", response_model=ConsignmentOut)
async def get_consignment(
    consignment_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: ConsignmentService = Depends(get_service),
):
    """Detalle completo de una consignación con datos del propietario y el vehículo."""
    return await service.get_consignment(consignment_id)


# ──────────────────────────────────────────────
# PUT /consignments/{id} — Actualizar consignación
# ──────────────────────────────────────────────
@router.put("/{consignment_id}", response_model=ConsignmentOut)
async def update_consignment(
    consignment_id: UUID,
    data: ConsignmentUpdate,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: ConsignmentService = Depends(get_service),
):
    """Actualiza términos de la consignación (precio mínimo, comisión, fecha de vencimiento)."""
    return await service.update_consignment(consignment_id, data)


# ──────────────────────────────────────────────
# POST /consignments/{id}/sell — Registrar venta
# ──────────────────────────────────────────────
@router.post("/{consignment_id}/sell", response_model=ConsignmentOut)
async def sell_consignment(
    consignment_id: UUID,
    data: ConsignmentSell,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: ConsignmentService = Depends(get_service),
):
    """
    Marca el vehículo en consignación como vendido.
    Calcula la comisión y la liquidación al propietario automáticamente.
    El precio de venta debe ser igual o mayor al precio mínimo del propietario.
    """
    return await service.sell_consignment(consignment_id, data, current_user)


# ──────────────────────────────────────────────
# POST /consignments/{id}/withdraw — Retirar vehículo
# ──────────────────────────────────────────────
@router.post("/{consignment_id}/withdraw", response_model=ConsignmentOut)
async def withdraw_consignment(
    consignment_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    service: ConsignmentService = Depends(get_service),
):
    """
    El propietario retira el vehículo sin venderlo.
    El vehículo pasa a estado 'baja' en el stock.
    Solo admin.
    """
    return await service.withdraw_consignment(consignment_id, current_user)


# ──────────────────────────────────────────────
# POST /consignments/{id}/settlement/paid — Marcar liquidación pagada
# ──────────────────────────────────────────────
@router.post("/{consignment_id}/settlement/paid", response_model=ConsignmentOut)
async def mark_settlement_paid(
    consignment_id: UUID,
    current_user: CurrentUser = Depends(require_admin_or_cashier),
    service: ConsignmentService = Depends(get_service),
):
    """
    Marca la liquidación al propietario como pagada.
    Solo admin o cajero.
    """
    return await service.mark_settlement_paid(consignment_id, current_user)


# ──────────────────────────────────────────────
# DELETE /consignments/{id} — Eliminar consignación (soft)
# ──────────────────────────────────────────────
@router.delete("/{consignment_id}")
async def delete_consignment(
    consignment_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    service: ConsignmentService = Depends(get_service),
):
    """Elimina lógicamente una consignación. Solo admin. No aplica a consignaciones vendidas."""
    return await service.delete_consignment(consignment_id, current_user)
