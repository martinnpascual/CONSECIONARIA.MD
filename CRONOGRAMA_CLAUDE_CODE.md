# Cronograma para Claude Code — DM Cars
> Generado: 2026-03-18 | Auditoría completa del codebase

---

## Estado Real del Proyecto al 2026-03-18

El proyecto está **más avanzado de lo que indican los documentos internos**. Una auditoría exhaustiva del filesystem confirma:

| Sesión Doc | Objetivo | Estado Real |
|-----------|----------|-------------|
| S-00 | Estructura base + config | ✅ Completa |
| S-01 | Migraciones SQL + RLS (11 archivos) | ✅ Completa |
| S-02 | Backend: Auth + Vehículos | ✅ Completa |
| S-03 | Backend: CRM | ✅ Completa |
| S-04 | Backend: Ventas | ✅ Completa |
| S-05 | Backend: Taller + Caja + Consignaciones | ✅ Completa |
| S-06 | Backend: PDFs + ARCA | ✅ Completa |
| S-07 | Frontend: Base + Stock | ✅ Completa |
| S-08 | Frontend: CRM + Kanban | ✅ Completa |
| S-09 | Frontend: Ventas + Calculadora | ✅ Completa |
| S-10* | Frontend: Caja + Consig + Dashboard + Config | ✅ **YA HECHO** |

> **IMPORTANTE:** Las páginas que el PLAN_SESIONES.md marcaba como "stubs"
> están en realidad completamente implementadas:
> - `CajaPage.tsx` — 275 líneas, implementado
> - `ConsignPage.tsx` — 211 líneas, implementado
> - `DocumentosPage.tsx` — 181 líneas, implementado
> - `DashboardPage.tsx` — 239 líneas + Realtime vía Supabase directo
> - `ConfigPage.tsx` — 537 líneas, M11 completo
> - `ErrorBoundary.tsx` — integrado en todas las rutas de App.tsx

---

## Módulos del Sistema — Estado Actual

| ID | Módulo | Backend | Frontend | Estado |
|----|--------|---------|----------|--------|
| M01 | Stock de Vehículos | ✅ | ✅ | **Completo** |
| M02 | CRM — Clientes y Leads | ✅ | ✅ | **Completo** |
| M03 | Proceso de Ventas | ✅ | ✅ | **Completo** |
| M04 | Toma de Usados | ✅ | ✅ | **Completo** |
| M05 | Taller / Posventa | ✅ | ✅ | **Completo** |
| M06 | Caja y Financiero | ✅ | ✅ | **Completo** |
| M07 | Consignaciones | ✅ | ✅ | **Completo** |
| M08 | Documentos PDF | ✅ | ✅ | **Completo** |
| M09 | Facturación ARCA | ✅ (testing) | ✅ | **Completo** |
| M10 | Dashboard y Reportes | — | ✅ (Supabase directo) | **Completo** |
| M11 | Gestión de Usuarios | ✅ | ✅ | **Completo** |

---

## Lo que Falta — Tareas Reales Pendientes

### 🔴 Prioridad CRÍTICA

#### 1. Tests Backend (pytest)
Solo existe `test_health.py`. Faltan todos los tests de servicios.
```
backend/tests/
  conftest.py         ← existe pero mínimo
  test_health.py      ← existe (7 tests básicos)
  test_vehicles.py    ← FALTA
  test_sales.py       ← FALTA
  test_cash.py        ← FALTA
  test_persons.py     ← FALTA
  test_auth.py        ← FALTA
  integration/
    test_lead_to_sale.py   ← FALTA
    test_consignment.py    ← FALTA
    test_work_order.py     ← FALTA
```

#### 2. RUNBOOK.md
No existe en el repositorio. Necesario para el go-live.

### 🟡 Prioridad MEDIA

#### 3. Deploy Configuration
- `frontend/vercel.json` — falta (necesario para SPA routing en Vercel)
- `backend/Dockerfile` — cambiar a uvicorn multi-worker para producción
- CORS producción — agregar dominio real en `config.py`

#### 4. Backend Hardening
- Rate limiting con `slowapi` en endpoints de auth y facturación
- Logging estructurado JSON para Railway/Render
- Validaciones de borde: vehículo ya vendido, caja cerrada, factura inmutable

### 🟢 Prioridad BAJA

#### 5. Fixes Menores
- `fmtDate` consistente en `WorkOrderDetailDrawer.tsx`
- Campo `invoice_id` en tipo `WorkOrder` (TypeScript + Pydantic)
- Activar `pyafipws` en requirements.txt para AFIP producción real

---

## Cronograma de Sesiones Restantes para Claude Code

