"""
services/pdf_service.py — Generación de documentos PDF con WeasyPrint + Jinja2

Flujo por documento:
1. Obtener los datos necesarios de Supabase
2. Renderizar el template Jinja2 → HTML string
3. Convertir HTML → PDF con WeasyPrint
4. Subir el PDF a Supabase Storage (bucket 'documents')
5. Registrar el documento en la tabla `documents`
6. Retornar la URL pública del PDF
"""
import io
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException, status
from jinja2 import Environment, FileSystemLoader, select_autoescape
from supabase import Client
from weasyprint import HTML, CSS

# Directorio de templates
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

# Inicializar Jinja2
jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)

# Tipos de documentos soportados
TEMPLATE_MAP: dict[str, str] = {
    "cotizacion":              "cotizacion.html",
    "boleto_compraventa":      "boleto_compraventa.html",
    "recibo_sena":             "recibo_sena.html",
    "acta_entrega":            "acta_entrega.html",
    "orden_trabajo":           "orden_trabajo.html",
    "contrato_consignacion":   "contrato_consignacion.html",
}

REFERENCE_TYPE_MAP: dict[str, str] = {
    "cotizacion":              "sale",
    "boleto_compraventa":      "sale",
    "recibo_sena":             "sale",
    "acta_entrega":            "sale",
    "orden_trabajo":           "work_order",
    "contrato_consignacion":   "consignment",
}


