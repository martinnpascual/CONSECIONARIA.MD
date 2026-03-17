"""
services/cash_service.py — Lógica de negocio del módulo de Caja

Gestiona apertura/cierre de cajas diarias y todos los movimientos de ingreso/egreso.
Multi-moneda: ARS y USD con tipo de cambio configurable por caja.
"""
import math
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.schemas.cash_schemas import (
    CashMovementCreate,
    CashMovementFilters,
    CashMovementOut,
    CashPeriodReport,
    CashRegisterClose,
    CashRegisterOpen,
    CashRegisterOut,
    CashSummary,
    PaginatedMovements,
)
from app.utils.security import CurrentUser


class CashService:
    """Servicio del módulo Caja y Movimientos Financieros."""

    def __init__(self, db: Client):
        self.db = db

    # ──────────────────────────────────────────
    # Obtener caja abierta
    # ──────────────────────────────────────────
    async def get_open_register(self) -> Optional[dict]:
        """Retorna la caja actualmente abierta, o None si no hay ninguna."""
        response = self.db.table("cash_registers").select("*").eq(
            "status", "abierta"
        ).execute()
        return response.data[0] if response.data else None

    async def require_open_register(self) -> dict:
        """Igual que get_open_register pero lanza 422 si no hay caja abierta."""
        register = await self.get_open_register()
        if not register:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No hay ninguna caja abierta. Abrí la caja antes de registrar movimientos."
            )
        return register

    # ──────────────────────────────────────────
    # Abrir caja
    # ──────────────────────────────────────────
    async def open_register(
        self, data: CashRegisterOpen, current_user: CurrentUser
    ) -> CashRegisterOut:
        """Abre una nueva caja del día. Solo puede haber una abierta por fecha."""
        # Verificar que no haya caja abierta
        existing = await self.get_open_register()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya hay una caja abierta (fecha: {existing['open_date']}). "
                       f"Cerrala antes de abrir una nueva."
            )

        today = date.today().isoformat()
        now = datetime.now(timezone.utc).isoformat()

        payload = {
            "opened_by": str(current_user.id),
            "open_date": today,
            "opened_at": now,
            "status": "abierta",
            "opening_balance_ars": data.opening_balance_ars,
            "opening_balance_usd": data.opening_balance_usd,
            "usd_rate": data.usd_rate,
            "notes": data.notes,
            "created_at": now,
            "updated_at": now,
        }

        response = self.db.table("cash_registers").insert(payload).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al abrir la caja"
            )

        return await self._enrich_register(response.data[0])

    # ──────────────────────────────────────────
    # Cerrar caja
    # ──────────────────────────────────────────
    async def close_register(
        self, register_id: UUID, data: CashRegisterClose, current_user: CurrentUser
    ) -> CashRegisterOut:
        """Cierra una caja registrando el saldo final."""
        response = self.db.table("cash_registers").select("*").eq(
            "id", str(register_id)
        ).execute()

        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caja no encontrada")

        register = response.data[0]
        if register["status"] == "cerrada":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Esta caja ya está cerrada"
            )

        now = datetime.now(timezone.utc).isoformat()
        update_payload = {
            "status": "cerrada",
            "closed_by": str(current_user.id),
            "closed_at": now,
            "closing_balance_ars": data.closing_balance_ars,
            "closing_balance_usd": data.closing_balance_usd,
            "notes": data.notes or register.get("notes"),
            "updated_at": now,
        }

        self.db.table("cash_registers").update(update_payload).eq("id", str(register_id)).execute()

        # Leer el registro actualizado
        updated = self.db.table("cash_registers").select("*").eq("id", str(register_id)).execute()
        return await self._enrich_register(updated.data[0])

    # ──────────────────────────────────────────
    # Listar cajas
    # ──────────────────────────────────────────
    async def list_registers(
        self,
        page: int = 1,
        per_page: int = 20,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> dict:
        """Lista cajas ordenadas por fecha desc."""
        query = self.db.table("cash_registers").select("*", count="exact")

        if date_from:
            query = query.gte("open_date", date_from.isoformat())
        if date_to:
            query = query.lte("open_date", date_to.isoformat())

        offset = (page - 1) * per_page
        query = query.order("open_date", desc=True).range(offset, offset + per_page - 1)

        response = query.execute()
        total = response.count or 0
        rows = [await self._enrich_register(r) for r in (response.data or [])]

        return {
            "data": rows,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": math.ceil(total / per_page) if total > 0 else 1,
        }

    async def _enrich_register(self, row: dict) -> CashRegisterOut:
        """Agrega nombres de quien abrió/cerró la caja."""
        opened_by_name = None
        if row.get("opened_by"):
            r = self.db.table("user_profiles").select("full_name").eq("id", row["opened_by"]).execute()
            if r.data:
                opened_by_name = r.data[0]["full_name"]

        closed_by_name = None
        if row.get("closed_by"):
            r = self.db.table("user_profiles").select("full_name").eq("id", row["closed_by"]).execute()
            if r.data:
                closed_by_name = r.data[0]["full_name"]

        return CashRegisterOut(**row, opened_by_name=opened_by_name, closed_by_name=closed_by_name)

    # ──────────────────────────────────────────
    # Resumen de caja actual
    # ──────────────────────────────────────────
    async def get_summary(self, register_id: Optional[UUID] = None) -> CashSummary:
        """
        Retorna el resumen de la caja (ingresos, egresos, saldo).
        Si no se especifica register_id, usa la caja abierta.
        """
        if register_id:
            response = self.db.table("v_cash_summary").select("*").eq(
                "cash_register_id", str(register_id)
            ).execute()
        else:
            response = self.db.table("v_cash_summary").select("*").eq(
                "status", "abierta"
            ).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Caja no encontrada o sin movimientos"
            )

        row = response.data[0]
        summary = CashSummary(**row)

        # Calcular saldo actual
        summary.balance_ars = (
            row["opening_balance_ars"]
            + row["total_income_ars"]
            - row["total_expense_ars"]
        )
        summary.balance_usd = (
            row["opening_balance_usd"]
            + row["total_income_usd"]
            - row["total_expense_usd"]
        )
        return summary

    # ──────────────────────────────────────────
    # Registrar movimiento
    # ──────────────────────────────────────────
    async def add_movement(
        self, data: CashMovementCreate, current_user: CurrentUser
    ) -> CashMovementOut:
        """Registra un movimiento en la caja actualmente abierta."""
        register = await self.require_open_register()

        now = datetime.now(timezone.utc)
        movement_date = data.movement_date or now.date()

        payload = {
            "cash_register_id": register["id"],
            "movement_type": data.movement_type,
            "category": data.category,
            "description": data.description,
            "amount": data.amount,
            "currency": data.currency,
            "usd_rate": data.usd_rate,
            "payment_method": data.payment_method,
            "reference_type": data.reference_type,
            "reference_id": str(data.reference_id) if data.reference_id else None,
            "person_id": str(data.person_id) if data.person_id else None,
            "movement_date": movement_date.isoformat(),
            "reference": data.reference,
            "notes": data.notes,
            "registered_by": str(current_user.id),
            "created_at": now.isoformat(),
        }

        response = self.db.table("cash_movements").insert(payload).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al registrar el movimiento"
            )

        return await self._enrich_movement(response.data[0])

    # ──────────────────────────────────────────
    # Listar movimientos
    # ──────────────────────────────────────────
    async def list_movements(self, filters: CashMovementFilters) -> PaginatedMovements:
        """Lista movimientos con filtros y paginación."""
        query = self.db.table("cash_movements").select("*", count="exact")

        if filters.cash_register_id:
            query = query.eq("cash_register_id", str(filters.cash_register_id))
        if filters.movement_type:
            query = query.eq("movement_type", filters.movement_type)
        if filters.category:
            query = query.eq("category", filters.category)
        if filters.currency:
            query = query.eq("currency", filters.currency)
        if filters.date_from:
            query = query.gte("movement_date", filters.date_from.isoformat())
        if filters.date_to:
            query = query.lte("movement_date", filters.date_to.isoformat())

        offset = (filters.page - 1) * filters.per_page
        query = query.order("created_at", desc=True).range(offset, offset + filters.per_page - 1)

        response = query.execute()
        total = response.count or 0
        items = [await self._enrich_movement(r) for r in (response.data or [])]

        return PaginatedMovements(
            data=items,
            total=total,
            page=filters.page,
            per_page=filters.per_page,
            total_pages=math.ceil(total / filters.per_page) if total > 0 else 1,
        )

    async def _enrich_movement(self, row: dict) -> CashMovementOut:
        person_name = None
        if row.get("person_id"):
            r = self.db.table("persons").select("full_name").eq("id", row["person_id"]).execute()
            if r.data:
                person_name = r.data[0]["full_name"]

        registered_by_name = None
        if row.get("registered_by"):
            r = self.db.table("user_profiles").select("full_name").eq("id", row["registered_by"]).execute()
            if r.data:
                registered_by_name = r.data[0]["full_name"]

        return CashMovementOut(**row, person_name=person_name, registered_by_name=registered_by_name)

    # ──────────────────────────────────────────
    # Reporte por período
    # ──────────────────────────────────────────
    async def get_period_report(self, date_from: date, date_to: date) -> CashPeriodReport:
        """Resumen financiero del período: totales por tipo y categoría."""
        response = self.db.table("cash_movements").select(
            "movement_type, category, amount, currency"
        ).gte("movement_date", date_from.isoformat()).lte(
            "movement_date", date_to.isoformat()
        ).execute()

        rows = response.data or []

        total_income_ars = 0.0
        total_income_usd = 0.0
        total_expense_ars = 0.0
        total_expense_usd = 0.0
        breakdown: dict[str, float] = {}

        for row in rows:
            amount = float(row["amount"])
            cat = row["category"]
            currency = row["currency"]

            if row["movement_type"] == "ingreso":
                if currency == "ARS":
                    total_income_ars += amount
                else:
                    total_income_usd += amount
                breakdown[cat] = breakdown.get(cat, 0) + amount
            else:
                if currency == "ARS":
                    total_expense_ars += amount
                else:
                    total_expense_usd += amount
                breakdown[f"egreso_{cat}"] = breakdown.get(f"egreso_{cat}", 0) + amount

        return CashPeriodReport(
            period_from=date_from,
            period_to=date_to,
            total_income_ars=total_income_ars,
            total_income_usd=total_income_usd,
            total_expense_ars=total_expense_ars,
            total_expense_usd=total_expense_usd,
            net_ars=total_income_ars - total_expense_ars,
            net_usd=total_income_usd - total_expense_usd,
            breakdown_by_category=breakdown,
        )
