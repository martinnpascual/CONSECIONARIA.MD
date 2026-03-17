# DM Cars — Sistema de Gestión para Concesionaria

Sistema DMS (Dealer Management System) web para la Concesionaria DM Cars - Dante Mostajo.
Gestiona el ciclo completo de la operación: stock de vehículos, CRM, ventas, taller, caja y facturación electrónica.

## Stack

- **Backend:** FastAPI (Python 3.11+)
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS
- **Base de datos:** Supabase (PostgreSQL gestionado)
- **Auth / Storage / Realtime:** Supabase
- **PDF:** WeasyPrint + Jinja2
- **Facturación electrónica:** ARCA (AFIP) vía MrBot API

## Módulos

- **Stock** — Vehículos nuevos, usados y en consignación con fotos
- **CRM** — Pipeline Kanban de leads, clientes, historial de interacciones
- **Ventas** — Cotizaciones, reservas, financiamiento, toma de usados, comisiones
- **Taller** — Órdenes de trabajo, presupuestos, historial por vehículo
- **Caja** — Movimientos, multi-moneda ARS/USD, cuenta corriente
- **Documentos** — PDFs: boleto de compraventa, cotización, acta de entrega, contratos
- **Facturación** — Factura A/B/C electrónica con CAE (ARCA/AFIP)
- **Reportes** — Stock valorizado, ventas, comisiones, caja

## Requisitos

- Docker y Docker Compose
- Proyecto Supabase activo (gratuito en supabase.com)
- Node.js 20+ (desarrollo local frontend)
- Python 3.11+ (desarrollo local backend)

## Inicio Rápido

### 1. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con las credenciales de Supabase, MrBot y AFIP
```

### 2. Aplicar migraciones en Supabase

```bash
# Instalar Supabase CLI si no lo tenés
npm install -g supabase

# Aplicar migraciones
supabase db push --db-url "postgresql://postgres:[password]@db.tu-proyecto.supabase.co:5432/postgres"

# O aplicar manualmente desde el panel de Supabase SQL Editor
```

### 3. Levantar con Docker

```bash
docker-compose up -d

# Ver logs
docker-compose logs -f
```

La aplicación estará disponible en:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **Documentación API:** http://localhost:8000/docs

### 4. Desarrollo local

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac | venv\Scripts\activate en Windows
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

## Estructura del Proyecto

```
dm-cars/
├── backend/
│   ├── app/
│   │   ├── main.py               # Entry point FastAPI
│   │   ├── config.py             # Variables de entorno
│   │   ├── supabase_client.py    # Cliente Supabase (service role)
│   │   ├── models/               # Pydantic models
│   │   ├── schemas/              # Pydantic schemas (request/response)
│   │   ├── routers/              # Endpoints por módulo
│   │   ├── services/             # Lógica de negocio
│   │   └── utils/                # Helpers y utilidades
│   ├── db/
│   │   ├── migrations/           # Migraciones SQL para Supabase
│   │   └── seeds/                # Datos de prueba
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── lib/supabase.ts       # Cliente Supabase (anon key)
│   │   ├── api/                  # HTTP clients hacia FastAPI
│   │   ├── components/           # Componentes reutilizables
│   │   ├── pages/                # Páginas del sistema
│   │   ├── hooks/                # Custom hooks (React Query)
│   │   ├── stores/               # Estado global (Zustand)
│   │   └── types/                # TypeScript interfaces
│   └── package.json
├── docker-compose.yml
├── .env.example                  # Variables de entorno (template)
├── PRD.md                        # Especificación del producto
├── AGENTS.md                     # Definición de agentes de desarrollo
├── PROJECT_SPEC.md               # Spec del proyecto (Dev Manager)
└── CHECKLIST.md                  # Progreso del desarrollo
```

## Roles del Sistema

| Rol | Permisos |
|---|---|
| `admin` | Acceso total: configuración, precio de costo, caja, reportes, usuarios |
| `vendedor` | Stock (sin costo), sus propios leads y ventas, documentos |
| `cajero` | Caja, cobros y pagos |
| `mecanico` | Solo órdenes de trabajo asignadas |

## Documentación Adicional

- [PRD.md](./PRD.md) — Especificación completa del sistema
- [AGENTS.md](./AGENTS.md) — Guía para agentes de desarrollo
- [CHECKLIST.md](./CHECKLIST.md) — Estado de avance del proyecto

---

Todos los derechos reservados — DM Cars.
