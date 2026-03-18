# Plan de Tareas + Deploy en Hostinger con Dokploy
> DM Cars — Actualizado: 2026-03-17

---

## Estado Real del Proyecto (Auditoría Completa)

### ✅ TODO implementado y funcional

| Módulo | Frontend | Backend | DB Migration | Estado |
|--------|----------|---------|-------------|--------|
| M01 Stock | StockPage + componentes | vehicles.py | 002_vehicles.sql | ✅ |
| M02 CRM | CRMPage + PersonDetailPage | persons.py | 003_persons_crm.sql | ✅ |
| M03 Ventas | VentasPage | sales.py | 004_sales.sql | ✅ |
| M04 Toma de Usados | UsadosPage + TradeInDrawer | trade_ins.py | 004_sales.sql | ✅ |
| M05 Taller | TallerPage + WorkOrderDrawer | work_orders.py | 005_work_orders.sql | ✅ |
| M06 Caja | CajaPage + paneles | cash.py | 006_cash.sql | ✅ |
| M07 Consignaciones | ConsignPage + Drawer | consignments.py | 007_consignments.sql | ✅ |
| M08 PDF | DocumentosPage | pdfs.py | 010_documents.sql | ✅ |
| M09 AFIP | EmitirFacturaModal | invoices.py | 008_invoices.sql | ✅ testing |
| M10 Dashboard | DashboardPage (Realtime) | — (Supabase directo) | — | ✅ |
| M11 Config | ConfigPage (2 tabs) | config.py + auth.py | 001_init.sql | ✅ |

### Routers backend (main.py) — 12 activos
`auth`, `vehicles`, `persons`, `sales`, `work_orders`, `cash`, `consignments`, `invoices`, `pdfs`, `config`, `trade_ins` + health check

### Frontend — 10 rutas lazy-loaded
`/dashboard`, `/stock`, `/crm`, `/ventas`, `/taller`, `/caja`, `/consignaciones`, `/documentos`, `/usados`, `/configuracion`

---

## Tareas Pendientes — Prioridad y Secuencia

### 🔴 CRÍTICAS — Antes del deploy

| # | Tarea | Archivo | Detalle |
|---|-------|---------|---------|
| T-01 | Crear `docker-compose.prod.yml` | raíz del proyecto | El actual tiene volúmenes de dev (`./frontend:/app`) — no apto para producción |
| T-02 | Ejecutar migraciones en Supabase | Supabase SQL Editor | Correr 001→010 en orden |
| T-03 | Insertar seed de `businesses` | Supabase SQL Editor | `001_seed_data.sql` (solo la parte de DM Cars) |
| T-04 | Crear `.env.production` | raíz del proyecto | Con todas las variables de producción |
| T-05 | Agregar `vercel.json` (si se usa Vercel) o configurar nginx proxy | `frontend/` | SPA routing |
| T-06 | Configurar CORS en `settings.py` | `backend/app/config.py` | Agregar dominio de producción |

### 🟡 IMPORTANTES — Primera semana post-deploy

| # | Tarea | Detalle |
|---|-------|---------|
| T-07 | Tests básicos backend | Crear `tests/test_health.py`, `test_auth.py`, `test_vehicles.py` |
| T-08 | Error boundaries React | Envolver `<App>` y rutas críticas |
| T-09 | Migración 011: `trade_ins` RLS policies | Verificar que las RLS de `009` cubren correctamente `trade_ins` |
| T-10 | AFIP Producción | Descomentar `pyafipws`, montar `.crt`+`.key`, cambiar `AFIP_TESTING=false` |
| T-11 | Multiple workers uvicorn | Cambiar CMD en Dockerfile backend |
| T-12 | Logging estructurado | Agregar JSON logging para Dokploy/Hostinger |

### 🟢 MEJORAS — Cuando el sistema esté estable

