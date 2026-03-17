"""
routers/pdfs.py — Endpoints de generación y listado de documentos PDF

Endpoints:
  POST /pdfs/generate          — Genera un PDF y lo sube a Storage
  GET  /pdfs/{reference_type}/{reference_id}  — Lista PDFs de una entidad
  GET  /pdfs/{doc_id}/url      — Obtiene la URL pública de un PDF existente
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import io

from app.supabase_client import get_db_client
from app.utils.security import get_current_user
from app.services.pdf_service import PDFService, TEMPLATE_MAP

router = APIRouter(prefix="/pdfs", tags=["Documentos PDF"])


# ── Schemas ───────────────────────────────────────────────────────────────

class GeneratePDFRequest(BaseModel):
    doc_type: str
    reference_id: str
    extra_context: Optional[dict] = None


class PDFResponse(BaseModel):
    id: str
    doc_type: str
    reference_type: str
    reference_id: Optional[str]
    public_url: str
    filename: str
    file_size_bytes: Optional[int]
    created_at: str


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post(
    "/generate",
    summary="Genera un documento PDF",
    response_model=PDFResponse,
)
async def generate_pdf(
    body: GeneratePDFRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db_client),
):
    """
    Genera un PDF del tipo indicado para la entidad referenciada.
    Lo sube a Supabase Storage y registra el documento en la tabla `documents`.
    Retorna el registro con la URL pública.
    """
    service = PDFService(db)
    doc = await service.generate(
        doc_type=body.doc_type,
        reference_id=body.reference_id,
        generated_by=str(current_user.id),
        extra_context=body.extra_context,
    )
    return doc


@router.get(
    "/{reference_type}/{reference_id}",
    summary="Lista los PDFs generados para una entidad",
    response_model=list[PDFResponse],
)
async def list_documents(
    reference_type: str,
    reference_id: str,
    doc_type: Optional[str] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_db_client),
):
    """
    Devuelve todos los PDFs generados para una entidad (sale, work_order, consignment).
    Se puede filtrar por tipo de documento con el query param `doc_type`.
    """
    if reference_type not in ("sale", "work_order", "consignment"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reference_type debe ser: sale, work_order o consignment",
        )
    service = PDFService(db)
    docs = await service.list_documents(
        reference_type=reference_type,
        reference_id=reference_id,
        doc_type=doc_type,
    )
    return docs


@router.get(
    "/types",
    summary="Lista los tipos de documentos disponibles",
)
async def list_doc_types(current_user=Depends(get_current_user)):
    """Devuelve los tipos de documentos PDF que el sistema puede generar."""
    return list(TEMPLATE_MAP.keys())
