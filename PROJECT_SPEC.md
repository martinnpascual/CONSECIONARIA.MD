# PROJECT_SPEC.md — DM Cars

## Datos del Proyecto

| Campo | Valor |
|---|---|
| **Nombre** | dm-cars |
| **Descripción** | Sistema DMS (Dealer Management System) para Concesionaria DM Cars - Dante Mostajo |
| **Versión** | 0.1.0 |
| **Estado** | En desarrollo |
| **Inicio** | 2026-03-16 |
| **Sesión actual** | S-08 |

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Backend | FastAPI 0.110+ (Python 3.11+) |
| Frontend | React 18 + TypeScript + Vite |
| Estilos | TailwindCSS |
| Estado global | Zustand |
| Fetching | TanStack Query (React Query) |
| Base de datos | Supabase (PostgreSQL 15) |
| Autenticación | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| PDF | WeasyPrint + Jinja2 |
| Facturación | MrBot API + pyafipws (ARCA/AFIP) |
| Contenedores | Docker + Docker Compose |
| Control de versiones | Git (branch por sesión: session/NNN) |

---

## Módulos del Sistema

| ID | Módulo | Estado | Sesión |
|---|---|---|---|
| M01 | Stock de Vehículos | ✅ completado | S-02 |
| M02 | CRM — Clientes y Leads | ✅ completado | S-03 |
| M03 | Proceso de Ventas | ✅ completado | S-04 |
| M04 | Toma de Usados | ✅ completado | S-04 |
| M05 | Taller / Posventa | ✅ completado | S-05 |
| M06 | Caja y Financiero | ✅ completado | S-05 |
| M07 | Consignaciones | ✅ completado | S-05 |
| M08 | Documentos PDF | ✅ completado | S-06 |
| M09 | Facturación ARCA | ✅ completado | S-06 |
| M10 | Dashboard y Reportes | pendiente | S-07 |
| M11 | Gestión de Usuarios | pendiente | S-01 |

---

## Plan de Sesiones

| Sesión | Objetivo | Estado |
|---|---|---|
| S-00 | Estructura de repo + CLAUDE.md + PROJECT_SPEC.md + .env.example + docker-compose base | ✅ completada |
| S-01 | Migraciones SQL Supabase (todas las tablas) + RLS policies + seeds de prueba | ✅ completada |
| S-02 | Backend: autenticación Supabase + middleware de roles + endpoints de vehículos | ✅ completada |
| S-03 | Backend: módulo CRM (personas + interacciones) + pipeline Kanban endpoint | ✅ completada |
| S-04 | Backend: módulo de ventas (CRUD + pagos + toma de usados) + lógica de negocio | ✅ completada |
| S-05 | Backend: taller + caja + consignaciones | ✅ completada |
| S-06 | Backend: generación de PDFs (documentos de venta) + integración ARCA | ✅ completada |
| S-07 | Frontend: layout + auth + módulo de stock (páginas + componentes) | ✅ completada |
| S-08 | Frontend: módulo CRM + Kanban de leads + ficha de persona | ✅ completada |
| S-09 | Frontend: módulo de ventas + calculadora de financiamiento | pendiente |
| S-10 | Frontend: taller + caja + consignaciones | pendiente |
| S-11 | Frontend: dashboard KPIs (Supabase Realtime) + reportes | pendiente |
| S-12 | Hardening: manejo de errores + tests + RUNBOOK.md | pendiente |

---

## Variables de Entorno Requeridas

Antes de la primera sesión de desarrollo, completar:

```env
# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# JWT (del panel de Supabase → Project Settings → API → JWT Secret)
JWT_SECRET=tu-jwt-secret-de-supabase

# MrBot / ARCA
MRBOT_EMAIL=
MRBOT_API_KEY=
AFIP_CUIT=
AFIP_PUNTO_VENTA=1
AFIP_TESTING=true
AFIP_CERT_PATH=./app/certs/cert.crt
AFIP_KEY_PATH=./app/certs/private.key

# App
APP_NAME=DM Cars
DEBUG=true
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:8000/api/v1
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## Dependencias Backend (requirements.txt base)

```
fastapi==0.110.0
uvicorn[standard]==0.27.1
pydantic==2.6.1
pydantic-settings==2.2.1
python-dotenv==1.0.1
supabase==2.4.0               # SDK Supabase Python
gotrue==2.4.0                 # Supabase Auth
httpx==0.27.0
python-jose[cryptography]==3.3.0
tenacity==8.2.3               # Reintentos ARCA
weasyprint==62.3              # Generación PDF
jinja2==3.1.3                 # Templates PDF
qrcode==7.4.2                 # QR para facturas ARCA
python-barcode==0.15.1        # Código de barras facturas
openpyxl==3.1.2               # Export Excel
pandas==2.2.1                 # Reportes
pyafipws==0.9.36              # WSAA Token AFIP
cryptography==42.0.5          # Certificados AFIP
lxml==5.1.0                   # SOAP WSAA
python-multipart==0.0.9       # Upload fotos
pillow==10.2.0                # Procesamiento imágenes
```

---

## Dependencias Frontend (package.json base)

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.3",
    "typescript": "^5.4.2",
    "@supabase/supabase-js": "^2.43.1",
    "@tanstack/react-query": "^5.28.4",
    "zustand": "^4.5.2",
    "axios": "^1.6.8",
    "tailwindcss": "^3.4.3",
    "lucide-react": "^0.368.0",
    "react-hot-toast": "^2.4.1",
    "@hello-pangea/dnd": "^16.5.0",
    "react-dropzone": "^14.2.3"
  }
}
```

---

## Contexto de Negocio

**DM Cars** es una concesionaria nueva que necesita digitalizar su operación desde cero. Los procesos actuales son manuales o en Google Sheets.

**Prioridades del cliente:**
1. Stock de vehículos visible y actualizable en tiempo real
2. Seguimiento de leads y clientes (CRM)
3. Documentos comerciales profesionales (cotizaciones, contratos)
4. Facturación electrónica correcta con ARCA
5. Control de caja básico
6. Dashboard para que el dueño vea el estado del negocio

**Volumen estimado:**
- Stock: 30-80 vehículos simultáneos
- Ventas: 10-30 unidades/mes
- Clientes: crecimiento gradual desde 0
- Usuarios del sistema: 5-10 personas

---

## Errores Pendientes

_Sin errores registrados. Proyecto nuevo._

---

## Mejoras Registradas

_Sin mejoras registradas aún._

---

## Notas del Desarrollador

- Usar Supabase CLI para aplicar migraciones (`supabase db push`)
- El proyecto de referencia es **OctopusTrack** (ERP para ferreterías) — misma arquitectura adaptada al dominio automotriz
- Priorizar la UX móvil/tablet para los vendedores en el salón
- Mantener el `precio_costo` oculto en toda la capa de frontend para no-admin
