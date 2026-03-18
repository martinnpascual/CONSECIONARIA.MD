"""
main.py — Entry point de la API FastAPI de DM Cars

Registra todos los routers, configura CORS y middlewares.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.config import get_settings
from app.routers import auth, vehicles, persons, sales, work_orders, cash, consignments, invoices, pdfs, config, trade_ins

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida de la aplicación."""
    print(f"🚗 DM Cars API iniciando — entorno: {settings.app_env}")
    yield
    print("🛑 DM Cars API deteniéndose")


# ──────────────────────────────────────────────
# Instancia principal de la aplicación
# ──────────────────────────────────────────────
app = FastAPI(
    title="DM Cars API",
    description="Sistema de Gestión para Concesionaria DM Cars — Dante Mostajo",
    version="0.6.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# ──────────────────────────────────────────────
# Middlewares
# ──────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=[
            "dmcars.com.ar", "*.dmcars.com.ar",
            "copitohelados.online", "*.copitohelados.online",
            "localhost",
        ],
    )

# ──────────────────────────────────────────────
# Registrar routers
# ──────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(vehicles.router, prefix=API_PREFIX)
app.include_router(persons.router, prefix=API_PREFIX)
app.include_router(sales.router, prefix=API_PREFIX)
app.include_router(work_orders.router, prefix=API_PREFIX)
app.include_router(cash.router, prefix=API_PREFIX)
app.include_router(consignments.router, prefix=API_PREFIX)
app.include_router(invoices.router, prefix=API_PREFIX)
app.include_router(pdfs.router, prefix=API_PREFIX)
app.include_router(config.router, prefix=API_PREFIX)
app.include_router(trade_ins.router, prefix=API_PREFIX)

# Los siguientes routers se agregarán en sesión S-07 (Frontend):
# app.include_router(reports.router, prefix=API_PREFIX)
# app.include_router(dashboard.router, prefix=API_PREFIX)


# ──────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────
@app.get("/health", tags=["Sistema"])
async def health_check():
    """Endpoint de salud para Docker healthcheck y monitoreo."""
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": "0.6.0",
        "env": settings.app_env,
    }


@app.get("/", tags=["Sistema"])
async def root():
    """Información básica de la API."""
    return {
        "app": "DM Cars API",
        "version": "0.6.0",
        "docs": "/docs",
    }
