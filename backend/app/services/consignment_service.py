"""
services/consignment_service.py — Lógica de negocio del módulo de Consignaciones

Flujo:
1. Se crea la consignación vinculando propietario + vehículo (que ya debe ser tipo='consignacion')
2. Cuando el vehículo se vende, se registra con sell_consignment()
3. La liquidación al propietario se marca como pagada con mark_settlement_paid()
"""
import math
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.schemas.consignment_schemas import (
    ConsignmentCreate,
    ConsignmentFilters,
    ConsignmentListItem,
    ConsignmentOut,
    ConsignmentSell,
    ConsignmentUpdate,
    PaginatedConsignments,
)
from app.utils.security import CurrentUser


class ConsignmentService:
    """Servicio del módulo de Consignaciones."""

    def __init__(self, db: Client):
        self.db = db

    # ──────────────────────────────────────────
    # Listar consignaciones
    # ──────────────────────────────────────────
    async def list_consignments(
        self, filters: ConsignmentFilters
    ) -> PaginatedConsignments:
        query = self.db.table("consignments").select("*", count="exact").is_("deleted_at", "null")

        if filters.status:
            query = query.eq("status", filters.status)
        if filters.settlement_paid is not None:
            query = query.eq("settlement_paid", filters.settlement_paid)
        if filters.date_from:
            query = query.gte("start_date", filters.date_from.isoformat())
        if filters.date_to:
            query = query.lte("start_date", filters.date_to.isoformat())

        offset = (filters.page - 1) * filters.per_page
        query = query.order("created_at", desc=True).range(offset, offset + filters.per_page - 1)

        response = query.execute()
        total = response.count or 0
        rows = response.data or []

        items = [await self._enrich_list_item(r) for r in rows]

        # Búsqueda de texto post-query
        if filters.search:
            term = filters.search.lower()
            items = [
                i for i in items
                if term in (i.consignment_number or "").lower()
                or term in (i.owner_name or "").lower()
                or term in (i.vehicle_info or "").lower()
            ]
            total = len(items)

        return PaginatedConsignments(
            data=items,
            total=total,
            page=filters.page,
            per_page=filters.per_page,
            total_pages=math.ceil(total / filters.per_page) if total > 0 else 1,
        )

    async def _enrich_list_item(self, row: dict) -> ConsignmentListItem:
        owner_name = None
        if row.get("owner_id"):
            r = self.db.table("persons").select("full_name").eq("id", row["owner_id"]).execute()
            if r.data:
                owner_name = r.data[0]["full_name"]

        vehicle_info = None
        if row.get("vehicle_id"):
            r = self.db.table("vehicles").select("brand, model, year, plate").eq(
                "id", row["vehicle_id"]
            ).execute()
            if r.data:
                v = r.data[0]
                plate = f" — {v['plate']}" if v.get("plate") else ""
                vehicle_info = f"{v['brand']} {v['model']} {v['year']}{plate}"

        return ConsignmentListItem(
            id=row["id"],
            consignment_number=row["consignment_number"],
            status=row["status"],
            owner_name=owner_name,
            vehicle_info=vehicle_info,
            owner_floor_price=float(row["owner_floor_price"]),
            commission_type=row["commission_type"],
            commission_value=float(row["commission_value"]),
            start_date=row["start_date"],
            end_date=row.get("end_date"),
            settlement_paid=row["settlement_paid"],
            owner_settlement=float(row["owner_settlement"]) if row.get("owner_settlement") else None,
        )

    # ──────────────────────────────────────────
    # Obtener consignación
    # ──────────────────────────────────────────
    async def get_consignment(self, consignment_id: UUID) -> ConsignmentOut:
        response = self.db.table("consignments").select("*").eq(
            "id", str(consignment_id)
        ).is_("deleted_at", "null").execute()

        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consignación no encontrada")

        row = response.data[0]

        # Enriquecer con propietario
        owner_name = owner_dni = owner_phone = None
        if row.get("owner_id"):
            r = self.db.table("persons").select(
                "full_name, dni, phone"
            ).eq("id", row["owner_id"]).execute()
            if r.data:
                p = r.data[0]
                owner_name = p.get("full_name")
                owner_dni = p.get("dni")
                owner_phone = p.get("phone")

        vehicle_info = vehicle_asking_price = None
        if row.get("vehicle_id"):
            r = self.db.table("vehicles").select(
                "brand, model, year, plate, asking_price"
            ).eq("id", row["vehicle_id"]).execute()
            if r.data:
                v = r.data[0]
                plate = f" — {v['plate']}" if v.get("plate") else ""
                vehicle_info = f"{v['brand']} {v['model']} {v['year']}{plate}"
                vehicle_asking_price = float(v["asking_price"]) if v.get("asking_price") else None

        return ConsignmentOut(
            **row,
            owner_name=owner_name,
            owner_dni=owner_dni,
            owner_phone=owner_phone,
            vehicle_info=vehicle_info,
            vehicle_asking_price=vehicle_asking_price,
        )

    # ──────────────────────────────────────────
    # Crear consignación
    # ──────────────────────────────────────────
    async def create_consignment(
        self, data: ConsignmentCreate, current_user: CurrentUser
    ) -> ConsignmentOut:
        # Validar propietario
        owner_resp = self.db.table("persons").select("id").eq(
            "id", str(data.owner_id)
        ).is_("deleted_at", "null").execute()
        if not owner_resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propietario no encontrado")

        # Validar vehículo
        vehicle_resp = self.db.table("vehicles").select(
            "id, vehicle_type, status, consignment_id"
        ).eq("id", str(data.vehicle_id)).is_("deleted_at", "null").execute()

        if not vehicle_resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehículo no encontrado")

        vehicle = vehicle_resp.data[0]
        if vehicle["vehicle_type"] != "consignacion":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El vehículo debe ser de tipo 'consignacion' para crear una consignación"
            )
        if vehicle.get("consignment_id"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este vehículo ya está asignado a otra consignación"
            )

        now = datetime.now(timezone.utc).isoformat()
        payload = {
            "owner_id": str(data.owner_id),
            "vehicle_id": str(data.vehicle_id),
            "owner_floor_price": data.owner_floor_price,
            "start_date": datetime.now(timezone.utc).date().isoformat(),
            "end_date": data.end_date.isoformat() if data.end_date else None,
            "commission_type": data.commission_type,
            "commission_value": data.commission_value,
            "status": "activa",
            "settlement_paid": False,
            "notes": data.notes,
            "created_at": now,
            "updated_at": now,
        }

        response = self.db.table("consignments").insert(payload).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear la consignación"
            )

        consignment_id = response.data[0]["id"]

        # Vincular vehículo a la consignación
        self.db.table("vehicles").update({
            "consignment_id": consignment_id,
            "updated_at": now,
        }).eq("id", str(data.vehicle_id)).execute()

        return await self.get_consignment(UUID(consignment_id))

    # ──────────────────────────────────────────
    # Actualizar consignación
    # ──────────────────────────────────────────
    async def update_consignment(
        self, consignment_id: UUID, data: ConsignmentUpdate
    ) -> ConsignmentOut:
        consignment = await self.get_consignment(consignment_id)

        if consignment.status == "vendida":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No se puede modificar una consignación ya vendida"
            )

        payload = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        if not payload:
            return consignment

        if "end_date" in payload and payload["end_date"] is not None:
            payload["end_date"] = payload["end_date"].isoformat()

        payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        self.db.table("consignments").update(payload).eq("id", str(consignment_id)).execute()

        return await self.get_consignment(consignment_id)

    # ──────────────────────────────────────────
    # Registrar venta
    # ──────────────────────────────────────────
    async def sell_consignment(
        self, consignment_id: UUID, data: ConsignmentSell, current_user: CurrentUser
    ) -> ConsignmentOut:
        """
        Marca la consignación como vendida y calcula comisión + liquidación.
        El trigger de PostgreSQL calculate_consignment_settlement() hace el cálculo automático.
        """
        consignment = await self.get_consignment(consignment_id)

        if consignment.status != "activa":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"La consignación está en estado '{consignment.status}', no se puede vender"
            )

        # Verificar que el precio de venta supere el precio mínimo del propietario
        if data.sale_price < consignment.owner_floor_price:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"El precio de venta (${data.sale_price:,.0f}) es menor al precio "
                       f"mínimo del propietario (${consignment.owner_floor_price:,.0f})"
            )

        now = datetime.now(timezone.utc).isoformat()
        payload = {
            "status": "vendida",
            "sale_id": str(data.sale_id),
            "sale_price": data.sale_price,
            "updated_at": now,
        }

        self.db.table("consignments").update(payload).eq("id", str(consignment_id)).execute()

        # Actualizar estado del vehículo a 'vendido'
        self.db.table("vehicles").update({
            "status": "vendido",
            "updated_at": now,
        }).eq("id", str(consignment.vehicle_id)).execute()

        return await self.get_consignment(consignment_id)

    # ──────────────────────────────────────────
    # Retirar vehículo (sin vender)
    # ──────────────────────────────────────────
    async def withdraw_consignment(
        self, consignment_id: UUID, current_user: CurrentUser
    ) -> ConsignmentOut:
        """El propietario retira el vehículo sin que se haya vendido."""
        consignment = await self.get_consignment(consignment_id)

        if consignment.status != "activa":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"No se puede retirar una consignación en estado '{consignment.status}'"
            )

        now = datetime.now(timezone.utc).isoformat()
        self.db.table("consignments").update({
            "status": "retirada",
            "updated_at": now,
        }).eq("id", str(consignment_id)).execute()

        # Dar de baja el vehículo del stock
        self.db.table("vehicles").update({
            "status": "baja",
            "updated_at": now,
        }).eq("id", str(consignment.vehicle_id)).execute()

        return await self.get_consignment(consignment_id)

    # ──────────────────────────────────────────
    # Marcar liquidación pagada
    # ──────────────────────────────────────────
    async def mark_settlement_paid(
        self, consignment_id: UUID, current_user: CurrentUser
    ) -> ConsignmentOut:
        """Marca la liquidación como pagada al propietario. Solo admin o cajero."""
        consignment = await self.get_consignment(consignment_id)

        if consignment.status != "vendida":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Solo se puede marcar como pagada una consignación vendida"
            )
        if consignment.settlement_paid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La liquidación ya fue marcada como pagada"
            )

        self.db.table("consignments").update({
            "settlement_paid": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", str(consignment_id)).execute()

        return await self.get_consignment(consignment_id)

    # ──────────────────────────────────────────
    # Soft delete
    # ──────────────────────────────────────────
    async def delete_consignment(
        self, consignment_id: UUID, current_user: CurrentUser
    ) -> dict:
        consignment = await self.get_consignment(consignment_id)

        if consignment.status == "vendida":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No se puede eliminar una consignación ya vendida"
            )

        now = datetime.now(timezone.utc).isoformat()
        self.db.table("consignments").update({
            "deleted_at": now,
            "updated_at": now,
        }).eq("id", str(consignment_id)).execute()

        return {"message": "Consignación eliminada", "id": str(consignment_id)}
