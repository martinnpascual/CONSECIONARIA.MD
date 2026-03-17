"""
services/vehicle_service.py — Lógica de negocio para el módulo de Stock

Toda la lógica de negocio va acá. Los routers solo delegan a este servicio.
"""
import math
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.schemas.vehicle_schemas import (
    VehicleCreate,
    VehicleUpdate,
    VehicleFilters,
    PaginatedVehicles,
    VehicleListItem,
)
from app.utils.security import CurrentUser


class VehicleService:
    """Servicio de gestión del inventario de vehículos."""

    def __init__(self, db: Client):
        self.db = db

    # ──────────────────────────────────────────
    # Listar vehículos con filtros y paginación
    # ──────────────────────────────────────────
    async def list_vehicles(
        self,
        filters: VehicleFilters,
        current_user: CurrentUser,
    ) -> PaginatedVehicles:
        """
        Lista vehículos con filtros dinámicos y paginación.
        - Admin: ve todos los campos
        - Vendedor/otros: no ven cost_price
        """
        query = self.db.table("vehicles").select(
            "id, vehicle_type, status, brand, model, version, year, color, "
            "fuel_type, transmission, mileage, list_price, currency, "
            "location, entry_date, sale_date",
            count="exact",
        ).is_("deleted_at", "null")

        # Aplicar filtros
        if filters.vehicle_type:
            query = query.eq("vehicle_type", filters.vehicle_type)
        if filters.status:
            query = query.eq("status", filters.status)
        if filters.brand:
            query = query.ilike("brand", f"%{filters.brand}%")
        if filters.model:
            query = query.ilike("model", f"%{filters.model}%")
        if filters.fuel_type:
            query = query.eq("fuel_type", filters.fuel_type)
        if filters.transmission:
            query = query.eq("transmission", filters.transmission)
        if filters.year_from:
            query = query.gte("year", filters.year_from)
        if filters.year_to:
            query = query.lte("year", filters.year_to)
        if filters.price_from:
            query = query.gte("list_price", float(filters.price_from))
        if filters.price_to:
            query = query.lte("list_price", float(filters.price_to))
        if filters.location:
            query = query.ilike("location", f"%{filters.location}%")
        if filters.search:
            # Búsqueda en múltiples campos (ilike en cada uno)
            search_term = f"%{filters.search}%"
            query = query.or_(
                f"brand.ilike.{search_term},"
                f"model.ilike.{search_term},"
                f"version.ilike.{search_term},"
                f"plate.ilike.{search_term},"
                f"chassis_number.ilike.{search_term}"
            )

        # Paginación
        offset = (filters.page - 1) * filters.per_page
        query = query.order("created_at", desc=True).range(
            offset, offset + filters.per_page - 1
        )

        response = query.execute()

        total = response.count or 0
        items_data = response.data or []

        # Calcular días en stock y agregar foto principal
        today = date.today()
        items = []
        for row in items_data:
            entry = row.get("entry_date")
            days_in_stock = None
            if entry:
                entry_date = date.fromisoformat(entry)
                days_in_stock = (today - entry_date).days

            # Obtener foto principal
            photo_resp = self.db.table("vehicle_photos").select("url").eq(
                "vehicle_id", row["id"]
            ).eq("is_main", True).limit(1).execute()
            main_photo = photo_resp.data[0]["url"] if photo_resp.data else None

            items.append(VehicleListItem(
                **row,
                days_in_stock=days_in_stock,
                main_photo_url=main_photo,
            ))

        return PaginatedVehicles(
            items=items,
            total=total,
            page=filters.page,
            per_page=filters.per_page,
            pages=math.ceil(total / filters.per_page) if total > 0 else 0,
        )

    # ──────────────────────────────────────────
    # Obtener un vehículo por ID
    # ──────────────────────────────────────────
    async def get_vehicle(
        self,
        vehicle_id: UUID,
        current_user: CurrentUser,
    ) -> dict:
        """
        Retorna el detalle completo de un vehículo.
        Si el usuario NO es admin, excluye cost_price del resultado.
        """
        response = self.db.table("vehicles").select(
            "*, vehicle_photos(*)"
        ).eq("id", str(vehicle_id)).is_("deleted_at", "null").single().execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehículo no encontrado",
            )

        vehicle = response.data

        # Ocultar precio de costo si no es admin
        if current_user.role != "admin":
            vehicle.pop("cost_price", None)
            # También ocultar min_price si no es admin ni vendedor
            if current_user.role not in ("admin", "vendedor"):
                vehicle.pop("min_price", None)

        return vehicle

    # ──────────────────────────────────────────
    # Crear vehículo
    # ──────────────────────────────────────────
    async def create_vehicle(
        self,
        data: VehicleCreate,
        current_user: CurrentUser,
    ) -> dict:
        """Crea un nuevo vehículo en el stock."""
        # Solo admin puede setear cost_price
        vehicle_data = data.model_dump(exclude_none=True)
        if current_user.role != "admin" and "cost_price" in vehicle_data:
            del vehicle_data["cost_price"]

        # Convertir Decimal a float para Supabase
        for field in ("list_price", "cost_price", "min_price"):
            if field in vehicle_data and isinstance(vehicle_data[field], Decimal):
                vehicle_data[field] = float(vehicle_data[field])

        # Convertir equipment list a JSON
        if "equipment" in vehicle_data and isinstance(vehicle_data["equipment"], list):
            vehicle_data["equipment"] = vehicle_data["equipment"]

        response = self.db.table("vehicles").insert(vehicle_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear el vehículo",
            )

        return response.data[0]

    # ──────────────────────────────────────────
    # Actualizar vehículo
    # ──────────────────────────────────────────
    async def update_vehicle(
        self,
        vehicle_id: UUID,
        data: VehicleUpdate,
        current_user: CurrentUser,
    ) -> dict:
        """Actualiza los datos de un vehículo."""
        # Verificar que existe
        await self.get_vehicle(vehicle_id, current_user)

        update_data = data.model_dump(exclude_none=True)

        # Solo admin puede cambiar cost_price y status a 'vendido' o 'baja'
        if current_user.role != "admin":
            update_data.pop("cost_price", None)
            if update_data.get("status") in ("vendido", "baja"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Solo el admin puede marcar vehículos como vendido o baja",
                )

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No hay datos para actualizar",
            )

        # Convertir Decimal a float
        for field in ("list_price", "cost_price", "min_price"):
            if field in update_data and isinstance(update_data[field], Decimal):
                update_data[field] = float(update_data[field])

        response = self.db.table("vehicles").update(update_data).eq(
            "id", str(vehicle_id)
        ).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al actualizar el vehículo",
            )

        return response.data[0]

    # ──────────────────────────────────────────
    # Soft delete
    # ──────────────────────────────────────────
    async def delete_vehicle(
        self,
        vehicle_id: UUID,
        current_user: CurrentUser,
    ) -> dict:
        """Soft delete: marca deleted_at, no borra el registro."""
        from datetime import datetime, timezone
        vehicle = await self.get_vehicle(vehicle_id, current_user)

        if vehicle.get("status") == "vendido":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede eliminar un vehículo vendido",
            )

        response = self.db.table("vehicles").update({
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "status": "baja",
        }).eq("id", str(vehicle_id)).execute()

        return {"message": "Vehículo dado de baja correctamente"}

    # ──────────────────────────────────────────
    # Reservar vehículo
    # ──────────────────────────────────────────
    async def reserve_vehicle(
        self,
        vehicle_id: UUID,
        sale_id: UUID,
        current_user: CurrentUser,
    ) -> dict:
        """Reserva un vehículo para una venta específica."""
        vehicle = await self.get_vehicle(vehicle_id, current_user)

        if vehicle.get("status") != "disponible":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El vehículo no está disponible (estado: {vehicle.get('status')})",
            )

        response = self.db.table("vehicles").update({
            "status": "reservado",
            "sale_id": str(sale_id),
        }).eq("id", str(vehicle_id)).execute()

        return {"message": "Vehículo reservado correctamente", "status": "reservado"}

    # ──────────────────────────────────────────
    # Gestión de fotos
    # ──────────────────────────────────────────
    async def get_vehicle_photos(self, vehicle_id: UUID) -> list[dict]:
        """Lista las fotos de un vehículo ordenadas por sort_order."""
        response = self.db.table("vehicle_photos").select("*").eq(
            "vehicle_id", str(vehicle_id)
        ).order("sort_order").execute()
        return response.data or []

    async def add_vehicle_photo(
        self,
        vehicle_id: UUID,
        url: str,
        storage_path: str,
        is_main: bool = False,
        sort_order: int = 0,
    ) -> dict:
        """Registra una foto ya subida a Supabase Storage."""
        # Si es principal, desmarcar las anteriores
        if is_main:
            self.db.table("vehicle_photos").update({"is_main": False}).eq(
                "vehicle_id", str(vehicle_id)
            ).execute()

        response = self.db.table("vehicle_photos").insert({
            "vehicle_id": str(vehicle_id),
            "url": url,
            "storage_path": storage_path,
            "is_main": is_main,
            "sort_order": sort_order,
        }).execute()

        return response.data[0]

    async def delete_vehicle_photo(
        self,
        vehicle_id: UUID,
        photo_id: UUID,
    ) -> dict:
        """Elimina una foto del vehículo."""
        # Obtener storage_path para eliminar del Storage también
        photo_resp = self.db.table("vehicle_photos").select("storage_path").eq(
            "id", str(photo_id)
        ).eq("vehicle_id", str(vehicle_id)).single().execute()

        if not photo_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Foto no encontrada",
            )

        storage_path = photo_resp.data["storage_path"]

        # Eliminar de Storage
        self.db.storage.from_("vehicle-photos").remove([storage_path])

        # Eliminar registro
        self.db.table("vehicle_photos").delete().eq("id", str(photo_id)).execute()

        return {"message": "Foto eliminada correctamente"}

    # ──────────────────────────────────────────
    # Historial de precios
    # ──────────────────────────────────────────
    async def get_price_history(self, vehicle_id: UUID) -> list[dict]:
        """Retorna el historial de cambios de precio (solo admin)."""
        response = self.db.table("vehicle_price_history").select(
            "*, changed_by:user_profiles(full_name)"
        ).eq("vehicle_id", str(vehicle_id)).order("created_at", desc=True).execute()
        return response.data or []

    # ──────────────────────────────────────────
    # Vehículos con alta antigüedad (alerta)
    # ──────────────────────────────────────────
    async def get_stale_vehicles(self, days_threshold: int = 90) -> list[dict]:
        """Retorna vehículos con más de N días en stock sin vender."""
        threshold_date = date.today().replace(
            day=date.today().day - days_threshold
        )
        response = self.db.table("vehicles").select(
            "id, brand, model, version, year, entry_date, list_price, status"
        ).in_("status", ["disponible", "reservado"]).lte(
            "entry_date", threshold_date.isoformat()
        ).is_("deleted_at", "null").order("entry_date").execute()
        return response.data or []