```
SESIÓN     TIEMPO EST.   CONTENIDO
─────────────────────────────────────────────────────────────────
S-10       2-3 hs        Backend Tests Parte 1: servicios core
S-11       2-3 hs        Backend Tests Parte 2: integración + borde
S-12       2-3 hs        Hardening + Deploy Config + RUNBOOK.md
─────────────────────────────────────────────────────────────────
TOTAL      6-9 hs        ← Sistema listo para producción
```

---

## SESIÓN S-10 — Backend Tests Parte 1

**Rama:** `session/010`
**Objetivo:** Tests unitarios de los servicios más críticos del backend.

### conftest.py (mejorar)
```python
# Agregar fixtures:
# - authenticated_client(role="admin")
# - authenticated_client(role="vendedor")
# - mock_supabase_client
# - vehicle_factory, person_factory, sale_factory
```

### test_vehicles.py
```python
# Cubrir:
# - GET /api/v1/vehicles → lista paginada sin auth = 401
# - GET /api/v1/vehicles con auth admin → incluye precio_costo
# - GET /api/v1/vehicles con auth vendedor → NO incluye precio_costo
# - POST /api/v1/vehicles → crear vehículo válido
# - POST /api/v1/vehicles datos inválidos → 422
# - PATCH /api/v1/vehicles/{id}/reserve → reservar disponible
# - PATCH /api/v1/vehicles/{id}/reserve → reservar ya vendido = 400
# - DELETE /api/v1/vehicles/{id} → soft delete (deleted_at seteado)
```

### test_persons.py
```python
# Cubrir:
# - CRUD básico de personas
# - Búsqueda por nombre/DNI/teléfono
# - GET /kanban → agrupar por lead_status
# - POST /persons/{id}/interactions → avanza estado nuevo→contactado
```

### test_sales.py
```python
# Cubrir:
# - POST /financing/calculate → calculadora francesa correcta
# - POST /sales → crear venta en estado cotizacion
# - PUT /sales/{id}/status → máquina de estados válida
# - PUT /sales/{id}/status → transición inválida = 400
# - POST /sales/{id}/payments → primera seña avanza a reserva
# - Entrega: vehículo cambia a vendido, lead a cerrado_ganado
```

### test_cash.py
```python
# Cubrir:
# - POST /cash/registers/open → abrir caja
# - POST /cash/registers/open con caja ya abierta = 400
# - POST /cash/registers/{id}/movements → agregar movimiento
# - POST /cash/registers/{id}/close → cerrar y calcular diferencia
# - POST /cash/registers/{id}/movements con caja cerrada = 400
```

### Comando para correr en Claude Code:
```bash
cd backend
pip install pytest pytest-asyncio httpx anyio -q
pytest tests/ -v --tb=short
```

### Estimación de tokens:
- conftest.py improvements: ~800 tokens
- test_vehicles.py: ~1200 tokens
- test_persons.py: ~900 tokens
- test_sales.py: ~1500 tokens
- test_cash.py: ~900 tokens
- **Total estimado: ~5300 tokens** (dentro del límite de 10.000)

---

## SESIÓN S-11 — Backend Tests Parte 2

**Rama:** `session/011`
**Objetivo:** Tests de integración + tests de seguridad + validaciones de borde.

### test_auth.py
```python
# Cubrir:
# - GET /me sin token → 401
# - GET /me con token expirado → 401
# - GET /users con rol vendedor → 403
# - precio_costo oculto para no-admin
```

### test_pdf_service.py
```python
# Cubrir:
# - Generar cotización → PDF no contiene "precio_costo"
# - Generar boleto → contiene datos del cliente y vehículo
# - Generar OT → contiene ítems y totales
```

### tests/integration/test_lead_to_sale.py
```python
# Flujo completo E2E:
# 1. Crear persona (lead nuevo)
# 2. Registrar interacción → lead pasa a contactado
# 3. Crear venta → estado cotizacion
# 4. Agregar pago (seña) → estado reserva
# 5. Cambiar a en_proceso
# 6. Cambiar a entregada → vehículo vendido, lead cerrado_ganado
# 7. Intentar reservar el mismo vehículo → 400
```

### tests/integration/test_consignment.py
```python
# Flujo:
# 1. Crear consignación con propietario y vehículo
# 2. Registrar venta de la consignación
# 3. Verificar cálculo de comisión
# 4. Pagar liquidación → estado settled
```

### Estimación de tokens:
- test_auth.py: ~700 tokens
- test_pdf_service.py: ~800 tokens (mockeado, sin WeasyPrint real)
- test_lead_to_sale.py: ~1800 tokens
- test_consignment.py: ~1200 tokens
- Actualizar coverage report: ~200 tokens
- **Total estimado: ~4700 tokens** (dentro del límite)

