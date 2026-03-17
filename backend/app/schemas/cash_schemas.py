"""
schemas/cash_schemas.py — Esquemas del módulo de Caja y Movimientos Financieros
"""
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ──────────────────────────────────────────────
# Constantes
# ──────────────────────────────────────────────
MOVEMENT_TYPES = ["ingreso", "egreso"]

MOVEMENT_CATEGORIES = [
    "cobro_venta",
    "cobro_servicio",
    "seña",
    "devolucion",
    "gasto_operativo",
    "gasto_publicidad",
    "comision",
    "liquidacion_consignacion",
    "otro",
]

PAYMENT_METHODS = [
    "efectivo",
    "transferencia",
    "cheque",
    "tarjeta_credito",
    "tarjeta_debito",
    "deposito",
]

CURRENCIES = ["ARS", "USD"]


# ──────────────────────────────────────────────
# Apertura de caja
# ──────────────────────────────────────────────
class CashRegisterOpen(BaseModel):
    opening_balance_ars: float = Field(default=0.0, ge=0)
    opening_balance_usd: float = Field(default=0.0, ge=0)
    usd_rate: Optional[float] = Field(default=None, gt=0, description="Tipo de cambio USD→ARS del día")
    notes: Optional[str] = Field(default=None, max_length=500)


# ──────────────────────────────────────────────
# Cierre de caja
# ──────────────────────────────────────────────
class CashRegisterClose(BaseModel):
    closing_balance_ars: float = Field(..., ge=0)
    closing_balance_usd: float = Field(default=0.0, ge=0)
    notes: Optional[str] = Field(default=None, max_length=500)


# ──────────────────────────────────────────────
# Salida — Caja
# ──────────────────────────────────────────────
class CashRegisterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    opened_by: UUID
    closed_by: Optional[UUID]

    open_date: date
    opened_at: datetime
    closed_at: Optional[datetime]
    status: str

    opening_balance_ars: float
    opening_balance_usd: float
    closing_balance_ars: Optional[float]
    closing_balance_usd: Optional[float]
    usd_rate: Optional[float]
    notes: Optional[str]

    created_at: datetime
    updated_at: datetime

    # Enriquecido
    opened_by_name: Optional[str] = None
    closed_by_name: Optional[str] = None


# ──────────────────────────────────────────────
# Resumen de caja (de la vista v_cash_summary)
# ──────────────────────────────────────────────
class CashSummary(BaseModel):
    cash_register_id: UUID
    open_date: date
    status: str
    opening_balance_ars: float
    opening_balance_usd: float
    usd_rate: Optional[float]
    total_income_ars: float
    total_income_usd: float
    total_expense_ars: float
    total_expense_usd: float

    # Calculados en el servicio
    balance_ars: Optional[float] = None
    balance_usd: Optional[float] = None


# ──────────────────────────────────────────────
# Crear movimiento de caja
# ──────────────────────────────────────────────
class CashMovementCreate(BaseModel):
    movement_type: str = Field(..., description="ingreso | egreso")
    category: str = Field(default="otro")
    description: str = Field(..., min_length=2, max_length=500)
    amount: float = Field(..., gt=0)
    currency: str = Field(default="ARS")
    usd_rate: Optional[float] = Field(default=None, gt=0)

    payment_method: str = Field(default="efectivo")

    reference_type: Optional[str] = Field(
        default=None,
        description="Entidad de origen: 'sale', 'work_order', 'consignment'"
    )
    reference_id: Optional[UUID] = None

    person_id: Optional[UUID] = None
    movement_date: Optional[date] = None
    reference: Optional[str] = Field(default=None, max_length=100, description="Nro transferencia, cheque, etc.")
    notes: Optional[str] = Field(default=None, max_length=500)


# ──────────────────────────────────────────────
# Salida — Movimiento de caja
# ──────────────────────────────────────────────
class CashMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cash_register_id: UUID
    movement_type: str
    category: str
    description: str
    amount: float
    currency: str
    usd_rate: Optional[float]
    payment_method: str
    reference_type: Optional[str]
    reference_id: Optional[UUID]
    person_id: Optional[UUID]
    movement_date: date
    reference: Optional[str]
    notes: Optional[str]
    registered_by: UUID
    created_at: datetime

    # Enriquecido
    person_name: Optional[str] = None
    registered_by_name: Optional[str] = None


# ──────────────────────────────────────────────
# Filtros de movimientos
# ──────────────────────────────────────────────
class CashMovementFilters(BaseModel):
    cash_register_id: Optional[UUID] = None
    movement_type: Optional[str] = None
    category: Optional[str] = None
    currency: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=200)


class PaginatedMovements(BaseModel):
    data: list[CashMovementOut]
    total: int
    page: int
    per_page: int
    total_pages: int


# ──────────────────────────────────────────────
# Reporte de caja por período
# ──────────────────────────────────────────────
class CashPeriodReport(BaseModel):
    period_from: date
    period_to: date
    total_income_ars: float
    total_income_usd: float
    total_expense_ars: float
    total_expense_usd: float
    net_ars: float
    net_usd: float
    breakdown_by_category: dict[str, float]
