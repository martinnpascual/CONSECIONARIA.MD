"""
services/sale_service.py — Lógica de negocio del módulo de Ventas

Gestiona el ciclo completo: cotización → reserva → entrega.
Incluye calculadora de financiamiento, pagos, toma de usados y comisiones.
"""
import math
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.schemas.sale_schemas import (
    CommissionSummary,
    FinancingRequest,
    FinancingResult,
    PaginatedSales,
    PaymentCreate,
    SaleCreate,
    SaleFilters,
    SaleListItem,
    SaleOut,
    SaleStatusUpdate,
    SaleUpdate,
    TradeInCreate,
    TradeInUpdate,
)
from app.utils.security import CurrentUser


class SaleService:
    """Servicio del módulo de Ventas."""

    def __init__(self, db: Client):
        self.db = db

    # ──────────────────────────────────────────
    # Calculadora de financiamiento (sistema francés)
    # ──────────────────────────────────────────
    def calculate_financing(self, req: FinancingRequest) -> FinancingResult:
        """
        Calcula las cuotas usando el sistema francés (cuota fija).
        Fórmula: C = P * (r * (1+r)^n) / ((1+r)^n - 1)
        Donde P = capital, r = tasa mensual, n = cuotas
        """
        financed = req.vehicle_price - req.down_payment - req.trade_in_value
        if financed <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El monto financiado debe ser mayor a cero",
            )

        monthly_rate = req.annual_rate / 12 / 100
        n = req.installments
        r = float(monthly_rate)
        P = float(financed)

        if r == 0:
            installment_value = Decimal(str(P / n)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            factor = (1 + r) ** n
            raw_installment = P * (r * factor) / (factor - 1)
            installment_value = Decimal(str(raw_installment)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        total_to_pay = (installment_value * n).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        total_interest = total_to_pay - financed
        cft = (total_interest / financed * 100).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        ) if financed > 0 else Decimal("0")

        return FinancingResult(
            vehicle_price=req.vehicle_price,
            down_payment=req.down_payment,
            trade_in_value=req.trade_in_value,
            financed_amount=financed,
            annual_rate=req.annual_rate,
            monthly_rate=monthly_rate.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP),
            installments=n,
            installment_value=installment_value,
            total_to_pay=total_to_pay,
            total_interest=total_interest,
            cft=cft,
        )

    # ──────────────────────────────────────────
    # Listar ventas
    # ──────────────────────────────────────────
    async def list_sales(
        self,
        filters: SaleFilters,
        current_user: CurrentUser,
    ) -> PaginatedSales:
        query = self.db.table("sales").select(
            "id, sale_number, status, sale_date, operation_type, final_price, created_at, "
            "persons!client_id(first_name, last_name), "
            "vehicles!vehicle_id(brand, model, year, version), "
            "user_profiles!seller_id(full_name)",
            count="exact",
        ).is_("deleted_at", "null")

        # Vendedor ve solo sus ventas
        if current_user.role == "vendedor":
            query = query.eq("seller_id", current_user.id)

        # Filtros
        if filters.status:
            query = query.eq("status", filters.status)
        if filters.operation_type:
            query = query.eq("operation_type", filters.operation_type)
        if filters.seller_id and current_user.role == "admin":
            query = query.eq("seller_id", str(filters.seller_id))
        if filters.date_from:
            query = query.gte("sale_date", filters.date_from.isoformat())
        if filters.date_to:
            query = query.lte("sale_date", filters.date_to.isoformat())
        if filters.search:
            t = filters.search
            query = query.or_(f"sale_number.ilike.%{t}%")

        offset = (filters.page - 1) * filters.per_page
        query = query.order("created_at", desc=True).range(
            offset, offset + filters.per_page - 1
        )

        response = query.execute()
        total = response.count or 0

        items = []
        for row in response.data or []:
            p = row.pop("persons", None) or {}
            v = row.pop("vehicles", None) or {}
            u = row.pop("user_profiles", None) or {}

            # Calcular total pagado
            payments_resp = self.db.table("sale_payments").select(
                "amount, currency"
            ).eq("sale_id", row["id"]).execute()
            total_paid = sum(
                Decimal(str(pay["amount"])) for pay in (payments_resp.data or [])
                if pay.get("currency") == "ARS"
            )

            items.append(SaleListItem(
                id=row["id"],
                sale_number=row["sale_number"],
                status=row["status"],
                sale_date=row["sale_date"],
                client_name=f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or None,
                vehicle_info=f"{v.get('brand', '')} {v.get('model', '')} {v.get('version', '')} {v.get('year', '')}".strip() or None,
                seller_name=u.get("full_name"),
                operation_type=row["operation_type"],
                final_price=Decimal(str(row["final_price"])),
                total_paid=total_paid,
                created_at=row.get("created_at"),
            ))

        return PaginatedSales(
            items=items,
            total=total,
            page=filters.page,
            per_page=filters.per_page,
            pages=math.ceil(total / filters.per_page) if total > 0 else 0,
        )

    # ──────────────────────────────────────────
    # Obtener venta por ID
    # ──────────────────────────────────────────
    async def get_sale(self, sale_id: UUID, current_user: CurrentUser) -> dict:
        response = self.db.table("sales").select(
            "*, "
            "persons!client_id(first_name, last_name), "
            "vehicles!vehicle_id(brand, model, year, version, list_price, cost_price), "
            "user_profiles!seller_id(full_name)"
        ).eq("id", str(sale_id)).is_("deleted_at", "null").single().execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venta no encontrada",
            )

        sale = response.data

        # Vendedor solo ve sus ventas
        if current_user.role == "vendedor" and sale.get("seller_id") != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tenés acceso a esta venta",
            )

        # Enriquecer
        p = sale.pop("persons", None) or {}
        v = sale.pop("vehicles", None) or {}
        u = sale.pop("user_profiles", None) or {}

        sale["client_name"] = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
        sale["vehicle_info"] = f"{v.get('brand', '')} {v.get('model', '')} {v.get('version', '')} {v.get('year', '')}".strip()
        sale["seller_name"] = u.get("full_name")

        # Ocultar cost_price del vehículo si no es admin
        if current_user.role != "admin":
            v.pop("cost_price", None)

        # Pagos vinculados
        payments_resp = self.db.table("sale_payments").select("*").eq(
            "sale_id", str(sale_id)
        ).order("payment_date").execute()
        sale["payments"] = payments_resp.data or []

        # Calcular totales pagados y saldo
        total_paid = sum(
            Decimal(str(pay["amount"])) for pay in sale["payments"]
            if pay.get("currency") == "ARS"
        )
        sale["total_paid"] = str(total_paid)
        sale["balance_due"] = str(Decimal(str(sale["final_price"])) - total_paid)

        # Trade-in info
        if sale.get("trade_in_id"):
            ti_resp = self.db.table("trade_ins").select(
                "brand, model, year, offered_value, accepted"
            ).eq("id", sale["trade_in_id"]).single().execute()
            if ti_resp.data:
                t = ti_resp.data
                sale["trade_in_info"] = f"{t['brand']} {t['model']} {t['year']} — ${t['offered_value']:,.0f}"

        return sale

    # ──────────────────────────────────────────
    # Crear venta
    # ──────────────────────────────────────────
    async def create_sale(self, data: SaleCreate, current_user: CurrentUser) -> dict:
        """Crea una venta nueva en estado 'cotizacion'."""
        # Verificar que el vehículo existe y está disponible
        veh_resp = self.db.table("vehicles").select(
            "status, list_price, cost_price"
        ).eq("id", str(data.vehicle_id)).is_("deleted_at", "null").single().execute()

        if not veh_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehículo no encontrado",
            )

        vehicle = veh_resp.data
        if vehicle["status"] not in ("disponible", "reservado"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El vehículo no está disponible (estado: {vehicle['status']})",
            )

        # Verificar que el cliente existe
        client_resp = self.db.table("persons").select("id").eq(
            "id", str(data.client_id)
        ).single().execute()
        if not client_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente no encontrado",
            )

        final_price = data.sale_price - data.discount

        sale_data = {
            "client_id": str(data.client_id),
            "vehicle_id": str(data.vehicle_id),
            "seller_id": current_user.id,
            "status": "cotizacion",
            "operation_type": data.operation_type,
            "list_price": float(vehicle.get("list_price") or data.sale_price),
            "sale_price": float(data.sale_price),
            "discount": float(data.discount),
            "final_price": float(final_price),
            "observations": data.observations,
        }

        # Financiamiento
        if data.financed_amount:
            sale_data["financed_amount"] = float(data.financed_amount)
        if data.financing_bank:
            sale_data["financing_bank"] = data.financing_bank
        if data.installments:
            sale_data["installments"] = data.installments
        if data.installment_value:
            sale_data["installment_value"] = float(data.installment_value)
        if data.interest_rate:
            sale_data["interest_rate"] = float(data.interest_rate)
        if data.savings_plan_name:
            sale_data["savings_plan_name"] = data.savings_plan_name

        response = self.db.table("sales").insert(sale_data).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear la venta",
            )

        return response.data[0]

    # ──────────────────────────────────────────
    # Actualizar venta
    # ──────────────────────────────────────────
    async def update_sale(
        self, sale_id: UUID, data: SaleUpdate, current_user: CurrentUser
    ) -> dict:
        sale = await self.get_sale(sale_id, current_user)

        if sale["status"] in ("entregada", "cancelada"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede modificar una venta entregada o cancelada",
            )

        update_data = data.model_dump(exclude_none=True)

        # Recalcular final_price si cambian precio o descuento
        sale_price = Decimal(str(update_data.get("sale_price", sale["sale_price"])))
        discount = Decimal(str(update_data.get("discount", sale["discount"])))
        update_data["final_price"] = float(sale_price - discount)

        # Convertir Decimals
        for field in ("sale_price", "discount", "final_price", "financed_amount",
                      "installment_value", "interest_rate"):
            if field in update_data and isinstance(update_data[field], Decimal):
                update_data[field] = float(update_data[field])

        if "delivery_date" in update_data and update_data["delivery_date"]:
            update_data["delivery_date"] = update_data["delivery_date"].isoformat()

        response = self.db.table("sales").update(update_data).eq(
            "id", str(sale_id)
        ).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al actualizar la venta",
            )
        return response.data[0]

    # ──────────────────────────────────────────
    # Cambiar estado de la venta
    # ──────────────────────────────────────────
    async def change_status(
        self,
        sale_id: UUID,
        data: SaleStatusUpdate,
        current_user: CurrentUser,
    ) -> dict:
        """
        Cambia el estado de una venta. Las transiciones válidas son:
        cotizacion → reserva → en_proceso → entregada | cancelada
        La lógica de actualizar el vehículo la hace el trigger en la DB.
        Al entregar: calcula la comisión del vendedor.
        """
        sale = await self.get_sale(sale_id, current_user)
        current_status = sale["status"]

        # Validar transición de estados
        valid_transitions: dict[str, list[str]] = {
            "cotizacion": ["reserva", "cancelada"],
            "reserva": ["en_proceso", "cancelada"],
            "en_proceso": ["entregada", "cancelada"],
            "entregada": [],
            "cancelada": [],
        }
        allowed = valid_transitions.get(current_status, [])
        if data.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Transición inválida: {current_status} → {data.status}. Permitidas: {allowed}",
            )

        # Solo admin puede marcar como entregada
        if data.status == "entregada" and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el admin puede marcar una venta como entregada",
            )

        update_data: dict = {"status": data.status}

        if data.cancellation_reason:
            update_data["cancellation_reason"] = data.cancellation_reason
        if data.delivery_date:
            update_data["delivery_date"] = data.delivery_date.isoformat()
        elif data.status == "entregada":
            update_data["delivery_date"] = date.today().isoformat()

        # Al entregar: calcular comisión
        if data.status == "entregada":
            commission = await self._calculate_commission(sale, current_user)
            if commission is not None:
                update_data["commission_amount"] = float(commission)

        response = self.db.table("sales").update(update_data).eq(
            "id", str(sale_id)
        ).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al cambiar estado de la venta",
            )

        return response.data[0]

    async def _calculate_commission(
        self, sale: dict, current_user: CurrentUser
    ) -> Optional[Decimal]:
        """
        Calcula la comisión del vendedor al cerrar una venta.
        Fórmula: (precio_venta - precio_costo) * % comisión configurado en businesses
        """
        try:
            # Obtener precio de costo del vehículo
            veh_resp = self.db.table("vehicles").select("cost_price").eq(
                "id", sale["vehicle_id"]
            ).single().execute()
            cost_price = veh_resp.data.get("cost_price") if veh_resp.data else None

            if not cost_price:
                return None

            # Obtener % comisión desde la configuración
            biz_resp = self.db.table("businesses").select("commission_pct").limit(1).execute()
            commission_pct = Decimal(str(
                biz_resp.data[0]["commission_pct"] if biz_resp.data else "2.00"
            ))

            margin = Decimal(str(sale["final_price"])) - Decimal(str(cost_price))
            if margin <= 0:
                return Decimal("0")

            return (margin * commission_pct / 100).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        except Exception:
            return None

    # ──────────────────────────────────────────
    # Pagos y señas
    # ──────────────────────────────────────────
    async def add_payment(
        self,
        sale_id: UUID,
        data: PaymentCreate,
        current_user: CurrentUser,
    ) -> dict:
        """Registra un pago o seña vinculado a la venta."""
        sale = await self.get_sale(sale_id, current_user)

        if sale["status"] == "cancelada":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pueden agregar pagos a una venta cancelada",
            )

        payment_data = {
            "sale_id": str(sale_id),
            "payment_type": data.payment_type,
            "amount": float(data.amount),
            "currency": data.currency,
            "payment_method": data.payment_method,
            "payment_date": (data.payment_date or date.today()).isoformat(),
            "registered_by": current_user.id,
        }
        if data.usd_rate:
            payment_data["usd_rate"] = float(data.usd_rate)
        if data.reference:
            payment_data["reference"] = data.reference
        if data.notes:
            payment_data["notes"] = data.notes

        response = self.db.table("sale_payments").insert(payment_data).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al registrar el pago",
            )

        # Si es seña, actualizar estado de cotización → reserva automáticamente
        if data.payment_type == "seña" and sale["status"] == "cotizacion":
            await self.change_status(
                sale_id,
                SaleStatusUpdate(status="reserva"),
                current_user,
            )

        return response.data[0]

    async def list_payments(self, sale_id: UUID, current_user: CurrentUser) -> list[dict]:
        """Lista todos los pagos de una venta."""
        await self.get_sale(sale_id, current_user)
        response = self.db.table("sale_payments").select("*").eq(
            "sale_id", str(sale_id)
        ).order("payment_date").execute()
        return response.data or []

    # ──────────────────────────────────────────
    # Toma de usados (Trade-in)
    # ──────────────────────────────────────────
    async def create_trade_in(
        self,
        sale_id: UUID,
        data: TradeInCreate,
        current_user: CurrentUser,
    ) -> dict:
        """Registra un vehículo usado como parte de pago en una venta."""
        sale = await self.get_sale(sale_id, current_user)

        if sale["status"] in ("entregada", "cancelada"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede agregar una toma de usado a una venta cerrada",
            )

        trade_data = data.model_dump(exclude_none=True)
        trade_data["sale_id"] = str(sale_id)
        for field in ("offered_value", "market_reference"):
            if field in trade_data and isinstance(trade_data[field], Decimal):
                trade_data[field] = float(trade_data[field])

        response = self.db.table("trade_ins").insert(trade_data).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al registrar la toma de usado",
            )

        trade_in = response.data[0]

        # Vincular el trade-in a la venta
        self.db.table("sales").update({"trade_in_id": trade_in["id"]}).eq(
            "id", str(sale_id)
        ).execute()

        return trade_in

    async def accept_trade_in(
        self,
        sale_id: UUID,
        trade_in_id: UUID,
        current_user: CurrentUser,
    ) -> dict:
        """
        Acepta la toma de usado e ingresa el vehículo al stock automáticamente.
        Solo admin puede aceptar.
        """
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el admin puede aceptar una toma de usado",
            )

        ti_resp = self.db.table("trade_ins").select("*").eq(
            "id", str(trade_in_id)
        ).eq("sale_id", str(sale_id)).single().execute()

        if not ti_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Toma de usado no encontrada",
            )

        trade_in = ti_resp.data

        # Ingresar el vehículo al stock como 'usado'
        new_vehicle = {
            "vehicle_type": "usado",
            "status": "disponible",
            "brand": trade_in["brand"],
            "model": trade_in["model"],
            "version": trade_in.get("version"),
            "year": trade_in["year"],
            "color": trade_in.get("color"),
            "plate": trade_in.get("plate"),
            "chassis_number": trade_in.get("chassis_number"),
            "mileage": trade_in.get("mileage"),
            "fuel_type": trade_in.get("fuel_type", "nafta"),
            "transmission": trade_in.get("transmission", "manual"),
            "cost_price": trade_in["offered_value"],   # Precio de costo = lo que se pagó
            "provenance": "Parte de pago",
            "entry_date": date.today().isoformat(),
        }

        veh_resp = self.db.table("vehicles").insert(new_vehicle).execute()
        stock_vehicle_id = veh_resp.data[0]["id"] if veh_resp.data else None

        # Marcar trade-in como aceptado y vincular al vehículo creado
        update_data: dict = {"accepted": True}
        if stock_vehicle_id:
            update_data["stock_vehicle_id"] = stock_vehicle_id

        self.db.table("trade_ins").update(update_data).eq(
            "id", str(trade_in_id)
        ).execute()

        return {
            "message": "Toma de usado aceptada. Vehículo ingresado al stock.",
            "stock_vehicle_id": stock_vehicle_id,
        }

    async def update_trade_in(
        self,
        sale_id: UUID,
        trade_in_id: UUID,
        data: TradeInUpdate,
        current_user: CurrentUser,
    ) -> dict:
        """Actualiza datos de la toma de usado (valuación, notas)."""
        await self.get_sale(sale_id, current_user)

        update_data = data.model_dump(exclude_none=True)
        for field in ("offered_value", "market_reference"):
            if field in update_data and isinstance(update_data[field], Decimal):
                update_data[field] = float(update_data[field])

        response = self.db.table("trade_ins").update(update_data).eq(
            "id", str(trade_in_id)
        ).eq("sale_id", str(sale_id)).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Toma de usado no encontrada",
            )
        return response.data[0]

    # ──────────────────────────────────────────
    # Comisiones
    # ──────────────────────────────────────────
    async def get_commissions(
        self,
        year: int,
        month: int,
        seller_id: Optional[UUID],
        current_user: CurrentUser,
    ) -> list[CommissionSummary]:
        """
        Resumen de comisiones por vendedor en un período.
        Solo admin puede ver todas; vendedor ve solo las suyas.
        """
        date_from = f"{year:04d}-{month:02d}-01"
        if month == 12:
            date_to = f"{year + 1:04d}-01-01"
        else:
            date_to = f"{year:04d}-{month + 1:02d}-01"

        query = self.db.table("sales").select(
            "seller_id, final_price, commission_amount, commission_paid, "
            "user_profiles!seller_id(full_name)"
        ).eq("status", "entregada").gte("sale_date", date_from).lt(
            "sale_date", date_to
        ).is_("deleted_at", "null")

        if current_user.role == "vendedor":
            query = query.eq("seller_id", current_user.id)
        elif seller_id:
            query = query.eq("seller_id", str(seller_id))

        response = query.execute()

        # Agrupar por vendedor
        sellers: dict[str, dict] = {}
        for row in response.data or []:
            sid = row["seller_id"]
            if sid not in sellers:
                profile = row.get("user_profiles") or {}
                sellers[sid] = {
                    "seller_id": sid,
                    "seller_name": profile.get("full_name", "Desconocido"),
                    "period": f"{year:04d}-{month:02d}",
                    "sales_count": 0,
                    "total_revenue": Decimal("0"),
                    "total_commission": Decimal("0"),
                    "commissions_paid": Decimal("0"),
                    "commissions_pending": Decimal("0"),
                }
            s = sellers[sid]
            s["sales_count"] += 1
            s["total_revenue"] += Decimal(str(row["final_price"]))
            comm = Decimal(str(row["commission_amount"] or 0))
            s["total_commission"] += comm
            if row["commission_paid"]:
                s["commissions_paid"] += comm
            else:
                s["commissions_pending"] += comm

        return [CommissionSummary(**v) for v in sellers.values()]

    # ──────────────────────────────────────────
    # Obtener toma de usado de una venta
    # ──────────────────────────────────────────
    async def get_trade_in(self, sale_id: UUID, current_user: CurrentUser) -> dict:
        """Retorna la toma de usado vinculada a una venta."""
        # Verificar acceso a la venta
        await self.get_sale(sale_id, current_user)

        response = self.db.table("trade_ins").select("*").eq(
            "sale_id", str(sale_id)
        ).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Esta venta no tiene toma de usado registrada",
            )
        return response.data[0]

    # ──────────────────────────────────────────
    # Marcar comisión como pagada
    # ──────────────────────────────────────────
    async def mark_commission_paid(self, sale_id: UUID, current_user: CurrentUser) -> dict:
        """Marca la comisión de una venta como pagada al vendedor. Solo admin."""
        response = self.db.table("sales").select("id, commission_paid, status").eq(
            "id", str(sale_id)
        ).is_("deleted_at", "null").execute()

        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")

        sale = response.data[0]
        if sale["status"] != "entregada":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Solo se puede marcar comisión pagada en ventas entregadas",
            )
        if sale["commission_paid"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La comisión de esta venta ya fue marcada como pagada",
            )

        update_resp = self.db.table("sales").update({
            "commission_paid": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", str(sale_id)).execute()

        return {"message": "Comisión marcada como pagada", "sale_id": str(sale_id)}
