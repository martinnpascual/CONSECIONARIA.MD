"""
schemas/sale_schemas.py — Pydantic schemas para el módulo de Ventas

Cubre: ventas, pagos/señas, toma de usados (trade-in) y calculadora de financiamiento.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


# ──────────────────────────────────────────────
# Calculadora de financiamiento
# ──────────────────────────────────────────────

class FinancingRequest(BaseModel):
    """Input para calcular cuotas de financiamiento."""
    vehicle_price: Decimal = Field(..., gt=0, description="Precio del vehículo")
    down_payment: Decimal = Field(default=Decimal("0"), ge=0, description="Pago inicial / entrega")
    trade_in_value: Decimal = Field(default=Decimal("0"), ge=0, description="Valor del usado en parte de pago")
    annual_rate: Decimal = Field(..., gt=0, le=200, description="Tasa nominal anual en %")
    installments: int = Field(..., ge=1, le=120, description="Cantidad de cuotas")


class FinancingResult(BaseModel):
    """Resultado del cálculo de financiamiento."""
    vehicle_price: Decimal
    down_payment: Decimal
    trade_in_value: Decimal
    financed_amount: Decimal       # vehicle_price - down_payment - trade_in_value
    annual_rate: Decimal
    monthly_rate: Decimal
    installments: int
    installment_value: Decimal     # Valor de cada cuota (French)
    total_to_pay: Decimal          # installment_value * installments
    total_interest: Decimal        # total_to_pay - financed_amount
    cft: Decimal                   # Costo financiero total %


# ──────────────────────────────────────────────
# Toma de usados (Trade-in)
# ──────────────────────────────────────────────

class TradeInCreate(BaseModel):
    """Datos del vehículo entregado como parte de pago."""
    brand: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    version: Optional[str] = None
    year: int = Field(..., ge=1990, le=2030)
    color: Optional[str] = None
    plate: Optional[str] = None
    chassis_number: Optional[str] = None
    mileage: Optional[int] = Field(default=None, ge=0)
    fuel_type: str = "nafta"
    transmission: str = "manual"
    general_condition: str = "bueno"
    mechanical_notes: Optional[str] = None
    cosmetic_notes: Optional[str] = None
    market_reference: Optional[Decimal] = None
    offered_value: Decimal = Field(..., gt=0, description="Valor ofrecido al cliente en ARS")
    notes: Optional[str] = None

    @field_validator("general_condition")
    @classmethod
    def validate_condition(cls, v: str) -> str:
        allowed = {"excelente", "bueno", "regular", "para_reparar"}
        if v not in allowed:
            raise ValueError(f"Condición debe ser: {allowed}")
        return v


class TradeInUpdate(BaseModel):
    general_condition: Optional[str] = None
    mechanical_notes: Optional[str] = None
    cosmetic_notes: Optional[str] = None
    market_reference: Optional[Decimal] = None
    offered_value: Optional[Decimal] = None
    accepted: Optional[bool] = None
    notes: Optional[str] = None


class TradeInOut(BaseModel):
    id: UUID
    sale_id: UUID
    brand: str
    model: str
    version: Optional[str]
    year: int
    color: Optional[str]
    plate: Optional[str]
    mileage: Optional[int]
    general_condition: str
    mechanical_notes: Optional[str]
    cosmetic_notes: Optional[str]
    market_reference: Optional[Decimal]
    offered_value: Decimal
    accepted: bool
    stock_vehicle_id: Optional[UUID]    # Vehículo ingresado al stock si fue aceptado
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Pagos y señas
# ──────────────────────────────────────────────

class PaymentCreate(BaseModel):
    """Registro de un pago o seña vinculado a una venta."""
    payment_type: str = Field(..., description="seña | pago_parcial | pago_final | financiamiento | plan_ahorro | otro")
    amount: Decimal = Field(..., gt=0)
    currency: str = "ARS"
    usd_rate: Optional[Decimal] = None
    payment_method: str = "efectivo"
    payment_date: Optional[date] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("payment_type")
    @classmethod
    def validate_payment_type(cls, v: str) -> str:
        allowed = {"seña", "pago_parcial", "pago_final", "financiamiento", "plan_ahorro", "otro"}
        if v not in allowed:
            raise ValueError(f"payment_type debe ser: {allowed}")
        return v

    @field_validator("payment_method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        allowed = {"efectivo", "transferencia", "cheque", "tarjeta_credito", "tarjeta_debito", "deposito"}
        if v not in allowed:
            raise ValueError(f"payment_method debe ser: {allowed}")
        return v


class PaymentOut(BaseModel):
    id: UUID
    sale_id: UUID
    payment_type: str
    amount: Decimal
    currency: str
    usd_rate: Optional[Decimal]
    payment_method: str
    payment_date: date
    reference: Optional[str]
    notes: Optional[str]
    registered_by: Optional[UUID]
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Ventas
# ──────────────────────────────────────────────

class SaleCreate(BaseModel):
    """Datos para iniciar una nueva venta (puede empezar como cotización)."""
    client_id: UUID
    vehicle_id: UUID
    operation_type: str = "contado"
    sale_price: Decimal = Field(..., gt=0, description="Precio acordado con el cliente")
    discount: Decimal = Field(default=Decimal("0"), ge=0)
    # Financiamiento (opcional)
    financed_amount: Optional[Decimal] = None
    financing_bank: Optional[str] = None
    installments: Optional[int] = Field(default=None, ge=1)
    installment_value: Optional[Decimal] = None
    interest_rate: Optional[Decimal] = None
    # Plan de ahorro (opcional)
    savings_plan_name: Optional[str] = None
    savings_plan_group: Optional[str] = None
    savings_plan_order: Optional[str] = None
    observations: Optional[str] = None

    @field_validator("operation_type")
    @classmethod
    def validate_op_type(cls, v: str) -> str:
        allowed = {"contado", "financiado", "plan_ahorro", "combinado"}
        if v not in allowed:
            raise ValueError(f"operation_type debe ser: {allowed}")
        return v

    @model_validator(mode="after")
    def validate_financing(self) -> "SaleCreate":
        if self.operation_type in ("financiado", "combinado"):
            if not self.installments or not self.installment_value:
                raise ValueError("Para financiado/combinado se requieren cuotas e importe de cuota")
        return self


class SaleUpdate(BaseModel):
    """Actualización parcial de una venta."""
    operation_type: Optional[str] = None
    sale_price: Optional[Decimal] = None
    discount: Optional[Decimal] = None
    financed_amount: Optional[Decimal] = None
    financing_bank: Optional[str] = None
    installments: Optional[int] = None
    installment_value: Optional[Decimal] = None
    interest_rate: Optional[Decimal] = None
    savings_plan_name: Optional[str] = None
    savings_plan_group: Optional[str] = None
    savings_plan_order: Optional[str] = None
    observations: Optional[str] = None
    delivery_date: Optional[date] = None


class SaleStatusUpdate(BaseModel):
    """Cambio de estado de una venta."""
    status: str = Field(..., description="cotizacion | reserva | en_proceso | entregada | cancelada")
    cancellation_reason: Optional[str] = None
    delivery_date: Optional[date] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"cotizacion", "reserva", "en_proceso", "entregada", "cancelada"}
        if v not in allowed:
            raise ValueError(f"status debe ser: {allowed}")
        return v


class SaleOut(BaseModel):
    """Respuesta completa de una venta."""
    id: UUID
    sale_number: str
    status: str
    cancellation_reason: Optional[str]
    sale_date: date
    delivery_date: Optional[date]
    client_id: UUID
    client_name: Optional[str] = None       # Enriquecido
    vehicle_id: UUID
    vehicle_info: Optional[str] = None      # Enriquecido: "Toyota Hilux 2026"
    seller_id: UUID
    seller_name: Optional[str] = None       # Enriquecido
    operation_type: str
    list_price: Decimal
    sale_price: Decimal
    discount: Decimal
    final_price: Decimal
    financed_amount: Optional[Decimal]
    financing_bank: Optional[str]
    installments: Optional[int]
    installment_value: Optional[Decimal]
    interest_rate: Optional[Decimal]
    savings_plan_name: Optional[str]
    trade_in_id: Optional[UUID]
    trade_in_info: Optional[str] = None     # Enriquecido
    commission_amount: Optional[Decimal]
    commission_paid: bool
    observations: Optional[str]
    payments: list[PaymentOut] = Field(default_factory=list)
    total_paid: Decimal = Decimal("0")
    balance_due: Decimal = Decimal("0")
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SaleListItem(BaseModel):
    """Item resumido para listados."""
    id: UUID
    sale_number: str
    status: str
    sale_date: date
    client_name: Optional[str]
    vehicle_info: Optional[str]
    seller_name: Optional[str]
    operation_type: str
    final_price: Decimal
    total_paid: Optional[Decimal] = Decimal("0")
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Filtros y paginación
# ──────────────────────────────────────────────

class SaleFilters(BaseModel):
    search: Optional[str] = None             # Nro venta, cliente, patente
    status: Optional[str] = None
    operation_type: Optional[str] = None
    seller_id: Optional[UUID] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)


class PaginatedSales(BaseModel):
    items: list[SaleListItem]
    total: int
    page: int
    per_page: int
    pages: int


# ──────────────────────────────────────────────
# Comisiones
# ──────────────────────────────────────────────

class CommissionSummary(BaseModel):
    seller_id: UUID
    seller_name: str
    period: str                             # "2026-03"
    sales_count: int
    total_revenue: Decimal
    total_commission: Decimal
    commissions_paid: Decimal
    commissions_pending: Decimal
