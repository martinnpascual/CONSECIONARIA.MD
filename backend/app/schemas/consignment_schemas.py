"""
schemas/consignment_schemas.py — Esquemas del módulo de Consignaciones

Consignación: vehículo de un tercero (propietario) que la concesionaria vende.
La concesionaria cobra una comisión; el propietario recibe el resto.
"""
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ──────────────────────────────────────────────
# Crear consignación
# ──────────────────────────────────────────────
class ConsignmentCreate(BaseModel):
    owner_id: UUID
    vehicle_id: UUID

    owner_floor_price: float = Field(..., gt=0, description="Precio mínimo que acepta el propietario (ARS)")
    end_date: Optional[date] = Field(default=None, description="Fecha de vencimiento del contrato")

    commission_type: str = Field(
        default="porcentaje",
        description="porcentaje | monto_fijo"
    )
    commission_value: float = Field(
        ..., gt=0,
        description="Si commission_type=porcentaje: valor entre 0 y 100. Si monto_fijo: valor en ARS"
    )

    notes: Optional[str] = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_commission(self) -> "ConsignmentCreate":
        if self.commission_type == "porcentaje" and self.commission_value > 100:
            raise ValueError("El porcentaje de comisión no puede superar 100%")
        return self


# ──────────────────────────────────────────────
# Actualizar consignación
# ──────────────────────────────────────────────
class ConsignmentUpdate(BaseModel):
    owner_floor_price: Optional[float] = Field(default=None, gt=0)
    end_date: Optional[date] = None
    commission_type: Optional[str] = None
    commission_value: Optional[float] = Field(default=None, gt=0)
    notes: Optional[str] = Field(default=None, max_length=2000)


# ──────────────────────────────────────────────
# Registrar venta de un vehículo en consignación
# ──────────────────────────────────────────────
class ConsignmentSell(BaseModel):
    sale_id: UUID = Field(..., description="ID de la venta ya creada en el sistema")
    sale_price: float = Field(..., gt=0, description="Precio final de venta (ARS)")


# ──────────────────────────────────────────────
# Marcar liquidación pagada al propietario
# ──────────────────────────────────────────────
class ConsignmentSettlementPay(BaseModel):
    payment_method: str = Field(
        default="transferencia",
        description="efectivo | transferencia | cheque"
    )
    notes: Optional[str] = Field(default=None, max_length=500)


# ──────────────────────────────────────────────
# Salida — Consignación completa
# ──────────────────────────────────────────────
class ConsignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    consignment_number: str
    status: str

    owner_id: UUID
    vehicle_id: UUID
    sale_id: Optional[UUID]

    start_date: date
    end_date: Optional[date]

    owner_floor_price: float
    sale_price: Optional[float]

    commission_type: str
    commission_value: float
    commission_amount: Optional[float]
    owner_settlement: Optional[float]
    settlement_date: Optional[date]
    settlement_paid: bool

    notes: Optional[str]
    contract_doc_url: Optional[str]

    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]

    # Enriquecido
    owner_name: Optional[str] = None
    owner_dni: Optional[str] = None
    owner_phone: Optional[str] = None
    vehicle_info: Optional[str] = None     # "Toyota Hilux 2022 — ABC123"
    vehicle_asking_price: Optional[float] = None


# ──────────────────────────────────────────────
# Item de lista
# ──────────────────────────────────────────────
class ConsignmentListItem(BaseModel):
    id: UUID
    consignment_number: str
    status: str
    owner_name: Optional[str]
    vehicle_info: Optional[str]
    owner_floor_price: float
    commission_type: str
    commission_value: float
    start_date: date
    end_date: Optional[date]
    settlement_paid: bool
    owner_settlement: Optional[float]


# ──────────────────────────────────────────────
# Filtros + Paginación
# ──────────────────────────────────────────────
class ConsignmentFilters(BaseModel):
    search: Optional[str] = Field(default=None, description="Número, propietario, patente")
    status: Optional[str] = None
    settlement_paid: Optional[bool] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)


class PaginatedConsignments(BaseModel):
    data: list[ConsignmentListItem]
    total: int
    page: int
    per_page: int
    total_pages: int
