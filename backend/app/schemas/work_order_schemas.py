"""
schemas/work_order_schemas.py — Esquemas del módulo Taller / Posventa

OT = Orden de Trabajo
"""
from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ──────────────────────────────────────────────
# Constantes de dominio
# ──────────────────────────────────────────────
WORK_ORDER_STATUSES = [
    "recibido", "en_proceso", "listo", "entregado", "cancelado"
]

WORK_TYPES = [
    "service", "reparacion", "chapa_pintura",
    "preparacion_venta", "garantia", "otro"
]

ITEM_TYPES = ["labor", "part", "other"]

# Transiciones válidas de estado
VALID_WO_TRANSITIONS: dict[str, list[str]] = {
    "recibido":   ["en_proceso", "cancelado"],
    "en_proceso": ["listo", "cancelado"],
    "listo":      ["entregado"],
    "entregado":  [],
    "cancelado":  [],
}


# ──────────────────────────────────────────────
# ítems de OT
# ──────────────────────────────────────────────
class WorkOrderItemCreate(BaseModel):
    item_type: str = Field(..., description="labor | part | other")
    description: str = Field(..., min_length=2, max_length=300)
    part_code: Optional[str] = Field(default=None, max_length=50)
    quantity: float = Field(default=1.0, gt=0)
    unit_price: float = Field(..., gt=0)


class WorkOrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    work_order_id: UUID
    item_type: str
    description: str
    part_code: Optional[str]
    quantity: float
    unit_price: float
    subtotal: float
    created_at: datetime


# ──────────────────────────────────────────────
# Vehículo externo (cliente trae su propio auto)
# ──────────────────────────────────────────────
class ExternalVehicle(BaseModel):
    brand: str = Field(..., min_length=1, max_length=50)
    model: str = Field(..., min_length=1, max_length=100)
    year: int = Field(..., ge=1950, le=2030)
    plate: Optional[str] = Field(default=None, max_length=10)
    mileage: Optional[int] = Field(default=None, ge=0)


# ──────────────────────────────────────────────
# Crear OT
# ──────────────────────────────────────────────
class WorkOrderCreate(BaseModel):
    work_type: str = Field(default="reparacion")
    description: str = Field(..., min_length=5, max_length=2000)
    observations: Optional[str] = Field(default=None, max_length=2000)

    # Vehículo del stock o externo (uno de los dos)
    vehicle_id: Optional[UUID] = None
    external_vehicle: Optional[ExternalVehicle] = None

    client_id: Optional[UUID] = None
    mechanic_id: Optional[UUID] = None

    estimated_delivery_date: Optional[date] = None

    # Ítems opcionales en la creación
    items: list[WorkOrderItemCreate] = Field(default_factory=list)


# ──────────────────────────────────────────────
# Actualizar OT
# ──────────────────────────────────────────────
class WorkOrderUpdate(BaseModel):
    work_type: Optional[str] = None
    description: Optional[str] = Field(default=None, min_length=5, max_length=2000)
    observations: Optional[str] = Field(default=None, max_length=2000)
    mechanic_id: Optional[UUID] = None
    estimated_delivery_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None


# ──────────────────────────────────────────────
# Cambio de estado
# ──────────────────────────────────────────────
class WorkOrderStatusUpdate(BaseModel):
    status: str = Field(..., description="Nuevo estado")
    notes: Optional[str] = Field(default=None, max_length=500)


# ──────────────────────────────────────────────
# Salida — Orden de Trabajo completa
# ──────────────────────────────────────────────
class WorkOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_number: str
    status: str
    work_type: str

    entry_date: datetime
    estimated_delivery_date: Optional[date]
    actual_delivery_date: Optional[date]

    vehicle_id: Optional[UUID]
    external_vehicle: Optional[dict[str, Any]]

    client_id: Optional[UUID]
    mechanic_id: Optional[UUID]

    description: str
    observations: Optional[str]

    labor_cost: float
    parts_cost: float
    total: float

    invoice_id: Optional[UUID]

    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]

    # Campos enriquecidos (JOIN)
    client_name: Optional[str] = None
    mechanic_name: Optional[str] = None
    vehicle_info: Optional[str] = None   # "Toyota Hilux 2022 — ABC123"
    items: list[WorkOrderItemOut] = Field(default_factory=list)


# ──────────────────────────────────────────────
# Item de lista (sin ítems completos)
# ──────────────────────────────────────────────
class WorkOrderListItem(BaseModel):
    id: UUID
    order_number: str
    status: str
    work_type: str
    entry_date: datetime
    estimated_delivery_date: Optional[date]
    client_name: Optional[str]
    mechanic_name: Optional[str]
    vehicle_info: Optional[str]
    total: float


# ──────────────────────────────────────────────
# Filtros + Paginación
# ──────────────────────────────────────────────
class WorkOrderFilters(BaseModel):
    search: Optional[str] = None
    status: Optional[str] = None
    work_type: Optional[str] = None
    mechanic_id: Optional[UUID] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)


class PaginatedWorkOrders(BaseModel):
    data: list[WorkOrderListItem]
    total: int
    page: int
    per_page: int
    total_pages: int
