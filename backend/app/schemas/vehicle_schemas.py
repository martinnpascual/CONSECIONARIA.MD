"""
schemas/vehicle_schemas.py — Pydantic schemas para vehículos

Tres niveles de respuesta según el rol:
- VehiclePublic: sin precio de costo (para vendedores y frontend no-admin)
- VehicleAdmin: con precio de costo (solo admin)
- VehicleCreate / VehicleUpdate: para crear y editar
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ──────────────────────────────────────────────
# Schemas base
# ──────────────────────────────────────────────

class PhotoOut(BaseModel):
    id: UUID
    url: str
    is_main: bool
    sort_order: int


class VehicleBase(BaseModel):
    vehicle_type: str = Field(..., description="nuevo | usado | consignacion")
    brand: str = Field(..., min_length=1, max_length=100)
    model: str = Field(..., min_length=1, max_length=100)
    version: Optional[str] = None
    year: int = Field(..., ge=1990, le=2030)
    model_year: Optional[int] = None
    color: Optional[str] = None
    interior_color: Optional[str] = None
    fuel_type: str = "nafta"
    transmission: str = "manual"
    doors: Optional[int] = Field(default=4, ge=2, le=6)
    body_type: Optional[str] = None
    chassis_number: Optional[str] = None
    engine_number: Optional[str] = None
    plate: Optional[str] = None
    mileage: Optional[int] = Field(default=None, ge=0)
    previous_owners: Optional[int] = Field(default=0, ge=0)
    list_price: Optional[Decimal] = None
    min_price: Optional[Decimal] = None
    currency: str = "ARS"
    location: str = "Salón"
    provenance: Optional[str] = None
    description: Optional[str] = None
    equipment: list[str] = Field(default_factory=list)

    @field_validator("vehicle_type")
    @classmethod
    def validate_vehicle_type(cls, v: str) -> str:
        allowed = {"nuevo", "usado", "consignacion"}
        if v not in allowed:
            raise ValueError(f"vehicle_type debe ser uno de: {allowed}")
        return v

    @field_validator("fuel_type")
    @classmethod
    def validate_fuel_type(cls, v: str) -> str:
        allowed = {"nafta", "diesel", "hibrido", "electrico", "gnc", "otro"}
        if v not in allowed:
            raise ValueError(f"fuel_type debe ser uno de: {allowed}")
        return v

    @field_validator("transmission")
    @classmethod
    def validate_transmission(cls, v: str) -> str:
        allowed = {"manual", "automatica", "cvt"}
        if v not in allowed:
            raise ValueError(f"transmission debe ser uno de: {allowed}")
        return v


class VehicleCreate(VehicleBase):
    """Schema para crear un vehículo. Incluye precio de costo (solo admin lo envía)."""
    cost_price: Optional[Decimal] = None


class VehicleUpdate(BaseModel):
    """Schema para actualizar vehículo (todos los campos opcionales)."""
    brand: Optional[str] = None
    model: Optional[str] = None
    version: Optional[str] = None
    year: Optional[int] = Field(default=None, ge=1990, le=2030)
    model_year: Optional[int] = None
    color: Optional[str] = None
    interior_color: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    doors: Optional[int] = None
    body_type: Optional[str] = None
    chassis_number: Optional[str] = None
    plate: Optional[str] = None
    mileage: Optional[int] = None
    list_price: Optional[Decimal] = None
    cost_price: Optional[Decimal] = None  # Solo admin puede enviar esto
    min_price: Optional[Decimal] = None
    currency: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    equipment: Optional[list[str]] = None
    status: Optional[str] = None


# ──────────────────────────────────────────────
# Schemas de respuesta
# ──────────────────────────────────────────────

class VehiclePublic(BaseModel):
    """Respuesta para vendedores y no-admin: SIN precio de costo."""
    id: UUID
    vehicle_type: str
    status: str
    brand: str
    model: str
    version: Optional[str]
    year: int
    model_year: Optional[int]
    color: Optional[str]
    interior_color: Optional[str]
    fuel_type: str
    transmission: str
    doors: Optional[int]
    body_type: Optional[str]
    chassis_number: Optional[str]
    engine_number: Optional[str]
    plate: Optional[str]
    mileage: Optional[int]
    previous_owners: Optional[int]
    list_price: Optional[Decimal]
    min_price: Optional[Decimal]  # Solo para vendedor asignado; el service filtra
    currency: str
    location: Optional[str]
    description: Optional[str]
    equipment: list[Any]
    entry_date: Optional[date]
    sale_date: Optional[date]
    photos: list[PhotoOut] = Field(default_factory=list)
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class VehicleAdmin(VehiclePublic):
    """Respuesta para admin: incluye precio de costo."""
    cost_price: Optional[Decimal]
    consignment_id: Optional[UUID]
    sale_id: Optional[UUID]


class VehicleListItem(BaseModel):
    """Item resumido para listados (sin fotos completas)."""
    id: UUID
    vehicle_type: str
    status: str
    brand: str
    model: str
    version: Optional[str]
    year: int
    color: Optional[str]
    fuel_type: str
    transmission: str
    mileage: Optional[int]
    list_price: Optional[Decimal]
    currency: str
    location: Optional[str]
    entry_date: Optional[date]
    days_in_stock: Optional[int] = None
    main_photo_url: Optional[str] = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Schemas de filtros y paginación
# ──────────────────────────────────────────────

class VehicleFilters(BaseModel):
    """Parámetros de filtrado para el listado de vehículos."""
    search: Optional[str] = Field(default=None, description="Búsqueda por marca, modelo, versión, patente")
    vehicle_type: Optional[str] = None
    status: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    price_from: Optional[Decimal] = None
    price_to: Optional[Decimal] = None
    location: Optional[str] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)


class PaginatedVehicles(BaseModel):
    """Respuesta paginada del listado de vehículos."""
    items: list[VehicleListItem]
    total: int
    page: int
    per_page: int
    pages: int