---

## SESIÓN S-12 — Hardening + Deploy + RUNBOOK

**Rama:** `session/012`
**Objetivo:** Dejar el sistema listo para producción.

### Tarea 1: frontend/vercel.json (5 min)
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

### Tarea 2: Dockerfile backend (5 min)
```dockerfile
# Cambiar CMD por:
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### Tarea 3: Rate limiting (slowapi) (~30 min)
```python
# En main.py:
from slowapi import Limiter
from slowapi.util import get_remote_address
# Aplicar en endpoints de auth e invoices:
# @limiter.limit("5/minute") en POST /auth endpoints
# @limiter.limit("10/minute") en POST /invoices
```

### Tarea 4: Logging estructurado (~20 min)
```python
# logging_config.py con JSON formatter para Railway
```

### Tarea 5: Validaciones de borde backend (~30 min)
- Vehículo ya vendido → reserva = HTTP 400
- Precio de venta < precio_minimo → log warning
- Caja ya cerrada → movimientos = HTTP 400
- Factura emitida → inmutable (ya existe, verificar)

### Tarea 6: Fixes menores frontend (~20 min)
- `fmtDate` en WorkOrderDetailDrawer (+'T12:00:00')
- `invoice_id?: string | null` en tipo `WorkOrder`

### Tarea 7: RUNBOOK.md (~45 min)
```markdown
# Secciones:
1. Requisitos previos
2. Setup de desarrollo local
3. Variables de entorno
4. Cómo correr migraciones (supabase db push)
5. Deploy en producción (Railway + Vercel)
6. Certificados ARCA — renovación
7. Backup Supabase Storage
8. Troubleshooting — errores frecuentes
9. Checklists operacionales
```

### Tarea 8: Actualizar PROJECT_SPEC.md + CHECKLIST.md
- Marcar todas las sesiones S-10 a S-12 como completadas
- Actualizar versión a 1.0.0

### Estimación de tokens:
- vercel.json: ~200 tokens
- Dockerfile: ~100 tokens
- Rate limiting: ~600 tokens
- Logging: ~500 tokens
- Validaciones borde: ~800 tokens
- Fixes frontend: ~300 tokens
- RUNBOOK.md: ~2000 tokens
- Actualizar docs: ~400 tokens
- **Total estimado: ~4900 tokens** (dentro del límite)

---

## Checklist Pre-Deploy (verificar antes de go-live)

```
[ ] .env de producción configurado y NUNCA commiteado
[ ] AFIP_TESTING=false (si se va a producción AFIP)
[ ] Certificados ARCA (.crt / .key) montados como volumen
[ ] CORS configurado con dominio real (app.dmcars.com.ar)
[ ] DNS apuntando a Vercel (frontend) y Railway (backend)
[ ] frontend/vercel.json creado y commiteado
[ ] RLS activo en todas las tablas (verificar en dashboard Supabase)
[ ] Test manual del flujo: login → lead → venta → factura → PDF
[ ] pytest: cobertura >70% en services/
[ ] Backup manual de Supabase antes del go-live
[ ] Cambiar APP_ENV=production en Railway
[ ] Verificar que /docs no es accesible en producción
```

---

## Comandos para iniciar cada sesión en Claude Code

### Inicio S-10:
```
Iniciá sesión S-10. Trabajamos en backend/tests/.
Crear: test_vehicles.py, test_persons.py, test_sales.py, test_cash.py
Mejorar: conftest.py con fixtures para auth por rol.
Cobertura objetivo: >70% en services/
```

### Inicio S-11:
```
Iniciá sesión S-11. Tests de integración E2E.
Crear: test_auth.py, test_pdf_service.py, tests/integration/test_lead_to_sale.py, tests/integration/test_consignment.py
Al final correr: pytest tests/ --cov=app/services --cov-report=term
```

### Inicio S-12:
```
Iniciá sesión S-12. Hardening y deploy config.
Tareas: vercel.json, uvicorn workers, slowapi, logging JSON, validaciones borde, fixes frontend, RUNBOOK.md completo.
Al finalizar actualizar PROJECT_SPEC.md y CHECKLIST.md con estado final.
```

---

## Resumen Visual

```
HOY           S-10                S-11              S-12
   │                                                   │
   └───────────────────────────────────────────────────┘
   Feature     Tests               Tests            Go-Live
   Complete    Unitarios           Integración +    Ready ✅
               (~3 hs)             Hardening
                                   (~3 hs)          (~3 hs)
```

El proyecto **DM Cars** está funcionalmente completo.
Las 3 sesiones restantes son de calidad, robustez y deployabilidad.
