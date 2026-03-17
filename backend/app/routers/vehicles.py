"""
routers/vehicles.py — Endpoints del módulo de Stock de Vehículos

Los routers SOLO coordinan request/response y delegan al service.
Ninguna lógica de negocio aquí.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from supabase import Client

from app.schemas.vehicle_schemas import (
    PaginatedVehicles,
    VehicleAdmin,
    VehicleCreate,
    VehicleFilters,
    VehiclePublic,
    VehicleUpdate,
)
from app.services.vehicle_service import VehicleService
from app.supabase_client import get_supabase_admin
from app.utils.security import (
    CurrentUser,
    get_current_user,
    require_admin,
    require_admin_or_seller,
)

router = APIRouter(prefix="/vehicles", tags=["Stock de Vehículos"])


def get_vehicle_service(db: Client = Depends(get_supabase_admin)) -> VehicleService:
    return VehicleService(db)


# ──────────────────────────────────────────────
# GET /vehicles — Listar con filtros
# ──────────────────────────────────────────────
@router.get("", response_model=PaginatedVehicles)
async def list_vehicles(
    search: Optional[str] = Query(default=None, description="Búsqueda por marca, modelo, versión, patente"),
    vehicle_type: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    brand: Optional[str] = Query(default=None),
    model: Optional[str] = Query(default=None),
    fuel_type: Optional[str] = Query(default=None),
    transmission: Optional[str] = Query(default=None),
    year_from: Optional[int] = Query(default=None),
    year_to: Optional[int] = Query(default=None),
    price_from: Optional[float] = Query(default=None),
    price_to: Optional[float] = Query(default=None),
    location: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    service: VehicleService = Depends(get_vehicle_service),
):
    """
    Lista vehículos con filtros opcionales y paginación.
    Todos los roles autenticados pueden listar.
    """
    filters = VehicleFilters(
        search=search,
        vehicle_type=vehicle_type,
        status=status_filter,
        brand=brand,
        model=model,
        fuel_type=fuel_type,
        transmission=transmission,
        year_from=year_from,
        year_to=year_to,
        price_from=price_from,
        price_to=price_to,
        location=location,
        page=page,
        per_page=per_page,
    )
    return await service.list_vehicles(filters, current_user)


# ──────────────────────────────────────────────
# GET /vehicles/stale — Vehículos con alta antigüedad
# ──────────────────────────────────────────────
@router.get("/stale", response_model=list[dict])
async def get_stale_vehicles(
    days: int = Query(default=90, ge=1, description="Umbral de días en stock"),
    current_user: CurrentUser = Depends(require_admin),
    service: VehicleService = Depends(get_vehicle_service),
):
    """
    Lista vehículos con más de N días en stock sin vender.
    Solo admin.
    """
    return await service.get_stale_vehicles(days)


# ──────────────────────────────────────────────
# GET /vehicles/{id} — Detalle de vehículo
# ──────────────────────────────────────────────
@router.get("/{vehicle_id}")
async def get_vehicle(
    vehicle_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: VehicleService = Depends(get_vehicle_service),
):
    """
    Retorna el detalle completo de un vehículo.
    Admin: ve precio de costo. Otros roles: no.
    """
    vehicle = await service.get_vehicle(vehicle_id, current_user)
    return vehicle


# ──────────────────────────────────────────────
# POST /vehicles — Crear vehículo
# ──────────────────────────────────────────────
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    data: VehicleCreate,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: VehicleService = Depends(get_vehicle_service),
):
    """
    Crea un nuevo vehículo en el stock.
    Admin y vendedor pueden crear. Solo admin puede setear precio de costo.
    """
    return await service.create_vehicle(data, current_user)


# ──────────────────────────────────────────────
# PUT /vehicles/{id} — Actualizar vehículo
# ──────────────────────────────────────────────
@router.put("/{vehicle_id}")
async def update_vehicle(
    vehicle_id: UUID,
    data: VehicleUpdate,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: VehicleService = Depends(get_vehicle_service),
):
    """
    Actualiza datos de un vehículo.
    Solo admin puede modificar precio de costo.
    """
    return await service.update_vehicle(vehicle_id, data, current_user)


# ──────────────────────────────────────────────
# DELETE /vehicles/{id} — Soft delete
# ──────────────────────────────────────────────
@router.delete("/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    service: VehicleService = Depends(get_vehicle_service),
):
    """Soft delete: solo admin puede dar de baja vehículos."""
    return await service.delete_vehicle(vehicle_id, current_user)


# ──────────────────────────────────────────────
# POST /vehicles/{id}/reserve — Reservar vehículo
# ──────────────────────────────────────────────
@router.post("/{vehicle_id}/reserve")
async def reserve_vehicle(
    vehicle_id: UUID,
    sale_id: UUID,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: VehicleService = Depends(get_vehicle_service),
):
    """
    Reserva un vehículo para una venta específica.
    El vehículo debe estar en estado 'disponible'.
    """
    return await service.reserve_vehicle(vehicle_id, sale_id, current_user)


# ──────────────────────────────────────────────
# GET /vehicles/{id}/photos — Listar fotos
# ──────────────────────────────────────────────
@router.get("/{vehicle_id}/photos", response_model=list[dict])
async def get_photos(
    vehicle_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: VehicleService = Depends(get_vehicle_service),
):
    """Lista todas las fotos de un vehículo."""
    return await service.get_vehicle_photos(vehicle_id)


# ──────────────────────────────────────────────
# POST /vehicles/{id}/photos — Subir foto
# ──────────────────────────────────────────────
@router.post("/{vehicle_id}/photos", status_code=status.HTTP_201_CREATED)
async def upload_photo(
    vehicle_id: UUID,
    file: UploadFile = File(...),
    is_main: bool = Form(default=False),
    sort_order: int = Form(default=0),
    current_user: CurrentUser = Depends(require_admin_or_seller),
    db: Client = Depends(get_supabase_admin),
    service: VehicleService = Depends(get_vehicle_service),
):
    """
    Sube una foto al bucket vehicle-photos de Supabase Storage
    y registra el registro en vehicle_photos.
    Máximo 10 MB por foto. Formatos: jpg, png, webp.
    """
    import uuid

    # Validar tipo de archivo
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/heic"}
    if file.content_type not in allowed_types:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato no soportado. Use: {allowed_types}",
        )

    # Leer contenido
    content = await file.read()

    # Validar tamaño (10 MB máx)
    if len(content) > 10 * 1024 * 1024:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La foto no puede superar 10 MB",
        )

    # Determinar extensión
    ext_map = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/heic": "heic",
    }
    ext = ext_map.get(file.content_type, "jpg")
    photo_id = str(uuid.uuid4())
    storage_path = f"{vehicle_id}/{photo_id}.{ext}"

    # Subir a Supabase Storage
    db.storage.from_("vehicle-photos").upload(
        path=storage_path,
        file=content,
        file_options={"content-type": file.content_type},
    )

    # Obtener URL pública
    public_url = db.storage.from_("vehicle-photos").get_public_url(storage_path)

    # Registrar en DB
    return await service.add_vehicle_photo(
        vehicle_id=vehicle_id,
        url=public_url,
        storage_path=storage_path,
        is_main=is_main,
        sort_order=sort_order,
    )


# ──────────────────────────────────────────────
# DELETE /vehicles/{id}/photos/{photo_id}
# ──────────────────────────────────────────────
@router.delete("/{vehicle_id}/photos/{photo_id}")
async def delete_photo(
    vehicle_id: UUID,
    photo_id: UUID,
    current_user: CurrentUser = Depends(require_admin_or_seller),
    service: VehicleService = Depends(get_vehicle_service),
):
    """Elimina una foto del vehículo (de Storage y de la DB)."""
    return await service.delete_vehicle_photo(vehicle_id, photo_id)


# ──────────────────────────────────────────────
# GET /vehicles/{id}/price-history
# ──────────────────────────────────────────────
@router.get("/{vehicle_id}/price-history", response_model=list[dict])
async def get_price_history(
    vehicle_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    service: VehicleService = Depends(get_vehicle_service),
):
    """Historial de cambios de precio. Solo admin."""
    return await service.get_price_history(vehicle_id)
