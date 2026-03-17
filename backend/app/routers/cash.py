"""
routers/cash.py — Endpoints del módulo de Caja y Movimientos Financieros
"""
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from supabase import Client

from app.schemas.cash_schemas import (
    CashMovementCreate,
    CashMovementFilters,
    CashMovementOut,
    CashPeriodReport,
    CashRegisterClose,
    CashRegisterOpen,
    CashRegisterOut,
    CashSummary,
    PaginatedMovements,
)
from app.services.cash_service import CashService
from app.supabase_client import get_supabase_admin
from app.utils.security import (
    CurrentUser,
    get_current_user,
    require_admin,
    require_admin_or_cashier,
)

router = APIRouter(prefix="/cash", tags=["Caja"])


def get_service(db: Client = Depends(get_supabase_admin)) -> CashService:
    return CashService(db)


# ──────────────────────────────────────────────
# GET /cash/registers — Listar cajas
# ──────────────────────────────────────────────
@router.get("/registers", response_model=dict)
async def list_registers(
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_admin_or_cashier),
    service: CashService = Depends(get_service),
):
    """Lista todas las cajas, ordenadas por fecha desc."""
    return await service.list_registers(
        page=page,
        per_page=per_page,
        date_from=date.fromisoformat(date_from) if date_from else None,
        date_to=date.fromisoformat(date_to) if date_to else None,
    )


# ──────────────────────────────────────────────
# GET /cash/registers/current — Caja abierta actual
# ──────────────────────────────────────────────
@router.get("/registers/current", response_model=Optional[CashRegisterOut])
async def get_current_register(
    current_user: CurrentUser = Depends(get_current_user),
    service: CashService = Depends(get_service),
):
    """
    Retorna la caja actualmente abierta.
    Retorna null si no hay ninguna abierta.
    Cualquier usuario autenticado puede consultar el estado de la caja.
    """
    register = await service.get_open_register()
    if register:
        return await service._enrich_register(register)
    return None


# ──────────────────────────────────────────────
# GET /cash/registers/{id}/summary — Resumen de una caja
# ──────────────────────────────────────────────
@router.get("/registers/{register_id}/summary", response_model=CashSummary)
async def get_register_summary(
    register_id: UUID,
    current_user: CurrentUser = Depends(require_admin_or_cashier),
    service: CashService = Depends(get_service),
):
    """Resumen de ingresos, egresos y saldo de una caja específica."""
    return await service.get_summary(register_id)


# ──────────────────────────────────────────────
# GET /cash/summary — Resumen de la caja abierta
# ──────────────────────────────────────────────
@router.get("/summary", response_model=CashSummary)
async def get_current_summary(
    current_user: CurrentUser = Depends(require_admin_or_cashier),
    service: CashService = Depends(get_service),
):
    """Resumen de la caja actualmente abierta: saldo, ingresos y egresos del día."""
    return await service.get_summary()


# ──────────────────────────────────────────────
# POST /cash/registers/open — Abrir caja
# ──────────────────────────────────────────────
@router.post("/registers/open", status_code=status.HTTP_201_CREATED, response_model=CashRegisterOut)
async def open_register(
    data: CashRegisterOpen,
    current_user: CurrentUser = Depends(require_admin_or_cashier),
    service: CashService = Depends(get_service),
):
    """
    Abre una nueva caja del día.
    Solo puede haber una caja abierta por fecha.
    Requiere ingresar el saldo inicial en ARS y/o USD.
    """
    return await service.open_register(data, current_user)


# ──────────────────────────────────────────────
# POST /cash/registers/{id}/close — Cerrar caja
# ──────────────────────────────────────────────
@router.post("/registers/{register_id}/close", response_model=CashRegisterOut)
async def close_register(
    register_id: UUID,
    data: CashRegisterClose,
    current_user: CurrentUser = Depends(require_admin_or_cashier),
    service: CashService = Depends(get_service),
):
    """
    Cierra la caja registrando el saldo final contado.
    El sistema muestra la diferencia entre el saldo calculado y el saldo contado.
    """
    return await service.close_register(register_id, data, current_user)


# ──────────────────────────────────────────────
# GET /cash/movements — Listar movimientos
# ──────────────────────────────────────────────
@router.get("/movements", response_model=PaginatedMovements)
async def list_movements(
    cash_register_id: Optional[UUID] = Query(default=None),
    movement_type: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    currency: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    current_user: CurrentUser = Depends(require_admin_or_cashier),
    service: CashService = Depends(get_service),
):
    """Lista movimientos de caja con filtros avanzados."""
    filters = CashMovementFilters(
        cash_register_id=cash_register_id,
        movement_type=movement_type,
        category=category,
        currency=currency,
        date_from=date.fromisoformat(date_from) if date_from else None,
        date_to=date.fromisoformat(date_to) if date_to else None,
        page=page,
        per_page=per_page,
    )
    return await service.list_movements(filters)


# ──────────────────────────────────────────────
# POST /cash/movements — Registrar movimiento
# ──────────────────────────────────────────────
@router.post("/movements", status_code=status.HTTP_201_CREATED, response_model=CashMovementOut)
async def add_movement(
    data: CashMovementCreate,
    current_user: CurrentUser = Depends(require_admin_or_cashier),
    service: CashService = Depends(get_service),
):
    """
    Registra un movimiento (ingreso o egreso) en la caja abierta.
    La caja debe estar abierta. Si no hay caja abierta retorna error 422.
    """
    return await service.add_movement(data, current_user)


# ──────────────────────────────────────────────
# GET /cash/report — Reporte por período
# ──────────────────────────────────────────────
@router.get("/report", response_model=CashPeriodReport)
async def get_period_report(
    date_from: str = Query(..., description="Fecha inicio YYYY-MM-DD"),
    date_to: str = Query(..., description="Fecha fin YYYY-MM-DD"),
    current_user: CurrentUser = Depends(require_admin),
    service: CashService = Depends(get_service),
):
    """
    Reporte financiero de un período: totales por tipo y categoría.
    Solo admin.
    """
    return await service.get_period_report(
        date.fromisoformat(date_from),
        date.fromisoformat(date_to),
    )
