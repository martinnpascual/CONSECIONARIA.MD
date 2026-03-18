"""
config.py — Configuración central de la aplicación
Todas las variables se leen desde .env (nunca hardcodeadas)
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────
    app_name: str = "DM Cars"
    app_env: str = "development"
    debug: bool = False
    port: int = 8000
    frontend_url: str = "http://localhost:5173"

    # ── Supabase ─────────────────────────────────
    supabase_url: str
    supabase_anon_key: str = ""   # El backend usa service_role; anon solo en frontend
    supabase_service_role_key: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"

    # ── MrBot / ARCA ─────────────────────────────
    mrbot_email: str = ""
    mrbot_api_key: str = ""
    afip_cuit: str = ""
    afip_punto_venta: int = 1
    afip_testing: bool = True
    afip_cert_path: str = "./app/certs/cert.crt"
    afip_key_path: str = "./app/certs/private.key"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origins(self) -> list[str]:
        origins = [self.frontend_url]
        if not self.is_production:
            origins += [
                "http://localhost:5173",
                "http://localhost:3000",
                "http://127.0.0.1:5173",
            ]
        return origins


@lru_cache
def get_settings() -> Settings:
    """Retorna la instancia singleton de configuración (cacheada)."""
    return Settings()