class PDFService:
    """Servicio de generación y almacenamiento de documentos PDF."""

    def __init__(self, db: Client):
        self.db = db

    # ──────────────────────────────────────────
    # Datos del negocio
    # ──────────────────────────────────────────
    def _get_business_data(self) -> dict:
        """Lee los datos del negocio (membrete) desde la tabla businesses."""
        resp = self.db.table("businesses").select("*").execute()
        if resp.data:
            return resp.data[0]
        return {
            "legal_name": "DM Cars",
            "cuit": "",
            "address": "",
            "phone": "",
            "email": "",
            "city": "Buenos Aires",
            "tagline": "Concesionaria Dante Mostajo",
        }

    # ──────────────────────────────────────────
    # Render HTML → PDF bytes
    # ──────────────────────────────────────────
    def _render_pdf(self, template_name: str, context: dict) -> bytes:
        """Renderiza un template Jinja2 y lo convierte a PDF con WeasyPrint."""
        template = jinja_env.get_template(template_name)
        html_string = template.render(**context)
        pdf_bytes = HTML(string=html_string, base_url=str(TEMPLATES_DIR)).write_pdf()
        return pdf_bytes

    # ──────────────────────────────────────────
    # Upload a Supabase Storage
    # ──────────────────────────────────────────
    def _upload_to_storage(
        self, pdf_bytes: bytes, filename: str, folder: str
    ) -> tuple[str, str]:
        """
        Sube el PDF al bucket 'documents' en Supabase Storage.
        Retorna (storage_path, public_url).
        """
        storage_path = f"{folder}/{filename}"
        self.db.storage.from_("documents").upload(
            storage_path,
            pdf_bytes,
            {"content-type": "application/pdf", "upsert": "true"},
        )
        public_url = self.db.storage.from_("documents").get_public_url(storage_path)
        return storage_path, public_url

    # ──────────────────────────────────────────
    # Registrar en tabla documents
    # ──────────────────────────────────────────
    def _register_document(
        self,
        doc_type: str,
        reference_type: str,
        reference_id: Optional[str],
        storage_path: str,
        public_url: str,
        filename: str,
        file_size: int,
        generated_by: str,
    ) -> dict:
        payload = {
            "doc_type": doc_type,
            "reference_type": reference_type,
            "reference_id": reference_id,
            "storage_path": storage_path,
            "public_url": public_url,
            "filename": filename,
            "file_size_bytes": file_size,
            "generated_by": generated_by,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = self.db.table("documents").insert(payload).execute()
        return resp.data[0] if resp.data else payload

    # ──────────────────────────────────────────
    # Método genérico de generación
    # ──────────────────────────────────────────
    async def generate(
        self,
        doc_type: str,
        reference_id: str,
        generated_by: str,
        extra_context: Optional[dict] = None,
    ) -> dict:
        """
        Genera un PDF de cualquier tipo, lo sube a Storage y lo registra en la DB.
        Retorna el registro de `documents` con la URL pública.
        """
        if doc_type not in TEMPLATE_MAP:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo de documento no soportado: {doc_type}. "
                       f"Válidos: {list(TEMPLATE_MAP.keys())}",
            )

        business = self._get_business_data()
        generated_at = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")

        # Obtener datos según el tipo de documento
        context = await self._build_context(doc_type, reference_id, extra_context or {})
        context["business"] = business
        context["generated_at"] = generated_at

        # Renderizar y convertir a PDF
        template_name = TEMPLATE_MAP[doc_type]
        pdf_bytes = self._render_pdf(template_name, context)

        # Nombre del archivo
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"{doc_type}_{reference_id[:8]}_{ts}.pdf"
        folder = f"{doc_type}s"  # cotizaciones/, boletos_compraventa/, etc.

        # Subir a Storage
        storage_path, public_url = self._upload_to_storage(pdf_bytes, filename, folder)

        # Registrar en DB
        reference_type = REFERENCE_TYPE_MAP[doc_type]
        doc_record = self._register_document(
            doc_type=doc_type,
            reference_type=reference_type,
            reference_id=reference_id,
            storage_path=storage_path,
            public_url=public_url,
            filename=filename,
            file_size=len(pdf_bytes),
            generated_by=generated_by,
        )

        return doc_record

    # ──────────────────────────────────────────
    # Builders de contexto por tipo de documento
    # ──────────────────────────────────────────
    async def _build_context(
        self, doc_type: str, reference_id: str, extra: dict
    ) -> dict:
        """Carga todos los datos necesarios del tipo de documento."""
        if doc_type in ("cotizacion", "boleto_compraventa", "recibo_sena", "acta_entrega"):
            return await self._context_for_sale(doc_type, reference_id, extra)
        elif doc_type == "orden_trabajo":
            return await self._context_for_work_order(reference_id, extra)
        elif doc_type == "contrato_consignacion":
            return await self._context_for_consignment(reference_id, extra)
        raise HTTPException(status_code=400, detail=f"Sin builder para {doc_type}")

    async def _context_for_sale(self, doc_type: str, sale_id: str, extra: dict) -> dict:
        """Carga el contexto completo de una venta."""
        # Venta
        sale_resp = self.db.table("sales").select("*").eq("id", sale_id).execute()
        if not sale_resp.data:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        sale = sale_resp.data[0]

        # Cliente
        client_resp = self.db.table("persons").select("*").eq(
            "id", sale["client_id"]
        ).execute()
        client = client_resp.data[0] if client_resp.data else {}

        # Vehículo
        vehicle_resp = self.db.table("vehicles").select("*").eq(
            "id", sale["vehicle_id"]
        ).execute()
        vehicle = vehicle_resp.data[0] if vehicle_resp.data else {}

        # Pagos
        payments_resp = self.db.table("sale_payments").select("*").eq(
            "sale_id", sale_id
        ).order("created_at").execute()
        payments = payments_resp.data or []

        # Vendedor
        seller_name = None
        if sale.get("seller_id"):
            s_resp = self.db.table("user_profiles").select("full_name").eq(
                "id", sale["seller_id"]
            ).execute()
            if s_resp.data:
                seller_name = s_resp.data[0]["full_name"]
        sale["seller_name"] = seller_name

        # Para recibo de seña: buscar el último pago tipo seña
        payment = None
        if doc_type == "recibo_sena":
            senas = [p for p in payments if p["payment_type"] == "seña"]
            payment = senas[-1] if senas else (payments[-1] if payments else {})

        # Trade-in
        ti_resp = self.db.table("trade_ins").select("*").eq("sale_id", sale_id).execute()
        trade_in = ti_resp.data[0] if ti_resp.data else None
        if trade_in:
            sale["trade_in"] = trade_in
            sale["trade_in_value"] = float(trade_in.get("offered_value") or 0)
            sale["trade_in_description"] = f"{trade_in.get('brand','')} {trade_in.get('model','')} {trade_in.get('year','')}"

        # Precio del vehículo para cotización
        sale["asking_price"] = float(vehicle.get("asking_price") or sale.get("final_price") or 0)

        # Para acta de entrega
        delivery = extra.get("delivery", {})

        return {
            "sale": sale,
            "client": client,
            "vehicle": vehicle,
            "payments": payments,
            "payment": payment,
            "delivery": delivery,
            "amount_in_words": extra.get("amount_in_words", ""),
        }

    async def _context_for_work_order(self, wo_id: str, extra: dict) -> dict:
        """Carga contexto de una OT."""
        wo_resp = self.db.table("work_orders").select("*").eq("id", wo_id).execute()
        if not wo_resp.data:
            raise HTTPException(status_code=404, detail="OT no encontrada")
        wo = wo_resp.data[0]

        # Mecánico
        if wo.get("mechanic_id"):
            m_resp = self.db.table("user_profiles").select("full_name").eq(
                "id", wo["mechanic_id"]
            ).execute()
            wo["mechanic_name"] = m_resp.data[0]["full_name"] if m_resp.data else None

        # Ítems
        items_resp = self.db.table("work_order_items").select("*").eq(
            "work_order_id", wo_id
        ).order("created_at").execute()

        # Cliente
        client = None
        if wo.get("client_id"):
            c_resp = self.db.table("persons").select("*").eq(
                "id", wo["client_id"]
            ).execute()
            client = c_resp.data[0] if c_resp.data else None

        # Vehículo del stock
        vehicle = None
        if wo.get("vehicle_id"):
            v_resp = self.db.table("vehicles").select("*").eq(
                "id", wo["vehicle_id"]
            ).execute()
            vehicle = v_resp.data[0] if v_resp.data else None

        return {
            "work_order": wo,
            "items": items_resp.data or [],
            "client": client,
            "vehicle": vehicle,
        }

    async def _context_for_consignment(self, consignment_id: str, extra: dict) -> dict:
        """Carga contexto de un contrato de consignación."""
        c_resp = self.db.table("consignments").select("*").eq(
            "id", consignment_id
        ).execute()
        if not c_resp.data:
            raise HTTPException(status_code=404, detail="Consignación no encontrada")
        consignment = c_resp.data[0]

        # Propietario
        owner_resp = self.db.table("persons").select("*").eq(
            "id", consignment["owner_id"]
        ).execute()
        owner = owner_resp.data[0] if owner_resp.data else {}

        # Vehículo
        v_resp = self.db.table("vehicles").select("*").eq(
            "id", consignment["vehicle_id"]
        ).execute()
        vehicle = v_resp.data[0] if v_resp.data else {}

        return {
            "consignment": consignment,
            "owner": owner,
            "vehicle": vehicle,
        }

    # ──────────────────────────────────────────
    # Listar documentos de una entidad
    # ──────────────────────────────────────────
    async def list_documents(
        self,
        reference_type: str,
        reference_id: str,
        doc_type: Optional[str] = None,
    ) -> list[dict]:
        """Lista todos los PDFs generados para una entidad."""
        query = self.db.table("documents").select("*").eq(
            "reference_type", reference_type
        ).eq("reference_id", reference_id)

        if doc_type:
            query = query.eq("doc_type", doc_type)

        response = query.order("created_at", desc=True).execute()
        return response.data or []
