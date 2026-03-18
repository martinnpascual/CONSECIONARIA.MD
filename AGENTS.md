# AGENTS.md — Agentes de Desarrollo: DM Cars

## Propósito
Este documento define los agentes especializados que participan en el desarrollo del sistema DMS (Dealer Management System) para DM Cars. Cada agente tiene responsabilidades claras, reglas de trabajo y contexto específico del dominio automotriz.

---

## Reglas Globales (todos los agentes)

1. **Leer el PRD.md** antes de cualquier tarea. Es la fuente de verdad del proyecto.
2. **No inventar funcionalidad** que no esté en el PRD. Si algo no está claro, preguntar antes de implementar.
3. **Código limpio y documentado.** Funciones con docstrings, componentes con comentarios de propósito.
4. **Convenciones de nombres:**
   - Backend (Python): `snake_case` para variables, funciones y archivos
   - Frontend (React/TS): `camelCase` para variables/funciones, `PascalCase` para componentes
   - Base de datos: `snake_case` para tablas y columnas
5. **Idioma del código:** Inglés para variables, funciones, clases, tablas y endpoints. Español para comentarios, mensajes de UI y documentación.
6. **Git:** Commits en español con prefijos: `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, `test:`
7. **No hardcodear** valores de configuración. Usar variables de entorno (`.env`).
8. **Cada módulo debe ser independiente** y testeable de forma aislada.
9. **Supabase es la base de datos.** Usar siempre el SDK de Supabase para queries; no conectar directamente a PostgreSQL desde el frontend.
10. **RLS siempre activo.** Nunca deshabilitar Row Level Security en ninguna tabla.

---

## Estructura del Proyecto

```
dm-cars/
├── backend/
│   ├── app/
│   │   ├── main.py                  # Entry point FastAPI
│   │   ├── config.py                # Configuración y env vars
│   │   ├── supabase_client.py       # Cliente Supabase (service role)
│   │   ├── models/                  # Modelos Pydantic (sin ORM, Supabase maneja DB)
│   │   │   ├── vehicle.py
│   │   │   ├── person.py
│   │   │   ├── sale.py
│   │   │   ├── work_order.py
│   │   │   ├── cash.py
│   │   │   └── invoice.py
│   │   ├── schemas/                 # Schemas Pydantic (request/response)
│   │   ├── routers/                 # Endpoints por módulo
│   │   │   ├── auth.py
│   │   │   ├── vehicles.py
│   │   │   ├── persons.py
│   │   │   ├── sales.py
│   │   │   ├── work_orders.py
│   │   │   ├── cash.py
│   │   │   ├── consignments.py
│   │   │   ├── invoices.py
│   │   │   ├── reports.py
│   │   │   └── dashboard.py
│   │   ├── services/                # Lógica de negocio
│   │   │   ├── vehicle_service.py
│   │   │   ├── person_service.py
│   │   │   ├── sale_service.py
│   │   │   ├── work_order_service.py
│   │   │   ├── cash_service.py
│   │   │   ├── consignment_service.py
│   │   │   ├── pdf_service.py
│   │   │   ├── report_service.py
│   │   │   ├── mrbot_service.py     # Facturación ARCA
│   │   │   └── wsaa_service.py      # Token AFIP
│   │   ├── utils/                   # Utilidades
│   │   │   ├── security.py
│   │   │   ├── arca_helpers.py
│   │   │   └── formatters.py
│   │   └── tests/
│   ├── db/
│   │   ├── migrations/              # SQL versionado para Supabase
│   │   │   ├── 001_init.sql
│   │   │   ├── 002_vehicles.sql
│   │   │   ├── 003_persons_crm.sql
│   │   │   ├── 004_sales.sql
│   │   │   ├── 005_work_orders.sql
│   │   │   ├── 006_cash.sql
│   │   │   ├── 007_consignments.sql
│   │   │   └── 008_rls_policies.sql
│   │   ├── seeds/
│   │   └── functions/               # PostgreSQL functions / Edge Functions
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   └── supabase.ts          # Cliente Supabase (anon key, solo lectura con RLS)
│   │   ├── api/                     # Clientes HTTP hacia FastAPI backend
│   │   ├── components/
│   │   │   ├── ui/                  # Button, Input, Modal, Table, Badge, Toast
│   │   │   ├── layout/              # Sidebar, Header, MainLayout
│   │   │   └── shared/              # VehicleCard, PersonPicker, SaleStatusBadge
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Stock.tsx            # Listado de vehículos
│   │   │   ├── VehicleDetail.tsx    # Ficha completa de vehículo
│   │   │   ├── CRM.tsx              # Pipeline de leads (Kanban)
│   │   │   ├── PersonDetail.tsx     # Ficha de cliente/lead
│   │   │   ├── Sales.tsx            # Listado de ventas
│   │   │   ├── SaleDetail.tsx       # Detalle de venta + documentos
│   │   │   ├── Workshop.tsx         # Grilla de órdenes de trabajo
│   │   │   ├── WorkOrderDetail.tsx  # Detalle de OT
│   │   │   ├── Cash.tsx             # Caja del día
│   │   │   ├── Consignments.tsx     # Gestión de consignaciones
│   │   │   ├── Reports.tsx          # Reportes y exportaciones
│   │   │   └── Settings.tsx         # Configuración de la concesionaria
│   │   ├── hooks/
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   ├── stores/
│   │   │   ├── authStore.ts
│   │   │   └── uiStore.ts
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
├── PRD.md
├── AGENTS.md
├── PROJECT_SPEC.md
├── README.md
└── CHECKLIST.md
```

---

## Agentes de Desarrollo

---

### 🏗️ AGENTE 1: Arquitecto de Base de Datos + Backend Core

**Rol:** Diseña el schema de Supabase, crea las migraciones SQL y construye la API base.

**Stack:** Supabase (PostgreSQL + RLS), FastAPI, Pydantic

**Responsabilidades:**
- Diseñar e implementar el schema de Supabase según el PRD (sección 5)
- Crear migraciones SQL versionadas en `db/migrations/`
- Configurar RLS policies por rol (admin, vendedor, cajero, mecánico)
- Crear el cliente Supabase en el backend (service_role para escritura)
- Implementar endpoints CRUD base para vehículos, personas y ventas
- Configurar paginación, filtros y búsqueda en los endpoints de listado
- Crear seeds de datos de prueba realistas (marcas de autos, modelos, clientes ficticios)

**Reglas específicas:**
- Usar `async` en todos los endpoints
- Separar: `routers/` (endpoints) → `services/` (lógica) → Supabase (datos)
- Nunca poner lógica de negocio en los routers
- Cada tabla tiene: `id UUID DEFAULT gen_random_uuid()`, `created_at`, `updated_at`, `deleted_at`
- RLS: la columna `precio_costo` solo la puede leer quien tenga rol `admin` en su JWT
- Los endpoints de listado siempre soportan: `?search=`, `?page=`, `?per_page=`, filtros específicos

**Migraciones a crear:**
```sql
001_init.sql          -- users, user_profiles, businesses
002_vehicles.sql      -- vehicles, vehicle_photos, vehicle_price_history
003_persons_crm.sql   -- persons, interactions
004_sales.sql         -- sales, sale_payments, trade_ins
005_work_orders.sql   -- work_orders, work_order_items
006_cash.sql          -- cash_registers, cash_movements
007_consignments.sql  -- consignments
008_invoices.sql      -- invoices, documents
009_rls_policies.sql  -- todas las políticas RLS
```

**Verificación:**
```bash
# Aplicar migración en Supabase
supabase db push
# Verificar tablas
supabase db diff
```

---

### 🔐 AGENTE 2: Autenticación y Roles (Supabase Auth)

**Rol:** Implementa el sistema de login con Supabase Auth y la gestión de roles y permisos.

**Stack:** Supabase Auth, FastAPI middleware, JWT

**Responsabilidades:**
- Configurar Supabase Auth en el backend (validación de JWT)
- Crear middleware FastAPI para extraer usuario y rol del JWT de Supabase
- Implementar tabla `user_profiles` con campo `role` (admin/vendedor/cajero/mecanico)
- Crear endpoint para que el admin gestione usuarios y asigne roles
- Configurar RLS policies que usen el rol del JWT para filtrar datos
- Implementar la lógica de "vendedor ve solo sus leads" en el nivel de RLS

**Reglas específicas:**
- El JWT de Supabase contiene `sub` (user_id) y claims personalizados con el rol
- Los claims personalizados se agregan via Supabase Hook o función PostgreSQL
- El backend lee el token del header `Authorization: Bearer <token>`
- Usar `request.state.user` para acceder al usuario en los endpoints
- Nunca generar JWT propio; solo validar el de Supabase
- El service_role key NUNCA va al frontend

**Archivos clave:**
```
backend/app/utils/security.py          # Validación JWT Supabase
backend/app/routers/auth.py            # Endpoints de auth
backend/db/functions/custom_claims.sql # Hook para agregar rol al JWT
```

---

### 🚗 AGENTE 3: Módulo de Stock de Vehículos

**Rol:** Implementa todo el ciclo de vida del inventario de vehículos.

**Stack:** FastAPI, Supabase Storage (fotos), Pydantic

**Responsabilidades:**
- Endpoints CRUD completos para vehículos con todos los campos del PRD
- Carga y eliminación de fotos (hasta 20 por vehículo) vía Supabase Storage
- Sistema de filtros avanzados (marca, modelo, año, precio, estado, tipo, combustible)
- Reserva de vehículo (cambia estado y bloquea para otras ventas)
- Historial de cambios de precio
- Alerta de vehículos con alta antigüedad en stock
- Exportar listado a Excel

**Reglas específicas:**
- Las fotos se almacenan en bucket `vehicle-photos` de Supabase Storage con path: `{vehicle_id}/{photo_id}.{ext}`
- La URL de las fotos es pública (bucket público) para mostrarlas en el frontend sin autenticación
- El campo `precio_costo` solo se devuelve en la API si el usuario tiene rol `admin`
- El campo `precio_minimo` solo para `admin` y `vendedor`
- Al reservar un vehículo: `estado = 'reservado'` + `sale_id = <id de la venta>`
- Al cancelar la venta: volver a `estado = 'disponible'` automáticamente

**Archivos clave:**
```
backend/app/routers/vehicles.py
backend/app/services/vehicle_service.py
backend/app/schemas/vehicle_schemas.py
```

---

### 👥 AGENTE 4: Módulo CRM — Personas e Interacciones

**Rol:** Implementa el CRM completo: leads, clientes, interacciones y pipeline de ventas.

**Stack:** FastAPI, Supabase Realtime (para el Kanban)

**Responsabilidades:**
- CRUD de personas (unifica leads y clientes en una sola entidad)
- Registro de interacciones con tipo, fecha, resultado y próximo contacto
- Pipeline Kanban: endpoint que devuelve personas agrupadas por `estado_lead`
- Búsqueda global (nombre, DNI, teléfono, email)
- Asignación de vendedor a un lead
- Endpoint de cuenta corriente del cliente
- Historial de ventas del cliente

**Reglas específicas:**
- Una persona es "lead" mientras no tenga una venta asociada confirmada; pasa a "cliente" automáticamente al confirmar una venta
- Los vendedores solo pueden ver/editar personas donde `vendedor_asignado_id = su_user_id` (vía RLS)
- El admin puede ver todos los leads y reasignarlos
- Las interacciones son inmutables una vez creadas (soft delete si es necesario)

**Archivos clave:**
```
backend/app/routers/persons.py
backend/app/services/person_service.py
backend/app/schemas/person_schemas.py
```

---

### 💰 AGENTE 5: Módulo de Ventas y Toma de Usados

**Rol:** Implementa el proceso de venta completo, desde cotización hasta entrega.

**Stack:** FastAPI, lógica de negocio compleja

**Responsabilidades:**
- CRUD de ventas con todos los campos del PRD (sección 3.3.3)
- Gestión de pagos parciales y señas vinculadas a una venta
- Calculadora de financiamiento (cuotas, interés, total)
- Lógica de toma de usados: recibir un vehículo como parte de pago
- Al confirmar una toma de usado: ingresar el vehículo al stock automáticamente
- Comisiones automáticas por vendedor al cerrar una venta
- Validar que el vehículo esté disponible o reservado para ese cliente

**Reglas de negocio críticas:**
- Un vehículo no puede estar en dos ventas activas (`estado ≠ vendido` y `estado ≠ cancelada`)
- Al pasar venta a `entregada`: vehículo → `estado = 'vendido'`, disparar generación de factura
- Al cancelar una venta: vehículo → `estado = 'disponible'`
- El precio mínimo es el piso; un vendedor no puede cerrar por debajo sin aprobación del admin
- Las comisiones se calculan sobre: `(precio_venta - precio_costo) * porcentaje_comision`

**Archivos clave:**
```
backend/app/routers/sales.py
backend/app/services/sale_service.py
backend/app/schemas/sale_schemas.py
```

---

### 🔧 AGENTE 6: Módulo de Taller / Posventa

**Rol:** Gestiona las órdenes de trabajo del taller de la concesionaria.

**Stack:** FastAPI, Supabase

**Responsabilidades:**
- CRUD de órdenes de trabajo
- Items de la OT (trabajos realizados + repuestos usados)
- Cambio de estado con timestamp
- Asignación de mecánico
- Cálculo automático del total (mano de obra + repuestos)
- Historial de servicios por vehículo (por número de chasis/patente)

**Archivos clave:**
```
backend/app/routers/work_orders.py
backend/app/services/work_order_service.py
backend/app/schemas/work_order_schemas.py
```

---

### 🏦 AGENTE 7: Módulo de Caja y Financiero

**Rol:** Gestiona los movimientos de caja, métodos de pago y cuenta corriente.

**Stack:** FastAPI, lógica multi-moneda

**Responsabilidades:**
- Apertura y cierre de caja diaria
- Registro de cobros (vinculados a venta o servicio) y pagos (gastos)
- Soporte multi-moneda: ARS y USD con tipo de cambio configurable por día
- Cuenta corriente por cliente: saldo actualizado en tiempo real
- Gestión básica de cheques (fecha, banco, monto, estado)
- Resumen de caja al cierre (ingresos, egresos, saldo por método de pago)

**Archivos clave:**
```
backend/app/routers/cash.py
backend/app/services/cash_service.py
backend/app/schemas/cash_schemas.py
```

---

### 📄 AGENTE 8: Generación de Documentos PDF

**Rol:** Genera todos los documentos PDF del sistema con diseño profesional.

**Stack:** WeasyPrint, Jinja2 (templates HTML → PDF), Supabase Storage

**Responsabilidades:**

**Documentos de venta:**
- Cotización de vehículo
- Boleto de compraventa
- Recibo de seña
- Acta de entrega / remito

**Documentos de taller:**
- Orden de trabajo / presupuesto
- Acta de recepción de vehículo

**Consignación:**
- Contrato de consignación
- Liquidación al propietario

**Reportes:**
- Listado de stock con precios
- Reporte de ventas por período
- Comisiones por vendedor
- Cuenta corriente de cliente

**Reglas específicas:**
- El membrete se lee de la tabla `businesses` (logo URL de Supabase Storage, datos fiscales)
- El `precio_costo` NUNCA aparece en ningún documento PDF
- Los PDF generados se guardan en Supabase Storage bucket `documents` con path: `{tipo}/{año}/{id}.pdf`
- La URL del documento se guarda en la tabla `documents` vinculada a la entidad correspondiente
- Los PDF son inmutables; si cambia algo, se genera uno nuevo (no se sobreescribe)
- Diseño limpio, profesional, con colores configurables (por defecto azul oscuro #1a3a5c)

**Archivos clave:**
```
backend/app/services/pdf_service.py
backend/app/templates/pdf/
  ├── base.html               # Layout base con membrete
  ├── sales/
  │   ├── quotation.html
  │   ├── purchase_contract.html
  │   ├── deposit_receipt.html
  │   └── delivery_act.html
  ├── workshop/
  │   ├── work_order.html
  │   └── vehicle_reception.html
  ├── consignments/
  │   ├── consignment_contract.html
  │   └── settlement.html
  └── reports/
      ├── stock_report.html
      ├── sales_report.html
      ├── commissions_report.html
      └── account_statement.html
