"""
routers/invoices.py — Endpoints de Facturación ARCA y Documentos PDF
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from supabase import Client

from app.schemas.invoice_schemas import (
    DocumentOut,
    DocumentRequest,
    InvoiceFilters,
    InvoiceOut,
    InvoiceRequest,
    PaginatedInvoices,
)
from app.services.invoice_service import InvoiceService
from app.services.pdf_service import PDFService
from app.supabase_client import get_supabase_admin
from app.utils.security import (
    CurrentUser,
    get_current_user,
    require_admin,
    require_admin_or_cashier,
    require_admin_or_seller,
)

router = APIRouter(prefix="/documents", tags=["Documentos y Facturación"])


def get_invoice_service(db: Client = Depends(get_supabase_admin)) -> InvoiceService:
    return InvoiceService(db)


def get_pdf_service(db: Client = Depends(get_supabase_admin)) -> PDFService:
    return PDFService(db)


# ══════════════════════════════════════════════
# FACTURAS ARCA
# ══════════════════════════════════════════════

# ──────────────────────────────────────────────
# GET /documents/invoices — Listar facturas
# ──────────────────────────────────────────────
@router.get("/invoices", response_model=PaginatedInvoices)
async def list_invoices(
    reference_type: Optional[str] = Query(default=None),
    reference_id: Optional[UUID] = Query(default=None),
    invoice_type: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_admin_or_cashier),
    service: InvoiceService = Depends(get_invoice_service),
):
    """Lista facturas electrónicas emitidas. Solo admin o cajero."""
    from datetime import date as date_type
    filters = InvoiceFilters(
        reference_type=reference_type,
        reference_id=reference_id,
        invoice_type=invoice_type,
        status=status_filter,
        date_from=date_type.fromisoformat(date_from) if date_from else None,
        date_to=date_type.fromisoformat(date_to) if date_to else None,
        page=page,
        per_page=per_page,
    )
    return await service.list_invoices(filters)


# ──────────────────────────────────────────────
# POST /documents/invoices — Emitir factura
# ──────────────────────────────────────────────
@router.post("/invoices", status_code=status.HTTP_201_CREATED, response_model=InvoiceOut)
async def emit_invoice(
    data: InvoiceRequest,
    current_user: CurrentUser = Depends(require_admin_or_cashier),
    service: InvoiceService = Depends(get_invoice_service),
):
    """
    Emite una factura electrónica via ARCA (MrBot API).

    - Factura A: receptor es Responsable Inscripto (requiere CUIT)
    - Factura B: receptor es Consumidor Final
    - Factura C: emisor es Monotributista

    Una venta/OT solo puede tener una factura emitida.
    Las facturas son INMUTABLES una vez emitidas (no se anulan desde el sistema).
    """
    return await service.emit_invoice(data, current_user)


# ──────────────────────────────────────────────
# GET /documents/invoices/{id} — Detalle de factura
# ──────────────────────────────────────────────
@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: UUID,
    current_user: CurrentUser = Depends(require_admin_or_cashier),
    service: InvoiceService = Depends(get_invoice_service),
):
    """Detalle completo de una factura con CAE y QR."""
    return await service.get_invoice(invoice_id)


# ══════════════════════════════════════════════
# DOCUMENTOS PDF
# ══════════════════════════════════════════════

# ──────────────────────────────────────────────
# POST /documents/generate — Generar PDF
# ──────────────────────────────────────────────
@router.post("/generate", status_code=status.HTTP_201_CREATED, response_model=DocumentOut)
async def generate_document(
    data: DocumentRequest,
    current_user: CurrentUser = Depends(get_current_user),
    service: PDFService = Depends(get_pdf_service),
):
    """
    Genera un documento PDF y lo guarda en Supabase Storage.

    Tipos disponibles:
    - `cotizacion` — Cotización de vehículo (venta)
    - `boleto_compraventa` — Contrato bilateral (venta)
    - `recibo_sena` — Recibo de seña o pago (venta)
    - `acta_entrega` — Acta de entrega del vehículo (venta)
    - `orden_trabajo` — Presupuesto / OT de taller
    - `contrato_consignacion` — Contrato de consignación

    Los documentos son INMUTABLES: cada generación crea una nueva versión.
    """
    doc = await service.generate(
        doc_type=data.doc_type,
        reference_id=str(data.reference_id),
        generated_by=str(current_user.id),
        extra_context=data.extra_data,
    )
    return doc


# ──────────────────────────────────────────────
# GET /documents/list — Listar PDFs de una entidad
# ──────────────────────────────────────────────
@router.get("/list", response_model=list[DocumentOut])
async def list_documents(
    reference_type: str = Query(..., description="sale | work_order | consignment"),
    reference_id: UUID = Query(...),
    doc_type: Optional[str] = Query(default=None),
    current_user: CurrentUser = Depends(get_current_user),
    service: PDFService = Depends(get_pdf_service),
):
    """Lista todos los PDFs generados para una venta, OT o consignación."""
    return await service.list_documents(
        reference_type=reference_type,
        reference_id=str(reference_id),
        doc_type=doc_type,
    )
