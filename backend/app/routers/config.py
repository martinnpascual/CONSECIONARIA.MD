"""
routers/config.py — Configuración de la concesionaria (tabla businesses)

GET  /config     — Obtener configuración actual (cualquier usuario autenticado)
PUT  /config     — Actualizar configuración (solo admin)
"""
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from app.supabase_client import get_supabase_admin
from app.utils.security import CurrentUser, get_current_user, require_admin

router = APIRouter(prefix="/config", tags=["Configuración"])


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────

class BusinessConfig(BaseModel):
    id: Optional[str] = None
    name: str
    legal_name: str
    cuit: str
    iva_condition: str
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    afip_punto_venta: int = 1
    stock_alert_days: int = 90
    commission_pct: float = 2.0
    reservation_days: int = 7
    usd_rate: Optional[float] = None
    usd_rate_updated_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BusinessConfigUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    cuit: Optional[str] = None
    iva_condition: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    afip_punto_venta: Optional[int] = None
    stock_alert_days: Optional[int] = None
    commission_pct: Optional[float] = None
    reservation_days: Optional[int] = None
    usd_rate: Optional[float] = None


# ──────────────────────────────────────────────
# GET /config — Configuración de la concesionaria
# ──────────────────────────────────────────────
@router.get("", response_model=BusinessConfig)
async def get_config(
    _: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_admin),
):
    """Retorna la configuración actual de la concesionaria."""
    response = db.table("businesses").select("*").limit(1).execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada. Inicializar en Supabase.",
        )

    return response.data[0]


# ──────────────────────────────────────────────
# PUT /config — Actualizar configuración (admin)
# ──────────────────────────────────────────────
@router.put("", response_model=BusinessConfig)
async def update_config(
    data: BusinessConfigUpdate,
    _: CurrentUser = Depends(require_admin),
    db: Client = Depends(get_supabase_admin),
):
    """Actualiza la configuración de la concesionaria. Solo admin."""
    # Obtener el ID del registro actual
    current = db.table("businesses").select("id").limit(1).execute()
    if not current.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración no encontrada",
        )

    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay datos para actualizar",
        )

    # Si se actualiza usd_rate, registrar la fecha
    if "usd_rate" in update_data:
        update_data["usd_rate_updated_at"] = datetime.utcnow().isoformat()

    business_id = current.data[0]["id"]
    response = db.table("businesses").update(update_data).eq("id", business_id).execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la configuración",
        )

    return response.data[0]
