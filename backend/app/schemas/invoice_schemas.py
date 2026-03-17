"""
schemas/invoice_schemas.py — Esquemas del módulo de Facturación ARCA
"""
from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ──────────────────────────────────────────────
# Solicitar factura electrónica
# ──────────────────────────────────────────────
class InvoiceRequest(BaseModel):
    invoice_type: str = Field(
        ...,
        description="Tipo de comprobante: A (RI), B (CF), C (Monotributo)"
    )
    reference_type: str = Field(..., description="'sale' o 'work_order'")
    reference_id: UUID = Field(..., description="ID de la venta u OT a facturar")

    # Datos del receptor (si difieren del cliente ya vinculado)
    receptor_cuit: Optional[str] = Field(default=None, description="CUIT del receptor (Factura A)")
    receptor_name: Optional[str] = None
    receptor_iva_cond: Optional[str] = Field(
        default="Consumidor Final",
        description="Responsable Inscripto | Consumidor Final | Monotributo | Exento"
    )

    # Montos (si no se especifican, se toman de la venta/OT)
    net_amount: Optional[float] = Field(default=None, gt=0)
    iva_amount: Optional[float] = Field(default=None, ge=0)
    total_amount: Optional[float] = Field(default=None, gt=0)

    # Descripción en el comprobante
    description: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Concepto que figura en la factura"
    )


# ──────────────────────────────────────────────
# Salida — Factura
# ──────────────────────────────────────────────
class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invoice_type: str
    invoice_number: Optional[str]
    cae: Optional[str]
    cae_expiry_date: Optional[date]

    punto_venta: int
    emisor_cuit: str
    receptor_cuit: Optional[str]
    receptor_name: Optional[str]
    receptor_iva_cond: Optional[str]

    reference_type: str
    reference_id: UUID

    net_amount: float
    iva_amount: float
    total_amount: float

    status: str
    error_message: Optional[str]

    qr_url: Optional[str]
    invoice_date: date

    created_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    # Enriquecido
    created_by_name: Optional[str] = None


# ──────────────────────────────────────────────
# Filtros
# ──────────────────────────────────────────────
class InvoiceFilters(BaseModel):
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    invoice_type: Optional[str] = None
    status: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)


class PaginatedInvoices(BaseModel):
    data: list[InvoiceOut]
    total: int
    page: int
    per_page: int
    total_pages: int


# ──────────────────────────────────────────────
# Solicitar PDF de un documento
# ──────────────────────────────────────────────
class DocumentRequest(BaseModel):
    doc_type: str = Field(
        ...,
        description=(
            "cotizacion | boleto_compraventa | recibo_sena | acta_entrega | "
            "orden_trabajo | contrato_consignacion"
        )
    )
    reference_id: UUID = Field(..., description="ID de la venta, OT o consignación")
    extra_data: Optional[dict[str, Any]] = Field(
        default=None,
        description="Datos adicionales específicos del documento (ej: delivery para acta_entrega)"
    )


class DocumentOut(BaseModel):
    id: UUID
    doc_type: str
    reference_type: str
    reference_id: Optional[UUID]
    storage_path: str
    public_url: str
    filename: str
    file_size_bytes: Optional[int]
    generated_by: Optional[UUID]
    created_at: datetime
