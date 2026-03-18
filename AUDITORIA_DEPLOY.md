# Auditoría DM Cars — Estado del Proyecto + Guía de Deploy
> Generado: 2026-03-17

---

## 1. Estado del Sistema — ¿En qué etapa estamos?

El sistema está **esencialmente completo** a nivel funcional. Los 11 módulos del PRD tienen código en frontend y backend. El proyecto se encuentra en estado **"Feature Complete — Pre-producción"**.

### Módulos y estado real

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| M01 | Stock de Vehículos | ✅ Completo |
| M02 | CRM — Clientes y Leads | ✅ Completo |
| M03 | Proceso de Ventas | ✅ Completo |
| M04 | Toma de Usados | ✅ Integrado en M03 |
| M05 | Taller / Posventa | ✅ Completo |
| M06 | Caja y Financiero | ✅ Completo (bug corregido hoy) |
| M07 | Consignaciones | ✅ Completo |
| M08 | Documentos PDF | ✅ Completo (WeasyPrint) |
| M09 | Facturación ARCA | ✅ Modo testing — listo para producción con credenciales AFIP |
| M10 | Dashboard y Reportes | ✅ Completo con Supabase Realtime |
| M11 | Gestión de Usuarios | ⚠️ Stub — ConfigPage.tsx en construcción |

---

## 2. Bugs Encontrados y Corregidos

### Session actual (corregidos)

#### BUG-01 — Modal prop `open` vs `isOpen` (4 archivos)
El componente `Modal.tsx` acepta `isOpen: boolean`, pero 4 componentes pasaban `open={...}`.
- `VehicleFormModal.tsx` ✅ corregido
- `StockPage.tsx` ✅ corregido
- `LeadFormModal.tsx` ✅ corregido
- `PersonFormModal.tsx` ✅ corregido

#### BUG-02 — VehicleCard destructura JSX como si fuera objeto
`vehicleStatusBadge()` retorna JSX directo. El componente lo destructuraba como `{ variant, label }`, causando crash en runtime.
- `VehicleCard.tsx` ✅ corregido

#### BUG-03 — Import `react-hook-form` inexistente
`VehicleFormModal.tsx` importaba `useForm` de un paquete no instalado.
- ✅ Import removido

#### BUG-04 — CRÍTICO: 4 URLs incorrectas en `useCaja.ts`
Las rutas del frontend no coincidían con las del backend. **Corregido en esta sesión:**

| Hook | URL anterior (INCORRECTA) | URL actual (CORRECTA) |
|------|--------------------------|----------------------|
| `useActiveCashRegister` | `GET /cash/active` | `GET /cash/registers/current` |
| `useCashSummary` | `GET /cash/{id}/summary` | `GET /cash/registers/{id}/summary` |
| `useOpenCashRegister` | `POST /cash/open` | `POST /cash/registers/open` |
| `useCloseCashRegister` | `PATCH /cash/{id}/close` | `POST /cash/registers/{id}/close` |

Además se eliminó el import de `apiPatch` que ya no se usa.

---

## 3. Hallazgos de la Auditoría (sin bugs críticos)

### Frontend

**✅ Bien implementado:**
- Todos los hooks usan `@tanstack/react-query` v5 correctamente con `queryKey` estables
- Debounce de 300ms en todos los buscadores
- Loading skeletons en drawers y tablas
- Dark mode via clase CSS (tailwind `darkMode: 'class'`)
- JWT se adjunta automáticamente vía interceptor axios en `lib/api.ts`
- Redirección a `/login` en 401 automática
- SPA routing configurado correctamente en `nginx.conf` (`try_files`)
- `WorkOrderDetailDrawer` correctamente integra `EmitirFacturaModal` y `useInvoiceByRef`
- Lazy loading en todas las rutas de `App.tsx`

