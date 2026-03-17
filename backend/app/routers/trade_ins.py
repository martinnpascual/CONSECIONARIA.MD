"""
routers/trade_ins.py — Toma de usados (parte de pago en ventas)

GET  /trade-ins              - Listar (filtro por sale_id opcional)
POST /trade-ins              - Crear toma de usado
GET  /trade-ins/{id}         - Detalle
PUT  /trade-ins/{id}         - Actualizar datos / valuación
POST /trade-ins/{id}/accept  - Aceptar e ingresar al stock
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase import Client

from app.supabase_client import get_supabase_admin
from app.utils.security import CurrentUser, get_current_user

router = APIRouter(prefix="/trade-ins", tags=["Toma de Usados"])


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────

class TradeInCreate(BaseModel):
    sale_id: str
    brand: str
    model: str
    version: Optional[str] = None
    year: int
    color: Optional[str] = None
    plate: Optional[str] = None
    chassis_number: Optional[str] = None
    mileage: Optional[int] = None
    fuel_type: str = "nafta"
    transmission: str = "manual"
    general_condition: str = "bueno"
    mechanical_notes: Optional[str] = None
    cosmetic_notes: Optional[str] = None
    market_reference: Optional[float] = None
    offered_value: float
    notes: Optional[str] = None


class TradeInUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    version: Optional[str] = None
    year: Optional[int] = None
    color: Optional[str] = None
    plate: Optional[str] = None
    chassis_number: Optional[str] = None
    mileage: Optional[int] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    general_condition: Optional[str] = None
    mechanical_notes: Optional[str] = None
    cosmetic_notes: Optional[str] = None
    market_reference: Optional[float] = None
    offered_value: Optional[float] = None
    notes: Optional[str] = None


# ──────────────────────────────────────────────
# GET /trade-ins
# ──────────────────────────────────────────────
@router.get("")
async def list_trade_ins(
    sale_id: Optional[str] = Query(None),
    accepted: Optional[bool] = Query(None),
    _: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_admin),
):
    query = db.table("trade_ins").select(
        "*, sales(sale_number, client_id)"
    ).order("created_at", desc=True)

    if sale_id:
        query = query.eq("sale_id", sale_id)
    if accepted is not None:
        query = query.eq("accepted", accepted)

    response = query.execute()
    return response.data or []


# ──────────────────────────────────────────────
# POST /trade-ins
# ──────────────────────────────────────────────
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_trade_in(
    data: TradeInCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_admin),
):
    # Validar que la venta existe
    sale_check = db.table("sales").select("id, status").eq("id", data.sale_id).single().execute()
    if not sale_check.data:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if sale_check.data["status"] in ("entregada", "cancelada"):
        raise HTTPException(status_code=400, detail="No se puede agregar un usado a una venta entregada o cancelada")

    payload = data.model_dump()
    response = db.table("trade_ins").insert(payload).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Error al crear la toma de usado")

    # Actualizar FK en la venta
    db.table("sales").update({"trade_in_id": response.data[0]["id"]}).eq("id", data.sale_id).execute()

    return response.data[0]


# ──────────────────────────────────────────────
# GET /trade-ins/{id}
# ──────────────────────────────────────────────
@router.get("/{trade_in_id}")
async def get_trade_in(
    trade_in_id: UUID,
    _: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_admin),
):
    response = db.table("trade_ins").select(
        "*, sales(sale_number, sale_date)"
    ).eq("id", str(trade_in_id)).single().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Toma de usado no encontrada")

    return response.data


# ──────────────────────────────────────────────
# PUT /trade-ins/{id}
# ──────────────────────────────────────────────
@router.put("/{trade_in_id}")
async def update_trade_in(
    trade_in_id: UUID,
    data: TradeInUpdate,
    _: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_admin),
):
    current = db.table("trade_ins").select("id, accepted").eq("id", str(trade_in_id)).single().execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Toma de usado no encontrada")
    if current.data["accepted"]:
        raise HTTPException(status_code=400, detail="No se puede modificar un usado ya aceptado")

    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Sin datos para actualizar")

    response = db.table("trade_ins").update(update_data).eq("id", str(trade_in_id)).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Error al actualizar")

    return response.data[0]


# ──────────────────────────────────────────────
# POST /trade-ins/{id}/accept
# Acepta el usado e ingresa al stock como vehículo "usado"
# ──────────────────────────────────────────────
@router.post("/{trade_in_id}/accept")
async def accept_trade_in(
    trade_in_id: UUID,
    _: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_admin),
):
    trade = db.table("trade_ins").select("*").eq("id", str(trade_in_id)).single().execute()
    if not trade.data:
        raise HTTPException(status_code=404, detail="Toma de usado no encontrada")

    t = trade.data
    if t["accepted"]:
        raise HTTPException(status_code=400, detail="El usado ya fue aceptado")

    # Crear vehículo en stock como "usado"
    vehicle_payload = {
        "vehicle_type": "usado",
        "brand":        t["brand"],
        "model":        t["model"],
        "version":      t.get("version"),
        "year":         t["year"],
        "color":        t.get("color"),
        "plate":        t.get("plate"),
        "chassis_number": t.get("chassis_number"),
        "mileage":      t.get("mileage", 0),
        "fuel_type":    t.get("fuel_type", "nafta"),
        "transmission": t.get("transmission", "manual"),
        "list_price":   t["offered_value"],
        "cost_price":   t["offered_value"],
        "min_price":    t["offered_value"],
        "status":       "disponible",
        "origin":       "Toma de usado — venta",
    }

    vehicle_response = db.table("vehicles").insert(vehicle_payload).execute()
    if not vehicle_response.data:
        raise HTTPException(status_code=500, detail="Error al crear el vehículo en stock")

    vehicle_id = vehicle_response.data[0]["id"]

    # Marcar trade-in como aceptado y vincularlo al vehículo creado
    db.table("trade_ins").update({
        "accepted": True,
        "stock_vehicle_id": vehicle_id,
    }).eq("id", str(trade_in_id)).execute()

    return {
        "message": "Usado aceptado e ingresado al stock",
        "vehicle_id": vehicle_id,
    }
