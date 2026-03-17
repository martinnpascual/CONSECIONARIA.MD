"""
services/work_order_service.py — Lógica de negocio del módulo Taller

Gestiona el ciclo de vida de las Órdenes de Trabajo:
recibido → en_proceso → listo → entregado | cancelado
"""
import math
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.schemas.work_order_schemas import (
    PaginatedWorkOrders,
    WorkOrderCreate,
    WorkOrderFilters,
    WorkOrderItemCreate,
    WorkOrderListItem,
    WorkOrderOut,
    WorkOrderStatusUpdate,
    WorkOrderUpdate,
    VALID_WO_TRANSITIONS,
)
from app.utils.security import CurrentUser


class WorkOrderService:
    """Servicio del módulo Taller / Posventa."""

    def __init__(self, db: Client):
        self.db = db

    # ──────────────────────────────────────────
    # Listar OTs
    # ──────────────────────────────────────────
    async def list_work_orders(
        self, filters: WorkOrderFilters, current_user: CurrentUser
    ) -> PaginatedWorkOrders:
        """Lista OTs con filtros y paginación. Mecánicos ven solo las suyas."""
        query = self.db.table("work_orders").select("*", count="exact").is_("deleted_at", "null")

        # Mecánicos solo ven sus OTs
        if current_user.role == "mecanico":
            query = query.eq("mechanic_id", str(current_user.id))

        if filters.status:
            query = query.eq("status", filters.status)
        if filters.work_type:
            query = query.eq("work_type", filters.work_type)
        if filters.mechanic_id and current_user.role != "mecanico":
            query = query.eq("mechanic_id", str(filters.mechanic_id))
        if filters.date_from:
            query = query.gte("entry_date", filters.date_from.isoformat())
        if filters.date_to:
            query = query.lte("entry_date", filters.date_to.isoformat())

        # Paginación
        offset = (filters.page - 1) * filters.per_page
        query = query.order("entry_date", desc=True).range(offset, offset + filters.per_page - 1)

        response = query.execute()
        total = response.count or 0
        rows = response.data or []

        # Enriquecer
        items = [await self._enrich_list_item(r) for r in rows]

        # Filtro por búsqueda de texto (post-query)
        if filters.search:
            term = filters.search.lower()
            items = [
                i for i in items
                if term in (i.order_number or "").lower()
                or term in (i.client_name or "").lower()
                or term in (i.vehicle_info or "").lower()
            ]
            total = len(items)

        return PaginatedWorkOrders(
            data=items,
            total=total,
            page=filters.page,
            per_page=filters.per_page,
            total_pages=math.ceil(total / filters.per_page) if total > 0 else 1,
        )

    async def _enrich_list_item(self, row: dict) -> WorkOrderListItem:
        """Enriquece una fila de OT con nombres de cliente y mecánico."""
        client_name = None
        if row.get("client_id"):
            r = self.db.table("persons").select("full_name").eq("id", row["client_id"]).execute()
            if r.data:
                client_name = r.data[0]["full_name"]

        mechanic_name = None
        if row.get("mechanic_id"):
            r = self.db.table("user_profiles").select("full_name").eq("id", row["mechanic_id"]).execute()
            if r.data:
                mechanic_name = r.data[0]["full_name"]

        vehicle_info = self._vehicle_info_from_row(row)

        return WorkOrderListItem(
            id=row["id"],
            order_number=row["order_number"],
            status=row["status"],
            work_type=row["work_type"],
            entry_date=row["entry_date"],
            estimated_delivery_date=row.get("estimated_delivery_date"),
            client_name=client_name,
            mechanic_name=mechanic_name,
            vehicle_info=vehicle_info,
            total=float(row.get("total") or 0),
        )

    def _vehicle_info_from_row(self, row: dict) -> Optional[str]:
        """Retorna una descripción del vehículo (stock o externo)."""
        if row.get("vehicle_id"):
            r = self.db.table("vehicles").select(
                "brand, model, year, plate"
            ).eq("id", row["vehicle_id"]).execute()
            if r.data:
                v = r.data[0]
                plate = f" — {v['plate']}" if v.get("plate") else ""
                return f"{v['brand']} {v['model']} {v['year']}{plate}"

        ext = row.get("external_vehicle")
        if ext and isinstance(ext, dict):
            plate = f" — {ext['plate']}" if ext.get("plate") else ""
            return f"{ext.get('brand', '')} {ext.get('model', '')} {ext.get('year', '')}{plate}".strip()

        return None

    # ──────────────────────────────────────────
    # Obtener OT
    # ──────────────────────────────────────────
    async def get_work_order(self, work_order_id: UUID, current_user: CurrentUser) -> WorkOrderOut:
        """Detalle completo de una OT con ítems."""
        response = self.db.table("work_orders").select("*").eq(
            "id", str(work_order_id)
        ).is_("deleted_at", "null").execute()

        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden de trabajo no encontrada")

        row = response.data[0]

        # Mecánico solo puede ver sus OTs
        if current_user.role == "mecanico" and row.get("mechanic_id") != str(current_user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a esta OT")

        # Ítems
        items_resp = self.db.table("work_order_items").select("*").eq(
            "work_order_id", str(work_order_id)
        ).order("created_at").execute()
        items = items_resp.data or []

        # Enriquecer
        client_name = None
        if row.get("client_id"):
            r = self.db.table("persons").select("full_name").eq("id", row["client_id"]).execute()
            if r.data:
                client_name = r.data[0]["full_name"]

        mechanic_name = None
        if row.get("mechanic_id"):
            r = self.db.table("user_profiles").select("full_name").eq("id", row["mechanic_id"]).execute()
            if r.data:
                mechanic_name = r.data[0]["full_name"]

        return WorkOrderOut(
            **row,
            items=items,
            client_name=client_name,
            mechanic_name=mechanic_name,
            vehicle_info=self._vehicle_info_from_row(row),
        )

    # ──────────────────────────────────────────
    # Crear OT
    # ──────────────────────────────────────────
    async def create_work_order(
        self, data: WorkOrderCreate, current_user: CurrentUser
    ) -> WorkOrderOut:
        """Crea una nueva OT. Si tiene ítems los inserta en cascada."""
        if not data.vehicle_id and not data.external_vehicle:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Se debe especificar vehicle_id o external_vehicle"
            )

        # Validar vehículo del stock si se especificó
        if data.vehicle_id:
            v_resp = self.db.table("vehicles").select("id").eq(
                "id", str(data.vehicle_id)
            ).is_("deleted_at", "null").execute()
            if not v_resp.data:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehículo no encontrado")

        now = datetime.now(timezone.utc).isoformat()
        payload: dict = {
            "status": "recibido",
            "work_type": data.work_type,
            "description": data.description,
            "observations": data.observations,
            "client_id": str(data.client_id) if data.client_id else None,
            "mechanic_id": str(data.mechanic_id) if data.mechanic_id else None,
            "estimated_delivery_date": data.estimated_delivery_date.isoformat() if data.estimated_delivery_date else None,
            "created_at": now,
            "updated_at": now,
        }

        if data.vehicle_id:
            payload["vehicle_id"] = str(data.vehicle_id)
        if data.external_vehicle:
            payload["external_vehicle"] = data.external_vehicle.model_dump()

        response = self.db.table("work_orders").insert(payload).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al crear la OT")

        work_order_id = response.data[0]["id"]

        # Insertar ítems si se enviaron
        if data.items:
            await self._add_items_bulk(UUID(work_order_id), data.items)

        return await self.get_work_order(UUID(work_order_id), current_user)

    # ──────────────────────────────────────────
    # Actualizar OT
    # ──────────────────────────────────────────
    async def update_work_order(
        self, work_order_id: UUID, data: WorkOrderUpdate, current_user: CurrentUser
    ) -> WorkOrderOut:
        """Actualiza campos de una OT (no el estado)."""
        # Verificar existencia y acceso
        await self.get_work_order(work_order_id, current_user)

        payload = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        if not payload:
            return await self.get_work_order(work_order_id, current_user)

        # Convertir fechas a ISO
        for date_field in ("estimated_delivery_date", "actual_delivery_date"):
            if date_field in payload and payload[date_field] is not None:
                payload[date_field] = payload[date_field].isoformat()

        if "mechanic_id" in payload and payload["mechanic_id"] is not None:
            payload["mechanic_id"] = str(payload["mechanic_id"])

        payload["updated_at"] = datetime.now(timezone.utc).isoformat()

        self.db.table("work_orders").update(payload).eq("id", str(work_order_id)).execute()
        return await self.get_work_order(work_order_id, current_user)

    # ──────────────────────────────────────────
    # Cambio de estado
    # ──────────────────────────────────────────
    async def change_status(
        self, work_order_id: UUID, data: WorkOrderStatusUpdate, current_user: CurrentUser
    ) -> WorkOrderOut:
        """Avanza el estado de la OT siguiendo la máquina de estados."""
        wo = await self.get_work_order(work_order_id, current_user)
        current_status = wo.status

        allowed = VALID_WO_TRANSITIONS.get(current_status, [])
        if data.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"No se puede pasar de '{current_status}' a '{data.status}'. "
                       f"Transiciones válidas: {allowed}",
            )

        payload: dict = {
            "status": data.status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Al entregar, registrar fecha real
        if data.status == "entregado":
            from datetime import date as date_type
            payload["actual_delivery_date"] = date_type.today().isoformat()

        if data.notes and wo.observations:
            payload["observations"] = wo.observations + f"\n[{data.status}] {data.notes}"
        elif data.notes:
            payload["observations"] = f"[{data.status}] {data.notes}"

        self.db.table("work_orders").update(payload).eq("id", str(work_order_id)).execute()
        return await self.get_work_order(work_order_id, current_user)

    # ──────────────────────────────────────────
    # Ítems de OT
    # ──────────────────────────────────────────
    async def add_item(
        self, work_order_id: UUID, data: WorkOrderItemCreate, current_user: CurrentUser
    ) -> dict:
        """Agrega un ítem (mano de obra o repuesto) a una OT."""
        wo = await self.get_work_order(work_order_id, current_user)

        if wo.status in ("entregado", "cancelado"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"No se pueden agregar ítems a una OT en estado '{wo.status}'"
            )

        item = await self._insert_item(work_order_id, data)
        return item

    async def _insert_item(self, work_order_id: UUID, data: WorkOrderItemCreate) -> dict:
        payload = {
            "work_order_id": str(work_order_id),
            "item_type": data.item_type,
            "description": data.description,
            "part_code": data.part_code,
            "quantity": data.quantity,
            "unit_price": data.unit_price,
        }
        response = self.db.table("work_order_items").insert(payload).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al agregar ítem")
        return response.data[0]

    async def _add_items_bulk(self, work_order_id: UUID, items: list[WorkOrderItemCreate]) -> None:
        payload = [
            {
                "work_order_id": str(work_order_id),
                "item_type": i.item_type,
                "description": i.description,
                "part_code": i.part_code,
                "quantity": i.quantity,
                "unit_price": i.unit_price,
            }
            for i in items
        ]
        self.db.table("work_order_items").insert(payload).execute()

    async def delete_item(
        self, work_order_id: UUID, item_id: UUID, current_user: CurrentUser
    ) -> dict:
        """Elimina un ítem de una OT."""
        wo = await self.get_work_order(work_order_id, current_user)
        if wo.status in ("entregado", "cancelado"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"No se pueden eliminar ítems de una OT en estado '{wo.status}'"
            )

        resp = self.db.table("work_order_items").delete().eq(
            "id", str(item_id)
        ).eq("work_order_id", str(work_order_id)).execute()

        if not resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ítem no encontrado")

        return {"message": "Ítem eliminado", "item_id": str(item_id)}

    # ──────────────────────────────────────────
    # Soft delete OT
    # ──────────────────────────────────────────
    async def delete_work_order(self, work_order_id: UUID, current_user: CurrentUser) -> dict:
        """Elimina lógicamente una OT. Solo admin y mecánico asignado."""
        wo = await self.get_work_order(work_order_id, current_user)

        if wo.status == "entregado":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No se puede eliminar una OT ya entregada"
            )

        now = datetime.now(timezone.utc).isoformat()
        self.db.table("work_orders").update({
            "deleted_at": now,
            "updated_at": now,
        }).eq("id", str(work_order_id)).execute()

        return {"message": "Orden de trabajo eliminada", "id": str(work_order_id)}
