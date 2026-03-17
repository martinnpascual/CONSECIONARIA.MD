"""
routers/sales.py — Endpoints del módulo de Ventas

Cubre: ventas, pagos/señas, toma de usados (trade-in) y calculadora de financiamiento.
Los routers solo coordinan; toda la lógica está en sale_service.py.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from supabase import Client

from app.schemas.sale_schemas import (
    FinancingRequest,
    FinancingResult,
    PaginatedSales,
    PaymentCreate,
    PaymentOut,
    SaleCreate,
    SaleFilters,
    SaleOut,
    SaleStatusUpdate,
    SaleUpdate,
    TradeInCreate,
    TradeInOut,
    TradeInUpdate,
    CommissionSummary,
)
from app.services.sale_service import SaleService
from app.supabase_client import get_supabase_admin
from app.utils.security import (
    CurrentUser,
    get_current_user,
    require_admin,
    require_admin_or_seller,
    require_admin_or_cashier,
)

router = APIRouter(prefix="/sales", tags=["Ventas"])


def get_sale_service(db: Client = Depends(get_supabase_admin)) -> SaleService:
    return SaleService(db)


# ──────────────────────────────────────────────
# POST /sales/financing/calculate — Calculadora de financiamiento
# ──────────────────────────────────────────────
@router.post("/financing/calculate", response_model=FinancingResult)
async def calculate_financing(
    data: FinancingRequest,
    current_user: CurrentUser = Depends(get_current_user),
    service: SaleService = Depends(get_sale_service),
):
    """
    Calcula cuotas de financiamiento usando el sistema francés (cuota fija).
    No requiere autenticación de rol específico, cualquier usuario autenticado puede usar la calculadora.
    """
    return service.calculate_financing(data)


# ──────────────────────────────────────────────
# GET /sales — Listar ventas
# ──────────────────────────────────────────────
@router.get("", response_model=PaginatedSales)
async def list_sales(
    search: Optional[str] = Query(default=None, description="Número de venta, cliente, patente"),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    operation_type: Optional[str] = Query(default=None),
    seller_id: Optional[UUID] = Query(default=None),
    date_from: Optional[str] = Query(default=None, description="Fecha desde (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(default=None, description="Fecha hasta (YYYY-MM-DD)"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    service: SaleService = Depends(get_sale_service),
):
    """
    Lista ventas con filtros y paginación.
    Vendedores solo ven sus propias ventas. Admin ve todas.
    """
    from datetime import date as date_type
    filters = SaleFilters(
        search=search,
        status=status_filter,
        operation_type=operation_type,
        seller_id=seller_id,
        date_from=date_type.fromisoformat(date_from) if date_from else None,
        date_to=date_type.fromisoformat(date_to) if date_to else None,
        page=page,
        per_page=per_page,
    )
    return await service.list_sales(filters, current_user)


# ──────────────────────────────────────────────
# POST /sales — Crear venta
# ──────────────────────────────────────────────
@router.post("", status_code=status.HTTP_201_CREATED, response_model=SaleOut)
async def create_sale(
    data: SaleCreate,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: SaleService = Depends(get_sale_service),
):
    """
    Inicia una nueva venta. Por defecto crea una cotización.
    El vendedor queda registrado como el usuario autenticado.
    Valida que el vehículo esté disponible antes de crear.
    """
    return await service.create_sale(data, current_user)


# ──────────────────────────────────────────────
# GET /sales/{id} — Detalle de venta
# ──────────────────────────────────────────────
@router.get("/{sale_id}", response_model=SaleOut)
async def get_sale(
    sale_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: SaleService = Depends(get_sale_service),
):
    """
    Detalle completo de una venta: datos enriquecidos con nombre de cliente,
    info del vehículo, vendedor, pagos registrados y saldo pendiente.
    """
    return await service.get_sale(sale_id, current_user)


# ──────────────────────────────────────────────
# PUT /sales/{id} — Actualizar venta
# ──────────────────────────────────────────────
@router.put("/{sale_id}", response_model=SaleOut)
async def update_sale(
    sale_id: UUID,
    data: SaleUpdate,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: SaleService = Depends(get_sale_service),
):
    """
    Actualización parcial de datos de una venta.
    No modifica el estado (usar PATCH /status para eso).
    """
    return await service.update_sale(sale_id, data, current_user)


# ──────────────────────────────────────────────
# PATCH /sales/{id}/status — Cambiar estado
# ──────────────────────────────────────────────
@router.patch("/{sale_id}/status", response_model=SaleOut)
async def change_sale_status(
    sale_id: UUID,
    data: SaleStatusUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    service: SaleService = Depends(get_sale_service),
):
    """
    Cambia el estado de una venta siguiendo la máquina de estados:
    cotizacion → reserva → en_proceso → entregada | cancelada

    - Solo admin puede marcar como 'entregada'.
    - Solo admin puede cancelar ventas en proceso.
    - Al entregar se calcula la comisión automáticamente.
    """
    return await service.change_status(sale_id, data, current_user)


# ──────────────────────────────────────────────
# GET /sales/{id}/payments — Listar pagos
# ──────────────────────────────────────────────
@router.get("/{sale_id}/payments", response_model=list[PaymentOut])
async def list_payments(
    sale_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: SaleService = Depends(get_sale_service),
):
    """Lista todos los pagos y señas registrados en una venta."""
    return await service.list_payments(sale_id, current_user)


# ──────────────────────────────────────────────
# POST /sales/{id}/payments — Registrar pago
# ──────────────────────────────────────────────
@router.post("/{sale_id}/payments", status_code=status.HTTP_201_CREATED, response_model=PaymentOut)
async def add_payment(
    sale_id: UUID,
    data: PaymentCreate,
    current_user: CurrentUser = Depends(require_admin_or_cashier),
    service: SaleService = Depends(get_sale_service),
):
    """
    Registra un pago o seña en una venta.
    Tipos válidos: seña | pago_parcial | pago_final | financiamiento | plan_ahorro | otro
    Si es la primera seña y la venta está en 'cotizacion', avanza a 'reserva' automáticamente.
    """
    return await service.add_payment(sale_id, data, current_user)


# ──────────────────────────────────────────────
# GET /sales/{id}/trade-in — Ver toma de usado
# ──────────────────────────────────────────────
@router.get("/{sale_id}/trade-in", response_model=TradeInOut)
async def get_trade_in(
    sale_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: SaleService = Depends(get_sale_service),
):
    """Obtiene la toma de usado asociada a una venta."""
    return await service.get_trade_in(sale_id, current_user)


# ──────────────────────────────────────────────
# POST /sales/{id}/trade-in — Registrar toma de usado
# ──────────────────────────────────────────────
@router.post("/{sale_id}/trade-in", status_code=status.HTTP_201_CREATED, response_model=TradeInOut)
async def create_trade_in(
    sale_id: UUID,
    data: TradeInCreate,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: SaleService = Depends(get_sale_service),
):
    """
    Registra un vehículo entregado como parte de pago en una venta.
    Una venta solo puede tener una toma de usado. El vehículo aún no ingresa al stock.
    """
    return await service.create_trade_in(sale_id, data, current_user)


# ──────────────────────────────────────────────
# PUT /sales/{id}/trade-in — Actualizar toma de usado
# ──────────────────────────────────────────────
@router.put("/{sale_id}/trade-in", response_model=TradeInOut)
async def update_trade_in(
    sale_id: UUID,
    data: TradeInUpdate,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: SaleService = Depends(get_sale_service),
):
    """Actualiza datos de la toma de usado (notas mecánicas, valor ofrecido, etc.)."""
    return await service.update_trade_in(sale_id, data, current_user)


# ──────────────────────────────────────────────
# POST /sales/{id}/trade-in/accept — Aceptar y dar de alta al stock
# ──────────────────────────────────────────────
@router.post("/{sale_id}/trade-in/accept", response_model=TradeInOut)
async def accept_trade_in(
    sale_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    service: SaleService = Depends(get_sale_service),
):
    """
    Acepta la toma de usado y da de alta el vehículo en el stock automáticamente.
    Solo admin puede ejecutar esta acción.
    El usado queda en estado 'disponible' con tipo 'usado'.
    """
    return await service.accept_trade_in(sale_id, current_user)


# ──────────────────────────────────────────────
# GET /sales/commissions — Resumen de comisiones
# ──────────────────────────────────────────────
@router.get("/commissions/summary", response_model=list[CommissionSummary])
async def get_commissions(
    period: Optional[str] = Query(
        default=None,
        description="Período en formato YYYY-MM (ej: 2026-03). Por defecto: mes actual."
    ),
    seller_id: Optional[UUID] = Query(default=None, description="Filtrar por vendedor"),
    current_user: CurrentUser = Depends(require_admin),
    service: SaleService = Depends(get_sale_service),
):
    """
    Resumen de comisiones por vendedor para un período.
    Solo admin puede ver este reporte.
    Agrupa ventas entregadas, comisiones totales y pendientes de pago.
    """
    return await service.get_commissions(period, seller_id)


# ──────────────────────────────────────────────
# PATCH /sales/{id}/commission/paid — Marcar comisión pagada
# ──────────────────────────────────────────────
@router.patch("/{sale_id}/commission/paid")
async def mark_commission_paid(
    sale_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    service: SaleService = Depends(get_sale_service),
):
    """
    Marca la comisión de una venta como pagada al vendedor.
    Solo admin.
    """
    return await service.mark_commission_paid(sale_id, current_user)