**⚠️ Mejoras recomendadas:**
1. **ConfigPage.tsx** — Sigue siendo un stub. Pendiente implementar gestión de usuarios (M11).
2. **Error boundaries** — No hay ninguno. Si un componente falla, toda la app crashea. Agregar al menos uno en `App.tsx`.
3. **`fmtDate` en WorkOrderDetailDrawer** — Usa `new Date(s)` sin el truco `+'T12:00:00'` que usan otros componentes. Puede mostrar un día antes en zonas UTC-X. Menor.
4. **`invoice_id` en `WorkOrder` type** — El tipo `Sale` tiene `invoice_id?: string | null` pero `WorkOrder` no. La UI usa `useInvoiceByRef` para consultar la factura, lo cual funciona, pero sería más limpio tener el campo.
5. **`pyafipws` comentado** en `requirements.txt` — Hay que descomentar y agregar las dependencias cuando se configure AFIP producción.

### Backend

**✅ Bien implementado:**
- Separación estricta `routers/ → services/ → Supabase`
- Todos los endpoints son `async`
- Pydantic v2 para validación
- Healthcheck en `/health` para Docker
- `TrustedHostMiddleware` activo en producción con dominio `dmcars.com.ar`
- CORS configurado vía settings
- Documentación OpenAPI deshabilitada en producción
- Dockerfile multi-stage con dependencias de sistema para WeasyPrint

**⚠️ Mejoras recomendadas:**
1. **No hay tests** — `pytest` está instalado pero no hay archivos `test_*.py`. Crítico para producción.
2. **`uvicorn` sin workers** — El `CMD` en Dockerfile usa un solo worker. En producción usar `--workers 2` o cambiar a `gunicorn -k uvicorn.workers.UvicornWorker`.
3. **Sin rate limiting** — Los endpoints no tienen throttling. Agregar `slowapi` para proteger contra abuso.
4. **Logging estructurado** — No hay configuración de logging. En producción conviene JSON logs para Railway/Render.

---

## 4. Guía de Deploy Online

### Arquitectura recomendada

```
Internet
   │
   ├─ app.dmcars.com.ar ─────────────► Vercel (Frontend React)
   │                                        │
   └─ api.dmcars.com.ar ─────────────► Railway (Backend FastAPI)
                                            │
                                       Supabase Cloud (ya existe)
```

**Costo estimado mensual:**
- Vercel: **$0** (plan hobby — gratuito para proyectos pequeños)
- Railway: **~$5-10/mes** (plan Starter, según uso)
- Supabase: **$0** (plan Free, 500 MB DB, 1 GB storage)
- **Total: ~$5-10/mes**

---

### PASO A PASO — Deploy del Frontend en Vercel