| # | Tarea | Detalle |
|---|-------|---------|
| T-13 | Logo y personalización | Subir logo de DM Cars a Supabase Storage, mostrar en header |
| T-14 | Exportar reportes Excel | Endpoint `/api/v1/reports/excel` usando `openpyxl` (ya en requirements) |
| T-15 | Notificaciones push | Cuando un lead pasa de estado o una OT está lista |
| T-16 | Backup automático | Script bash + cron en el VPS |

---

## Deploy en Hostinger con Dokploy

### ¿Qué es Dokploy?

Dokploy es un **PaaS open-source autohosteado** (alternativa gratuita a Railway/Render). Se instala en cualquier VPS en 1 comando y ofrece:
- Deploy desde GitHub con webhooks automáticos
- Soporte para Docker Compose
- Panel web con logs en tiempo real
- Gestión de variables de entorno
- Certificados SSL automáticos (Let's Encrypt)
- Dominio personalizado con reverse proxy nginx

**Costo total:** solo el VPS (~$4-7/mes en Hostinger)

---

### PASO 1 — VPS en Hostinger

**Recomendación:** Plan KVM2 o superior
- RAM mínima: **2 GB** (Dokploy + backend + frontend)
- SO: **Ubuntu 22.04 LTS**
- Costo: ~$5.99/mes

1. Ir a [hostinger.com](https://hostinger.com) → VPS → Seleccionar Ubuntu 22.04
2. Anotar la IP pública del servidor (ej: `45.87.210.123`)
3. Acceder por SSH:
```bash
ssh root@45.87.210.123
```

---

### PASO 2 — Instalar Dokploy en el VPS

```bash
# En el servidor, como root:
curl -sSL https://dokploy.com/install.sh | sh
```

Dokploy instala automáticamente: Docker, Docker Compose, nginx, Certbot, y el panel web.

Después de la instalación, el panel estará disponible en:
```
http://45.87.210.123:3000
```

**Primera vez:** crear usuario admin en el panel.

---

### PASO 3 — DNS del dominio

En el panel de Hostinger → Dominios → DNS de `dmcars.com.ar`, agregar:

| Tipo | Nombre | Valor |
|------|--------|-------|
| A | `app` | `45.87.210.123` |
| A | `api` | `45.87.210.123` |
| A | `dokploy` | `45.87.210.123` (panel admin, opcional) |

Esperar propagación DNS (5-60 minutos).

---

### PASO 4 — Conectar GitHub en Dokploy

1. En Dokploy → Settings → Git Providers → Add GitHub
2. Autorizar con OAuth → seleccionar el repo `martinnpascual/CONSECIONARIA.MD`
3. Dokploy podrá hacer deploy automático en cada `git push`

---

### PASO 5 — Crear `docker-compose.prod.yml`

Este archivo es diferente al de desarrollo: sin volúmenes de código fuente (para no sobreescribir los archivos del build).

Crear en la raíz del proyecto:

```yaml
# docker-compose.prod.yml — PRODUCCIÓN
# No tiene volúmenes de código ni hot-reload
version: '3.8'

services:

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: dmcars-backend
    restart: unless-stopped
    environment:
      APP_ENV: production
      DEBUG: "false"
      PORT: "8000"
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
      JWT_SECRET: ${JWT_SECRET}
      MRBOT_EMAIL: ${MRBOT_EMAIL}
      MRBOT_API_KEY: ${MRBOT_API_KEY}
      AFIP_CUIT: ${AFIP_CUIT}
      AFIP_PUNTO_VENTA: ${AFIP_PUNTO_VENTA:-1}
      AFIP_TESTING: ${AFIP_TESTING:-true}
      FRONTEND_URL: ${FRONTEND_URL}
      CORS_ORIGINS: ${CORS_ORIGINS}
    # Los certs AFIP se copian manualmente al servidor, no se suben al repo
    volumes:
      - /opt/dmcars/certs:/app/app/certs:ro
    expose:
      - "8000"
    networks:
      - dmcars-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: production          # Multi-stage: usa el stage 'production' con nginx
      args:
        VITE_API_URL: ${VITE_API_URL}
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
        VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY}
    container_name: dmcars-frontend
    restart: unless-stopped
    expose:
      - "80"
    networks:
      - dmcars-network
    depends_on:
      backend:
        condition: service_healthy

networks:
  dmcars-network:
    driver: bridge
```

> ⚠️ **Nota importante:** Las variables `VITE_*` deben pasarse como `build args` porque Vite las embebe en el JavaScript en tiempo de build. Por eso el Dockerfile del frontend necesita recibirlas como ARG.

**Actualizar `frontend/Dockerfile`** — agregar ARG en el stage de build:

```dockerfile
FROM deps AS builder
# Recibir variables de build para Vite
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
COPY . .
RUN npm run build
```

---

### PASO 6 — Configurar el proyecto en Dokploy

En el panel de Dokploy:

1. **New Project** → "DM Cars"
2. **New Service → Docker Compose**
3. Seleccionar repo GitHub → branch `main`
4. **Compose file:** `docker-compose.prod.yml`
5. En la sección **Environment Variables**, agregar todas las vars:

```env
# Supabase
SUPABASE_URL=https://ptrlwiryknnwyazdphjw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
VITE_SUPABASE_URL=https://ptrlwiryknnwyazdphjw.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui

# Backend
JWT_SECRET=genera_uno_con_openssl_rand_hex_32
FRONTEND_URL=https://app.dmcars.com.ar
CORS_ORIGINS=https://app.dmcars.com.ar

# Vite (build time)
VITE_API_URL=https://api.dmcars.com.ar/api/v1

# AFIP (dejar testing=true hasta tener los certs)
AFIP_CUIT=30-XXXXXXXX-X
AFIP_PUNTO_VENTA=1
AFIP_TESTING=true

# MrBot
MRBOT_EMAIL=tu@email.com
MRBOT_API_KEY=tu_mrbot_key
```

---

### PASO 7 — Configurar dominios en Dokploy

En el panel → servicio → Domains:

**Para el backend:**
- Domain: `api.dmcars.com.ar`
- Port: `8000`
- HTTPS: ✅ (Dokploy usa Let's Encrypt automáticamente)
- Path: `/`

**Para el frontend:**
- Domain: `app.dmcars.com.ar`
- Port: `80`
- HTTPS: ✅
- Path: `/`

Dokploy configura nginx automáticamente como reverse proxy con SSL.

---

### PASO 8 — Primer Deploy

En Dokploy → Deploy → el sistema:
1. Hace `git clone` del repo
2. Ejecuta `docker-compose -f docker-compose.prod.yml build`
3. Levanta los contenedores
4. Configura nginx + SSL

Ver logs en tiempo real desde el panel.

---

### PASO 9 — Ejecutar migraciones en Supabase

Antes de usar la app, ejecutar las migraciones en Supabase:

1. Ir a [supabase.com](https://supabase.com) → tu proyecto → SQL Editor
2. Ejecutar los archivos en orden:
   ```
   001_init.sql
   002_vehicles.sql
   003_persons_crm.sql
   004_sales.sql
   005_work_orders.sql
   006_cash.sql
   007_consignments.sql
   008_invoices.sql
   009_rls_policies.sql
   010_documents.sql
   ```
3. Ejecutar seed (solo una vez):
   ```
   001_seed_data.sql  ← solo la sección de businesses (las demás son datos de prueba)
   ```

---

### PASO 10 — Verificación post-deploy

```bash
# Test del backend
curl https://api.dmcars.com.ar/health
# Esperado: {"status":"ok","app":"DM Cars API","version":"0.6.0","env":"production"}

# Test de la app
# Abrir https://app.dmcars.com.ar en el navegador
# Debería mostrar la pantalla de login
```

---

## Diagrama de Arquitectura Final

```
┌─────────────────────────────────────────────────────────────┐
│                    HOSTINGER VPS (Ubuntu 22.04)              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Dokploy (puerto 3000)               │   │
│  │  • Panel admin        • Deploy desde GitHub          │   │
│  │  • Gestión de env     • nginx reverse proxy          │   │
│  │  • SSL automático     • Logs en tiempo real          │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│         ┌──────────────────┼──────────────────┐            │
│         ▼                                     ▼            │
│  ┌─────────────────┐              ┌───────────────────┐    │
│  │  dmcars-backend │              │  dmcars-frontend  │    │
│  │  FastAPI:8000   │◄────────────►│  nginx:80         │    │
│  │                 │              │  React SPA        │    │
│  └────────┬────────┘              └───────────────────┘    │
│           │                                                 │
└───────────┼─────────────────────────────────────────────────┘
            │ HTTPS
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Cloud (ya existe)                      │
│  • PostgreSQL (DB + RLS)  • Auth (JWT)                      │
│  • Storage (fotos)        • Realtime (dashboard)            │
└─────────────────────────────────────────────────────────────┘

DNS:
  app.dmcars.com.ar  ──► VPS IP (frontend nginx→React)
  api.dmcars.com.ar  ──► VPS IP (nginx→FastAPI:8000)
```

---

## Checklist de Go-Live

```
FASE 1 — Preparación (local)
[ ] Crear docker-compose.prod.yml
[ ] Actualizar frontend/Dockerfile con ARG para VITE_*
[ ] Agregar CORS_ORIGINS a backend/app/config.py
[ ] Commit y push a GitHub (main branch)

FASE 2 — Infraestructura
[ ] Contratar VPS Hostinger (Ubuntu 22.04, mín 2GB RAM)
[ ] Instalar Dokploy: curl -sSL https://dokploy.com/install.sh | sh
[ ] Configurar DNS: app.* y api.* apuntando a IP del VPS

FASE 3 — Configuración Dokploy
[ ] Conectar cuenta GitHub
[ ] Crear proyecto "DM Cars" → Docker Compose
[ ] Cargar todas las variables de entorno
[ ] Configurar dominios + SSL

FASE 4 — Base de datos
[ ] Ejecutar las 10 migraciones en Supabase SQL Editor en orden
[ ] Ejecutar seed de businesses (datos de la concesionaria)
[ ] Verificar RLS activo en todas las tablas

FASE 5 — Deploy y verificación
[ ] Deploy inicial desde Dokploy
[ ] Verificar /health del backend
[ ] Verificar app.dmcars.com.ar abre correctamente
[ ] Login con usuario admin
[ ] Test manual: crear vehículo → generar PDF → emitir factura (testing)

FASE 6 — Post go-live
[ ] Configurar webhook de GitHub para auto-deploy en push
[ ] Activar AFIP producción (cuando tenga los certificados)
[ ] Configurar backup automático de Supabase
```

---

## Variables de Entorno Completas (`.env.production`)

```bash
# ── App ────────────────────────────────────────
APP_ENV=production
DEBUG=false

# ── Supabase ───────────────────────────────────
SUPABASE_URL=https://ptrlwiryknnwyazdphjw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=COMPLETAR
VITE_SUPABASE_URL=https://ptrlwiryknnwyazdphjw.supabase.co
VITE_SUPABASE_ANON_KEY=COMPLETAR

# ── Auth ───────────────────────────────────────
JWT_SECRET=GENERAR_CON_openssl_rand_hex_32

# ── URLs ───────────────────────────────────────
VITE_API_URL=https://api.dmcars.com.ar/api/v1
FRONTEND_URL=https://app.dmcars.com.ar
CORS_ORIGINS=https://app.dmcars.com.ar

# ── AFIP / MrBot ──────────────────────────────
AFIP_CUIT=COMPLETAR
AFIP_PUNTO_VENTA=1
AFIP_TESTING=true
MRBOT_EMAIL=COMPLETAR
MRBOT_API_KEY=COMPLETAR
```

> 🔐 **NUNCA subir este archivo al repositorio.** Añadir `.env.production` al `.gitignore`.
