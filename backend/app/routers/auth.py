"""
routers/auth.py — Endpoints de autenticación con Supabase Auth

El login/logout real lo maneja el frontend directamente con Supabase JS SDK.
Este router provee endpoints de utilidad: perfil propio, refresh y gestión de usuarios (admin).
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from supabase import Client

from app.supabase_client import get_supabase_admin
from app.utils.security import (
    CurrentUser,
    get_current_user,
    require_admin,
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])


# ──────────────────────────────────────────────
# Schemas locales
# ──────────────────────────────────────────────

class UserProfileOut(BaseModel):
    id: str
    email: str
    role: str
    full_name: Optional[str]
    avatar_url: Optional[str]
    phone: Optional[str]
    is_active: bool


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "vendedor"
    phone: Optional[str] = None


class UpdateUserRoleRequest(BaseModel):
    role: str
    is_active: Optional[bool] = None


# ──────────────────────────────────────────────
# GET /auth/me — Perfil del usuario actual
# ──────────────────────────────────────────────
@router.get("/me", response_model=UserProfileOut)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_admin),
):
    """
    Retorna el perfil completo del usuario autenticado.
    El frontend debe llamar esto al iniciar sesión para obtener el rol.
    """
    response = db.table("user_profiles").select(
        "id, full_name, role, avatar_url, phone, is_active"
    ).eq("id", current_user.id).single().execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil no encontrado",
        )

    return UserProfileOut(
        id=current_user.id,
        email=current_user.email,
        **response.data,
    )


# ──────────────────────────────────────────────
# PUT /auth/me — Actualizar perfil propio
# ──────────────────────────────────────────────
@router.put("/me", response_model=UserProfileOut)
async def update_me(
    data: UserProfileUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_supabase_admin),
):
    """Actualiza el perfil del usuario autenticado."""
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay datos para actualizar",
        )

    response = db.table("user_profiles").update(update_data).eq(
        "id", current_user.id
    ).execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el perfil",
        )

    return await get_me(current_user, db)


# ──────────────────────────────────────────────
# GET /auth/users — Listar usuarios (admin)
# ──────────────────────────────────────────────
@router.get("/users", response_model=list[UserProfileOut])
async def list_users(
    current_user: CurrentUser = Depends(require_admin),
    db: Client = Depends(get_supabase_admin),
):
    """Lista todos los usuarios del sistema. Solo admin."""
    response = db.table("user_profiles").select(
        "id, full_name, role, avatar_url, phone, is_active"
    ).is_("deleted_at", "null").order("full_name").execute()

    # Enriquecer con email de auth.users via admin API
    users = []
    for profile in response.data or []:
        try:
            auth_user = db.auth.admin.get_user_by_id(profile["id"])
            email = auth_user.user.email if auth_user.user else ""
        except Exception:
            email = ""

        users.append(UserProfileOut(
            id=profile["id"],
            email=email,
            full_name=profile.get("full_name"),
            role=profile["role"],
            avatar_url=profile.get("avatar_url"),
            phone=profile.get("phone"),
            is_active=profile.get("is_active", True),
        ))

    return users


# ──────────────────────────────────────────────
# POST /auth/users — Crear usuario (admin)
# ──────────────────────────────────────────────
@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    data: CreateUserRequest,
    current_user: CurrentUser = Depends(require_admin),
    db: Client = Depends(get_supabase_admin),
):
    """
    Crea un nuevo usuario en Supabase Auth y su perfil.
    Solo admin puede crear usuarios.
    """
    allowed_roles = {"admin", "vendedor", "cajero", "mecanico"}
    if data.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rol inválido. Debe ser uno de: {allowed_roles}",
        )

    try:
        # Crear en Supabase Auth
        auth_response = db.auth.admin.create_user({
            "email": data.email,
            "password": data.password,
            "email_confirm": True,  # Confirmar email automáticamente
            "user_metadata": {
                "full_name": data.full_name,
                "role": data.role,
            },
        })

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear el usuario en Auth",
            )

        # El trigger handle_new_user() crea el perfil automáticamente.
        # Actualizar el rol (el trigger pone 'vendedor' por defecto si no viene en metadata)
        db.table("user_profiles").update({
            "role": data.role,
            "phone": data.phone,
        }).eq("id", auth_response.user.id).execute()

        return {
            "message": "Usuario creado correctamente",
            "id": auth_response.user.id,
            "email": data.email,
            "role": data.role,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al crear usuario: {str(e)}",
        )


# ──────────────────────────────────────────────
# PUT /auth/users/{id} — Actualizar rol/estado (admin)
# ──────────────────────────────────────────────
@router.put("/users/{user_id}")
async def update_user_role(
    user_id: UUID,
    data: UpdateUserRoleRequest,
    current_user: CurrentUser = Depends(require_admin),
    db: Client = Depends(get_supabase_admin),
):
    """Actualiza el rol o estado activo de un usuario. Solo admin."""
    if data.role:
        allowed_roles = {"admin", "vendedor", "cajero", "mecanico"}
        if data.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rol inválido: {data.role}",
            )

    # No permitir que el admin se quite el rol admin a sí mismo
    if str(user_id) == current_user.id and data.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No podés cambiar tu propio rol de admin",
        )

    update_data = {}
    if data.role:
        update_data["role"] = data.role
    if data.is_active is not None:
        update_data["is_active"] = data.is_active

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay datos para actualizar",
        )

    response = db.table("user_profiles").update(update_data).eq(
        "id", str(user_id)
    ).execute()

    return {"message": "Usuario actualizado correctamente"}
