"""
services/invoice_service.py — Lógica del módulo de Facturación ARCA

Flujo de emisión:
1. Recibir solicitud con reference_id (venta u OT)
2. Leer datos del cliente/receptor y montos desde la DB
3. Construir el request para MrBot API
4. Emitir via MrBot → ARCA → CAE
5. Guardar factura en tabla `invoices` con response completo
6. Generar QR AFIP (opcional)
7. Retornar InvoiceOut con CAE
"""
import math
import qrcode
import io
import base64
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.config import get_settings
from app.schemas.invoice_schemas import (
    InvoiceFilters,
    InvoiceOut,
    InvoiceRequest,
    PaginatedInvoices,
)
from app.services.mrbot_service import MrBotInvoiceRequest, MrBotService
from app.utils.security import CurrentUser

settings = get_settings()


class InvoiceService:
    """Servicio de facturación electrónica ARCA."""

    def __init__(self, db: Client):
        self.db = db
        self.mrbot = MrBotService()

    # ──────────────────────────────────────────
    # Emitir factura
    # ──────────────────────────────────────────
    async def emit_invoice(
        self, data: InvoiceRequest, current_user: CurrentUser
    ) -> InvoiceOut:
        """
        Proceso completo de emisión de factura electrónica:
        1. Leer datos de la venta/OT
        2. Resolver montos y receptor
        3. Llamar a MrBot API
        4. Persistir resultado en DB
        """
        # ── 1. Leer datos según reference_type ──
        if data.reference_type == "sale":
            ref_data = await self._load_sale_data(data.reference_id)
        elif data.reference_type == "work_order":
            ref_data = await self._load_work_order_data(data.reference_id)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="reference_type debe ser 'sale' o 'work_order'"
            )

        # ── 2. Resolver montos ──
        total_amount = data.total_amount or ref_data["total_amount"]
        if data.invoice_type in ("A",) and data.iva_amount is None:
            # Factura A: neto + IVA 21%
            net_amount = data.net_amount or round(total_amount / 1.21, 2)
            iva_amount = round(total_amount - net_amount, 2)
        elif data.invoice_type in ("B", "C"):
            # Factura B/C: monto total = neto (sin discriminar IVA)
            net_amount = total_amount
            iva_amount = 0.0
        else:
            net_amount = data.net_amount or total_amount
            iva_amount = data.iva_amount or 0.0

        # ── 3. Resolver receptor ──
        receptor_cuit = data.receptor_cuit or ref_data.get("client_cuit")
        receptor_name = data.receptor_name or ref_data.get("client_name", "Consumidor Final")
        receptor_iva_cond = data.receptor_iva_cond or "Consumidor Final"

        # Factura A requiere CUIT del receptor
        if data.invoice_type == "A" and not receptor_cuit:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Factura A requiere CUIT del receptor"
            )

        description = data.description or ref_data.get("description", "Compraventa de vehículo automotor")

        # ── 4. Crear registro en DB (pendiente) ──
        now = datetime.now(timezone.utc).isoformat()
        invoice_payload = {
            "invoice_type": data.invoice_type,
            "punto_venta": settings.afip_punto_venta,
            "emisor_cuit": settings.afip_cuit,
            "receptor_cuit": receptor_cuit,
            "receptor_name": receptor_name,
            "receptor_iva_cond": receptor_iva_cond,
            "reference_type": data.reference_type,
            "reference_id": str(data.reference_id),
            "net_amount": net_amount,
            "iva_amount": iva_amount,
            "total_amount": total_amount,
            "status": "pendiente",
            "invoice_date": datetime.now(timezone.utc).date().isoformat(),
            "created_by": str(current_user.id),
            "created_at": now,
            "updated_at": now,
        }
        inv_resp = self.db.table("invoices").insert(invoice_payload).execute()
        if not inv_resp.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear el registro de factura"
            )
        invoice_id = inv_resp.data[0]["id"]

        # ── 5. Emitir via MrBot ──
        mrbot_request = MrBotInvoiceRequest(
            invoice_type=data.invoice_type,
            punto_venta=settings.afip_punto_venta,
            emisor_cuit=settings.afip_cuit,
            receptor_cuit=receptor_cuit,
            receptor_name=receptor_name,
            receptor_iva_cond=receptor_iva_cond,
            net_amount=net_amount,
            iva_amount=iva_amount,
            total_amount=total_amount,
            description=description,
        )

        try:
            mrbot_response = await self.mrbot.emit_invoice(mrbot_request)
            parsed = self.mrbot.parse_cae_response(mrbot_response)

            # Generar QR AFIP
            qr_url = self._generate_qr_data_url(
                cuit=settings.afip_cuit,
                punto_venta=settings.afip_punto_venta,
                tipo_cbte={"A": 1, "B": 6, "C": 11}.get(data.invoice_type, 6),
                nro_cbte=int(parsed["invoice_number"] or 0),
                importe_total=total_amount,
                cae=parsed["cae"] or "",
                vto_cae=parsed["cae_expiry_date"] or "",
            )

            # Actualizar factura con CAE
            self.db.table("invoices").update({
                "status": "emitida",
                "cae": parsed["cae"],
                "cae_expiry_date": parsed["cae_expiry_date"],
                "invoice_number": parsed["invoice_number"],
                "mrbot_response": mrbot_response,
                "qr_url": qr_url,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", invoice_id).execute()

            # Vincular factura a la venta u OT
            if data.reference_type == "sale":
                self.db.table("sales").update({
                    "invoice_id": invoice_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", str(data.reference_id)).execute()
            elif data.reference_type == "work_order":
                self.db.table("work_orders").update({
                    "invoice_id": invoice_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", str(data.reference_id)).execute()

        except HTTPException:
            # Actualizar estado a error
            self.db.table("invoices").update({
                "status": "error",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", invoice_id).execute()
            raise

        except Exception as e:
            self.db.table("invoices").update({
                "status": "error",
                "error_message": str(e)[:500],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", invoice_id).execute()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error inesperado al emitir factura: {str(e)[:200]}"
            )

        return await self.get_invoice(UUID(invoice_id))

    # ──────────────────────────────────────────
    # Obtener factura
    # ──────────────────────────────────────────
    async def get_invoice(self, invoice_id: UUID) -> InvoiceOut:
        response = self.db.table("invoices").select("*").eq(
            "id", str(invoice_id)
        ).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada")

        row = response.data[0]

        # Enriquecer con nombre del emisor
        created_by_name = None
        if row.get("created_by"):
            r = self.db.table("user_profiles").select("full_name").eq(
                "id", row["created_by"]
            ).execute()
            if r.data:
                created_by_name = r.data[0]["full_name"]

        return InvoiceOut(**row, created_by_name=created_by_name)

    # ──────────────────────────────────────────
    # Listar facturas
    # ──────────────────────────────────────────
    async def list_invoices(self, filters: InvoiceFilters) -> PaginatedInvoices:
        query = self.db.table("invoices").select("*", count="exact")

        if filters.reference_type:
            query = query.eq("reference_type", filters.reference_type)
        if filters.reference_id:
            query = query.eq("reference_id", str(filters.reference_id))
        if filters.invoice_type:
            query = query.eq("invoice_type", filters.invoice_type)
        if filters.status:
            query = query.eq("status", filters.status)
        if filters.date_from:
            query = query.gte("invoice_date", filters.date_from.isoformat())
        if filters.date_to:
            query = query.lte("invoice_date", filters.date_to.isoformat())

        offset = (filters.page - 1) * filters.per_page
        query = query.order("created_at", desc=True).range(offset, offset + filters.per_page - 1)

        response = query.execute()
        total = response.count or 0
        rows = response.data or []

        invoices = [InvoiceOut(**r) for r in rows]

        return PaginatedInvoices(
            data=invoices,
            total=total,
            page=filters.page,
            per_page=filters.per_page,
            total_pages=math.ceil(total / filters.per_page) if total > 0 else 1,
        )

    # ──────────────────────────────────────────
    # Cargar datos de referencia
    # ──────────────────────────────────────────
    async def _load_sale_data(self, sale_id: UUID) -> dict:
        resp = self.db.table("sales").select(
            "id, final_price, client_id, invoice_id"
        ).eq("id", str(sale_id)).execute()

        if not resp.data:
            raise HTTPException(status_code=404, detail="Venta no encontrada")

        sale = resp.data[0]
        if sale.get("invoice_id"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Esta venta ya tiene una factura emitida"
            )

        # Datos del cliente
        client_data: dict = {}
        if sale.get("client_id"):
            c_resp = self.db.table("persons").select(
                "full_name, dni"
            ).eq("id", sale["client_id"]).execute()
            if c_resp.data:
                client_data = c_resp.data[0]

        return {
            "total_amount": float(sale["final_price"]),
            "client_name": client_data.get("full_name", "Consumidor Final"),
            "client_cuit": client_data.get("dni"),
            "description": "Compraventa de vehículo automotor",
        }

    async def _load_work_order_data(self, wo_id: UUID) -> dict:
        resp = self.db.table("work_orders").select(
            "id, total, client_id, invoice_id"
        ).eq("id", str(wo_id)).execute()

        if not resp.data:
            raise HTTPException(status_code=404, detail="OT no encontrada")

        wo = resp.data[0]
        if wo.get("invoice_id"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Esta OT ya tiene una factura emitida"
            )

        client_data: dict = {}
        if wo.get("client_id"):
            c_resp = self.db.table("persons").select(
                "full_name, dni"
            ).eq("id", wo["client_id"]).execute()
            if c_resp.data:
                client_data = c_resp.data[0]

        return {
            "total_amount": float(wo["total"]),
            "client_name": client_data.get("full_name", "Consumidor Final"),
            "client_cuit": client_data.get("dni"),
            "description": "Servicio técnico automotor",
        }

    # ──────────────────────────────────────────
    # QR AFIP (Data Matrix)
    # ──────────────────────────────────────────
    def _generate_qr_data_url(
        self,
        cuit: str,
        punto_venta: int,
        tipo_cbte: int,
        nro_cbte: int,
        importe_total: float,
        cae: str,
        vto_cae: str,
    ) -> Optional[str]:
        """Genera un QR code con los datos AFIP y lo retorna como data URL base64."""
        try:
            import json
            import base64 as b64_module

            qr_data = {
                "ver": 1,
                "fecha": datetime.now().strftime("%Y-%m-%d"),
                "cuit": int(cuit.replace("-", "")),
                "ptoVta": punto_venta,
                "tipoCmp": tipo_cbte,
                "nroCmp": nro_cbte,
                "importe": importe_total,
                "moneda": "PES",
                "ctz": 1,
                "tipoDocRec": 99,
                "nroDocRec": 0,
                "tipoCodAut": "E",
                "codAut": int(cae) if cae.isdigit() else 0,
            }

            # Codificar en base64 para el QR
            json_str = json.dumps(qr_data, separators=(",", ":"))
            b64_str = b64_module.b64encode(json_str.encode()).decode()
            qr_url = f"https://www.afip.gob.ar/fe/qr/?p={b64_str}"

            # Generar imagen QR
            qr_img = qrcode.make(qr_url)
            buffer = io.BytesIO()
            qr_img.save(buffer, format="PNG")
            img_b64 = base64.b64encode(buffer.getvalue()).decode()
            return f"data:image/png;base64,{img_b64}"
        except Exception:
            return None
