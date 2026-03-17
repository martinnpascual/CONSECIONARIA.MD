"""
utils/security.py — Autenticación y autorización via Supabase JWT

Supabase emite JWTs firmados con HS256. El payload incluye:
  - sub: UUID del usuario (auth.uid())
  - role: 'authenticated' (siempre, de Supabase)
  - app_metadata.role: 'admin' | 'vendedor' | 'cajero' | 'mecanico' (custom claim)
  - email, exp, iat, etc.
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import get_settings
from app.supabase_client import supabase_admin

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    """Usuario autenticado extraído del JWT de Supabase."""
    id: str
    email: str
    role: str  # admin | vendedor | cajero | mecanico
    full_name: Optional[str] = None


async def _decode_token(token: str) -> dict:
    """Decodifica y valida el JWT de Supabase."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_aud": False},  # Supabase no usa 'aud' estándar
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> CurrentUser:
    """
    Dependencia FastAPI: extrae y valida el usuario del JWT de Supabase.
    Levanta 401 si el token es inválido o falta.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = await _decode_token(credentials.credentials)

    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sin identificador de usuario",
        )

    # Obtener el rol desde user_profiles en Supabase
    # (más seguro que confiar solo en el claim del token)
    try:
        response = supabase_admin.table("user_profiles").select(
            "id, full_name, role"
        ).eq("id", user_id).eq("is_active", True).is_("deleted_at", "null").single().execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no encontrado o inactivo",
            )

        profile = response.data
        return CurrentUser(
            id=user_id,
            email=payload.get("email", ""),
            role=profile["role"],
            full_name=profile.get("full_name"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al verificar usuario: {str(e)}",
        )


def require_role(*roles: str):
    """
    Factory de dependencias para restringir endpoints por rol.

    Uso:
        @router.get("/admin-only")
        async def endpoint(user = Depends(require_role("admin"))):
            ...

        @router.get("/staff")
        async def endpoint(user = Depends(require_role("admin", "vendedor"))):
            ...
    """
    async def _check_role(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Roles requeridos: {', '.join(roles)}",
            )
        return current_user

    return _check_role


# Dependencias preconfiguradas por rol
require_admin = require_role("admin")
require_admin_or_seller = require_role("admin", "vendedor")
require_admin_or_cashier = require_role("admin", "cajero")
require_mechanic = require_role("admin", "mecanico")
