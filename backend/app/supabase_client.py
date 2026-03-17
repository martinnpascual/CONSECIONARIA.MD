"""
supabase_client.py — Clientes de Supabase para el backend

IMPORTANTE:
- `supabase_admin` usa el SERVICE_ROLE key → acceso total, bypasea RLS.
  Usar SOLO en el backend. NUNCA exponer al frontend.
- `supabase_anon` usa el ANON key → respeta RLS.
  Útil para operaciones donde queremos que se aplique RLS desde el backend.
"""
from supabase import create_client, Client
from app.config import get_settings

_settings = get_settings()

# Cliente con service_role: para operaciones del backend (escribe, lee todo)
supabase_admin: Client = create_client(
    _settings.supabase_url,
    _settings.supabase_service_role_key,
)

# Cliente con anon key: para operaciones donde aplica RLS
supabase_anon: Client = create_client(
    _settings.supabase_url,
    _settings.supabase_anon_key,
)


def get_supabase_admin() -> Client:
    """Dependencia FastAPI: cliente Supabase con privilegios de admin (service role)."""
    return supabase_admin


def get_supabase_user(token: str) -> Client:
    """
    Retorna un cliente Supabase autenticado como el usuario con el token dado.
    Las queries respetan el RLS según el rol del usuario.
    """
    client = create_client(_settings.supabase_url, _settings.supabase_anon_key)
    client.auth.set_session(token, "")
    return client