```

---

### 🧾 AGENTE 9: Facturación Electrónica (ARCA / AFIP via MrBot)

**Rol:** Integra el sistema con MrBot API para emitir comprobantes electrónicos.

**Stack:** MrBot API REST, pyafipws (WSAA), httpx, tenacity

**Responsabilidades:**
- Implementar cliente HTTP para MrBot API
- Implementar servicio WSAA para obtención de Token y Sign
- Gestionar certificados digitales de forma segura
- Emitir Factura A, B, C según condición fiscal del cliente
- Emitir facturas para ventas de vehículos y servicios de taller
- Parsear response y almacenar CAE, número, fecha de vencimiento

**Reglas específicas:**
- Los certificados (.crt, .key) NUNCA se commitean al repositorio
- Token y Sign se renuevan automáticamente cada 12 horas
- Siempre validar los datos antes de enviar a ARCA
- Almacenar el response completo de MrBot en la tabla `invoices`
- Reintentos con backoff exponencial para fallas de conexión
- Logs detallados de cada transacción

**Archivos clave:**
```
backend/app/services/mrbot_service.py
backend/app/services/wsaa_service.py
backend/app/utils/arca_helpers.py
backend/app/certs/   # En .gitignore
```

---

### 🎨 AGENTE 10: Frontend — UI/UX

**Rol:** Construye toda la interfaz de usuario: layout, temas, componentes y páginas.

**Stack:** React 18, TypeScript, Vite, TailwindCSS, Zustand, React Router

**Responsabilidades:**
- Layout: Sidebar con navegación por módulo, Header con usuario y tema
- Sistema de temas claro/oscuro con toggle
- Componentes UI: Button, Input, Select, Modal, Table, Badge, SearchBar, Pagination, Toast, FileUpload
- Páginas del PRD (sección 3): Stock, CRM Kanban, Ventas, Taller, Caja, Consignaciones, Reportes, Configuración
- Dashboard con KPIs en tiempo real (Supabase Realtime)
- Galería de fotos de vehículos con drag & drop para upload
- Pipeline Kanban de leads con drag & drop entre columnas

**Reglas específicas:**
- Solo TailwindCSS; no CSS custom salvo excepciones
- Componentes < 200 líneas; dividir si excede
- Loading skeletons en lugar de spinners genéricos
- Debounce de 300ms en todos los buscadores
- Manejo de errores con toasts informativos
- El `precio_costo` nunca se muestra si el usuario no es admin
- Responsive para tablets (vendedores en el salón usan iPads)

**Archivos clave:**
```
frontend/src/pages/**
frontend/src/components/**
frontend/src/context/AuthContext.tsx
frontend/src/context/ThemeContext.tsx
```

---

### 🔌 AGENTE 11: Integrador Frontend ↔ Backend + Supabase Realtime

**Rol:** Conecta el frontend con la API y configura las suscripciones Realtime.

**Stack:** Axios, TanStack Query (React Query), Zustand, Supabase JS SDK

**Responsabilidades:**
- Cliente HTTP con interceptors (token, refresh, manejo de errores)
- Hooks de datos con React Query para cada recurso
- Supabase Realtime: suscripciones al dashboard (KPIs actualizados en vivo)
- Estado global: usuario autenticado, caja abierta, tema
- Caché inteligente: invalidar datos tras mutaciones

**Reglas específicas:**
- Toda llamada a la API via hooks de React Query
- Token JWT en memoria (Zustand), no en localStorage
- Interceptor: si 401, refrescar token de Supabase; si falla, redirigir a login
- Las suscripciones Realtime se suscriben/desuscriben con el ciclo de vida del componente
- Tipado estricto: cada endpoint tiene su interface TypeScript

**Archivos clave:**
```
frontend/src/api/httpClient.ts
frontend/src/api/endpoints/
frontend/src/hooks/useVehicles.ts
frontend/src/hooks/usePersons.ts
frontend/src/hooks/useSales.ts
frontend/src/hooks/useDashboard.ts   # Supabase Realtime
frontend/src/stores/authStore.ts
frontend/src/lib/supabase.ts         # Cliente Supabase (anon key)
```

---

### 🧪 AGENTE 12: QA y Testing

**Rol:** Garantiza la calidad con tests automatizados.

**Stack:** Pytest (backend), Vitest + React Testing Library (frontend)

**Responsabilidades:**
- Tests unitarios para servicios del backend (sale_service, vehicle_service, etc.)
- Tests de integración para los endpoints principales
- Tests del flujo completo: lead → venta → factura
- Validar generación de PDFs
- Tests del módulo de facturación con mocks de MrBot API

**Reglas específicas:**
- Cobertura mínima del 70% en servicios del backend
- Cada endpoint nuevo: al menos un test happy path + uno de error
- Los tests de ARCA/MrBot usan mocks
- Tests del frontend validan comportamiento del usuario

---

## Orden de Ejecución Recomendado

**Sprint 1 — Fundamentos:**
1. **Agente 1** — Schema Supabase, migraciones, backend base
2. **Agente 2** — Auth + roles + RLS
3. **Agente 10** — Layout, tema, componentes base, páginas vacías

**Sprint 2 — Stock y CRM:**
4. **Agente 3** — Módulo de vehículos (CRUD + fotos)
5. **Agente 4** — Módulo CRM (personas, interacciones, Kanban)
6. **Agente 11** — Conectar frontend con API (stock y CRM)

**Sprint 3 — Ventas y Documentos:**
7. **Agente 5** — Módulo de ventas + toma de usados
8. **Agente 8** — Generación de PDFs (cotización, boleto, acta)
9. **Agente 11** — Integrar módulo de ventas en el frontend

**Sprint 4 — Taller, Caja y Facturación:**
10. **Agente 6** — Módulo de taller
11. **Agente 7** — Módulo de caja
12. **Agente 9** — Facturación electrónica ARCA
13. **Agente 11** — Integrar taller, caja y facturación

**Sprint 5 — Dashboard, Reportes y Calidad:**
14. **Agente 1** — Endpoints de dashboard y reportes
15. **Agente 8** — PDFs de reportes
16. **Agente 10** — Pantallas de dashboard y reportes
17. **Agente 12** — Batería completa de tests

---

## Convenciones de Comunicación entre Agentes

```
## DEPENDENCIA: [Agente X] → [Agente Y]
- **Necesito:** [descripción de lo que se necesita]
- **Para:** [endpoint/componente/funcionalidad]
- **Formato esperado:** [estructura de datos, interface TypeScript o schema Pydantic]
- **Prioridad:** Alta / Media / Baja
```
