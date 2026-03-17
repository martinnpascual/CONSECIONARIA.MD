"""
routers/work_orders.py — Endpoints del módulo Taller / Posventa

OT = Orden de Trabajo
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from supabase import Client

from app.schemas.work_order_schemas import (
    PaginatedWorkOrders,
    WorkOrderCreate,
    WorkOrderFilters,
    WorkOrderItemCreate,
    WorkOrderItemOut,
    WorkOrderOut,
    WorkOrderStatusUpdate,
    WorkOrderUpdate,
)
from app.services.work_order_service import WorkOrderService
from app.supabase_client import get_supabase_admin
from app.utils.security import (
    CurrentUser,
    get_current_user,
    require_admin,
    require_admin_or_seller,
)

router = APIRouter(prefix="/work-orders", tags=["Taller"])


def get_service(db: Client = Depends(get_supabase_admin)) -> WorkOrderService:
    return WorkOrderService(db)


# ──────────────────────────────────────────────
# GET /work-orders — Listar OTs
# ──────────────────────────────────────────────
@router.get("", response_model=PaginatedWorkOrders)
async def list_work_orders(
    search: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    work_type: Optional[str] = Query(default=None),
    mechanic_id: Optional[UUID] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    service: WorkOrderService = Depends(get_service),
):
    """
    Lista órdenes de trabajo con filtros y paginación.
    Los mecánicos solo ven las OTs que tienen asignadas.
    """
    from datetime import date as date_type
    filters = WorkOrderFilters(
        search=search,
        status=status_filter,
        work_type=work_type,
        mechanic_id=mechanic_id,
        date_from=date_type.fromisoformat(date_from) if date_from else None,
        date_to=date_type.fromisoformat(date_to) if date_to else None,
        page=page,
        per_page=per_page,
    )
    return await service.list_work_orders(filters, current_user)


# ──────────────────────────────────────────────
# POST /work-orders — Crear OT
# ──────────────────────────────────────────────
@router.post("", status_code=status.HTTP_201_CREATED, response_model=WorkOrderOut)
async def create_work_order(
    data: WorkOrderCreate,
    current_user: CurrentUser = Depends(get_current_user),
    service: WorkOrderService = Depends(get_service),
):
    """
    Crea una nueva Orden de Trabajo.
    Requiere especificar vehicle_id (del stock) o external_vehicle (auto del cliente).
    """
    return await service.create_work_order(data, current_user)


# ──────────────────────────────────────────────
# GET /work-orders/{id} — Detalle de OT
# ──────────────────────────────────────────────
@router.get("/{work_order_id}", response_model=WorkOrderOut)
async def get_work_order(
    work_order_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: WorkOrderService = Depends(get_service),
):
    """Detalle completo de una OT con todos sus ítems."""
    return await service.get_work_order(work_order_id, current_user)


# ──────────────────────────────────────────────
# PUT /work-orders/{id} — Actualizar OT
# ──────────────────────────────────────────────
@router.put("/{work_order_id}", response_model=WorkOrderOut)
async def update_work_order(
    work_order_id: UUID,
    data: WorkOrderUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    service: WorkOrderService = Depends(get_service),
):
    """Actualiza datos de una OT (descripción, mecánico, fechas estimadas)."""
    return await service.update_work_order(work_order_id, data, current_user)


# ──────────────────────────────────────────────
# PATCH /work-orders/{id}/status — Cambiar estado
# ──────────────────────────────────────────────
@router.patch("/{work_order_id}/status", response_model=WorkOrderOut)
async def change_status(
    work_order_id: UUID,
    data: WorkOrderStatusUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    service: WorkOrderService = Depends(get_service),
):
    """
    Cambia el estado de la OT.
    Máquina de estados: recibido → en_proceso → listo → entregado | cancelado
    """
    return await service.change_status(work_order_id, data, current_user)


# ──────────────────────────────────────────────
# POST /work-orders/{id}/items — Agregar ítem
# ──────────────────────────────────────────────
@router.post(
    "/{work_order_id}/items",
    status_code=status.HTTP_201_CREATED,
    response_model=WorkOrderItemOut,
)
async def add_item(
    work_order_id: UUID,
    data: WorkOrderItemCreate,
    current_user: CurrentUser = Depends(get_current_user),
    service: WorkOrderService = Depends(get_service),
):
    """
    Agrega un ítem a la OT (mano de obra o repuesto).
    Los totales de la OT se recalculan automáticamente (trigger en DB).
    """
    return await service.add_item(work_order_id, data, current_user)


# ──────────────────────────────────────────────
# DELETE /work-orders/{id}/items/{item_id} — Eliminar ítem
# ──────────────────────────────────────────────
@router.delete("/{work_order_id}/items/{item_id}")
async def delete_item(
    work_order_id: UUID,
    item_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: WorkOrderService = Depends(get_service),
):
    """Elimina un ítem de la OT. Los totales se recalculan automáticamente."""
    return await service.delete_item(work_order_id, item_id, current_user)


# ──────────────────────────────────────────────
# DELETE /work-orders/{id} — Eliminar OT (soft)
# ──────────────────────────────────────────────
@router.delete("/{work_order_id}")
async def delete_work_order(
    work_order_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    service: WorkOrderService = Depends(get_service),
):
    """Elimina lógicamente una OT. Solo admin. No aplica a OTs ya entregadas."""
    return await service.delete_work_order(work_order_id, current_user)