#### 1. Crear cuenta en Vercel
Ir a [vercel.com](https://vercel.com) → Sign up con GitHub/GitLab.

#### 2. Subir el proyecto a GitHub
```bash
cd "PROYECTO CONSECIONARIA"
git init
git add .
git commit -m "feat: sistema DMS DM Cars v1.0"
git remote add origin https://github.com/tu-usuario/dmcars.git
git push -u origin main
```

> ⚠️ **IMPORTANTE:** Asegurate de que `.env` esté en `.gitignore` (nunca committear claves).

#### 3. Importar en Vercel
- New Project → Import Git Repository → seleccionar el repo
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

#### 4. Variables de entorno en Vercel
En el dashboard del proyecto → Settings → Environment Variables:

```
VITE_API_URL          = https://api.dmcars.com.ar/api/v1
VITE_SUPABASE_URL     = https://ptrlwiryknnwyazdphjw.supabase.co
VITE_SUPABASE_ANON_KEY = tu_anon_key_de_supabase
```

#### 5. Archivo `vercel.json` para SPA routing
Crear `frontend/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

Esto equivale al `try_files` de nginx — necesario para que React Router funcione en Vercel.

#### 6. Dominio personalizado en Vercel
- Settings → Domains → Add → `app.dmcars.com.ar`
- Vercel te da los registros DNS que hay que agregar en tu registrador de dominio

---

### PASO A PASO — Deploy del Backend en Railway

#### 1. Crear cuenta en Railway
Ir a [railway.app](https://railway.app) → Sign up con GitHub.

#### 2. Nuevo proyecto desde GitHub
- New Project → Deploy from GitHub repo → seleccionar el mismo repo
- **Root Directory:** `backend`
- Railway detecta automáticamente el `Dockerfile`

#### 3. Variables de entorno en Railway
En el dashboard → Variables:

```
APP_ENV                   = production
DEBUG                     = false
SUPABASE_URL              = https://ptrlwiryknnwyazdphjw.supabase.co
SUPABASE_SERVICE_ROLE_KEY = tu_service_role_key
JWT_SECRET                = tu_jwt_secret_seguro_de_32_chars
MRBOT_EMAIL               = tu@email.com
MRBOT_API_KEY             = tu_mrbot_key
AFIP_CUIT                 = 20XXXXXXXXX9
AFIP_PUNTO_VENTA          = 1
AFIP_TESTING              = false   # cambiar a false para producción
FRONTEND_URL              = https://app.dmcars.com.ar
```

#### 4. Dominio personalizado en Railway
- Settings → Domains → Add Custom Domain → `api.dmcars.com.ar`
- Railway te da el CNAME que hay que configurar en el DNS

#### 5. Mejorar el Dockerfile para producción (opcional)
Cambiar la última línea del `backend/Dockerfile`:

```dockerfile
# Antes (1 worker):
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Recomendado (múltiples workers):
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

---

### Alternativa: VPS (más control, más barato a largo plazo)

Si preferís un servidor propio (Hostinger, DigitalOcean, Vultr):

```bash
# En el VPS (Ubuntu 22.04)
git clone https://github.com/tu-usuario/dmcars.git
cd dmcars

# Configurar .env con las variables de producción
cp .env.example .env
nano .env

# Levantar con Docker Compose
docker-compose up -d

# Nginx reverse proxy (externo al Docker Compose)
# app.dmcars.com.ar → localhost:5173 (o puerto 80 del nginx del frontend)
# api.dmcars.com.ar → localhost:8000
```

Costo: **~$6/mes** en Hostinger o DigitalOcean.

---

### CORS: actualizar `settings.cors_origins`

En el backend, agregar el dominio de producción a la lista de orígenes permitidos. En `backend/app/config.py`, asegurarse que `cors_origins` incluya:

```
https://app.dmcars.com.ar
```

---

## 5. Próximas Tareas — S-12 Hardening

### Prioridad Alta
1. **Implementar M11 — ConfigPage** (gestión de usuarios: crear/editar/cambiar rol)
2. **Tests básicos del backend** — al menos un test por router (pytest + httpx)
3. **Error boundaries React** — envolver las rutas principales
4. **Desplegar a staging** — hacer el primer deploy en Railway/Vercel para validar

### Prioridad Media
5. **Rate limiting** en el backend (proteger endpoints de auth y facturación)
6. **Workers múltiples** en uvicorn para producción
7. **Logging estructurado** en backend (JSON para Railway)
8. **AFIP producción** — descomentar `pyafipws`, configurar certificados, cambiar `AFIP_TESTING=false`

### Prioridad Baja
9. **`invoice_id` en tipo `WorkOrder`** — agregar campo al tipo TS y schema Pydantic
10. **`fmtDate` consistente** en `WorkOrderDetailDrawer`
11. **Documentación RUNBOOK.md** — guía operacional para el cliente

---

## 6. Checklist Pre-Deploy

```
[ ] .env de producción configurado y NUNCA commiteado
[ ] AFIP_TESTING=false (o true si se quiere seguir en homologación)
[ ] Certificados AFIP (.crt / .key) montados como volumen o variable base64
[ ] CORS configurado con el dominio real
[ ] DNS del dominio apuntando a Vercel y Railway
[ ] Supabase RLS activo en todas las tablas (verificar en dashboard Supabase)
[ ] vercel.json creado en frontend/
[ ] Test manual del flujo: login → venta → factura
[ ] Backup manual de Supabase antes del go-live
```
