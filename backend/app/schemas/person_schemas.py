"""
schemas/person_schemas.py — Pydantic schemas para el módulo CRM

Cubre: personas (leads/clientes/consignantes), interacciones y pipeline Kanban.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


# ──────────────────────────────────────────────
# Schemas de Persona
# ──────────────────────────────────────────────

class PersonBase(BaseModel):
    person_type: str = Field(default="lead", description="lead | cliente | consignante | proveedor")
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    dni_cuit: Optional[str] = None
    iva_condition: str = "consumidor_final"
    birth_date: Optional[date] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    origin_channel: str = "showroom"
    notes: Optional[str] = None

    @field_validator("person_type")
    @classmethod
    def validate_person_type(cls, v: str) -> str:
        allowed = {"lead", "cliente", "consignante", "proveedor"}
        if v not in allowed:
            raise ValueError(f"person_type debe ser uno de: {allowed}")
        return v

    @field_validator("iva_condition")
    @classmethod
    def validate_iva(cls, v: str) -> str:
        allowed = {"consumidor_final", "responsable_inscripto", "monotributo", "exento"}
        if v not in allowed:
            raise ValueError(f"iva_condition debe ser uno de: {allowed}")
        return v

    @field_validator("origin_channel")
    @classmethod
    def validate_channel(cls, v: str) -> str:
        allowed = {"web", "instagram", "facebook", "mercadolibre", "showroom", "referido", "otro"}
        if v not in allowed:
            raise ValueError(f"origin_channel debe ser uno de: {allowed}")
        return v


class PersonCreate(PersonBase):
    assigned_seller_id: Optional[UUID] = None
    lead_status: str = "nuevo"


class PersonUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dni_cuit: Optional[str] = None
    iva_condition: Optional[str] = None
    birth_date: Optional[date] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    origin_channel: Optional[str] = None
    notes: Optional[str] = None
    lead_status: Optional[str] = None
    loss_reason: Optional[str] = None
    next_contact_date: Optional[date] = None
    next_contact_action: Optional[str] = None
    assigned_seller_id: Optional[UUID] = None
    person_type: Optional[str] = None


class PersonOut(BaseModel):
    id: UUID
    person_type: str
    first_name: str
    last_name: str
    full_name: Optional[str] = None        # Calculado: first_name + last_name
    dni_cuit: Optional[str]
    iva_condition: str
    birth_date: Optional[date]
    email: Optional[str]
    phone: Optional[str]
    whatsapp: Optional[str]
    address: Optional[str]
    city: Optional[str]
    province: Optional[str]
    postal_code: Optional[str]
    origin_channel: Optional[str]
    lead_status: str
    loss_reason: Optional[str]
    next_contact_date: Optional[date]
    next_contact_action: Optional[str]
    assigned_seller_id: Optional[UUID]
    assigned_seller_name: Optional[str] = None   # Enriquecido
    balance: Decimal
    notes: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PersonListItem(BaseModel):
    id: UUID
    person_type: str
    first_name: str
    last_name: str
    email: Optional[str]
    phone: Optional[str]
    origin_channel: Optional[str]
    lead_status: str
    next_contact_date: Optional[date]
    assigned_seller_name: Optional[str] = None
    balance: Decimal
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Schemas de Interacción
# ──────────────────────────────────────────────

class InteractionCreate(BaseModel):
    interaction_type: str = Field(..., description="llamada | whatsapp | email | visita | test_drive | cotizacion_enviada | otro")
    date: Optional[datetime] = None          # Por defecto NOW()
    result: Optional[str] = None
    notes: Optional[str] = None
    next_contact_date: Optional[date] = None
    next_contact_action: Optional[str] = None

    @field_validator("interaction_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"llamada", "whatsapp", "email", "visita", "test_drive", "cotizacion_enviada", "otro"}
        if v not in allowed:
            raise ValueError(f"interaction_type debe ser uno de: {allowed}")
        return v


class InteractionOut(BaseModel):
    id: UUID
    person_id: UUID
    interaction_type: str
    date: datetime
    result: Optional[str]
    notes: Optional[str]
    next_contact_date: Optional[date]
    next_contact_action: Optional[str]
    created_by: Optional[UUID]
    created_by_name: Optional[str] = None   # Enriquecido
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Schemas de Pipeline Kanban
# ──────────────────────────────────────────────

LEAD_STAGES = [
    "nuevo",
    "contactado",
    "interesado",
    "en_negociacion",
    "cerrado_ganado",
    "cerrado_perdido",
]

class KanbanCard(BaseModel):
    """Tarjeta mínima para el pipeline Kanban."""
    id: UUID
    first_name: str
    last_name: str
    phone: Optional[str]
    whatsapp: Optional[str]
    origin_channel: Optional[str]
    next_contact_date: Optional[date]
    assigned_seller_name: Optional[str]
    vehicle_interests: list[str] = Field(default_factory=list)  # Descripciones
    last_interaction_date: Optional[datetime] = None
    last_interaction_type: Optional[str] = None
    days_without_contact: Optional[int] = None
    created_at: Optional[datetime]


class KanbanColumn(BaseModel):
    stage: str
    label: str
    count: int
    cards: list[KanbanCard]


class KanbanBoard(BaseModel):
    """Pipeline completo agrupado por etapa."""
    columns: list[KanbanColumn]
    total_leads: int


# ──────────────────────────────────────────────
# Schemas de Interés en Vehículos
# ──────────────────────────────────────────────

class VehicleInterestCreate(BaseModel):
    vehicle_id: Optional[UUID] = None
    description: Optional[str] = None


class VehicleInterestOut(BaseModel):
    id: UUID
    vehicle_id: Optional[UUID]
    description: Optional[str]
    vehicle_info: Optional[str] = None   # Enriquecido: "Toyota Corolla 2026"
    created_at: datetime


# ──────────────────────────────────────────────
# Schemas de filtros y paginación
# ──────────────────────────────────────────────

class PersonFilters(BaseModel):
    search: Optional[str] = None
    person_type: Optional[str] = None
    lead_status: Optional[str] = None
    origin_channel: Optional[str] = None
    assigned_seller_id: Optional[UUID] = None
    has_pending_contact: Optional[bool] = None   # next_contact_date <= hoy
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)


class PaginatedPersons(BaseModel):
    items: list[PersonListItem]
    total: int
    page: int
    per_page: int
    pages: int


# ──────────────────────────────────────────────
# Cuenta corriente
# ──────────────────────────────────────────────

class AccountMovement(BaseModel):
    date: date
    description: str
    amount: Decimal
    movement_type: str     # ingreso | egreso
    reference_type: str    # sale | work_order | manual


class AccountStatement(BaseModel):
    person_id: UUID
    full_name: str
    balance: Decimal
    movements: list[AccountMovement]
