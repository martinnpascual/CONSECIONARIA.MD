# PRD — Sistema de Gestión para DM Cars (Concesionaria Dante Mostajo)

## 1. Visión General

### 1.1 Descripción del Producto
Sistema DMS (Dealer Management System) web diseñado específicamente para la concesionaria DM Cars. Permite gestionar el ciclo completo de la operación: stock de vehículos (nuevos, usados y en consignación), CRM de clientes y leads, proceso de ventas con financiamiento, toma de usados (parte de pago), taller/posventa, caja, documentos comerciales y facturación electrónica integrada con ARCA (AFIP).

### 1.2 Stack Tecnológico
- **Backend:** FastAPI (Python 3.11+)
- **Frontend:** React 18 + TypeScript + Vite
- **Base de datos:** Supabase (PostgreSQL gestionado)
- **Autenticación:** Supabase Auth (email/password + Google OAuth)
- **Almacenamiento:** Supabase Storage (fotos de vehículos, documentos)
- **Realtime:** Supabase Realtime (dashboard en tiempo real)
- **Generación de documentos:** PDF (contratos, boletos de compraventa, remitos, facturas)
- **Facturación electrónica:** Integración con ARCA (ex AFIP) vía MrBot API

### 1.3 Usuarios Objetivo
- **Dueño / Administrador:** acceso total al sistema, configuración, reportes y caja
- **Vendedor:** gestión de leads, ventas y documentos de clientes asignados
- **Cajero:** gestión de caja, cobros y pagos
- **Mecánico / Encargado de Taller:** órdenes de trabajo y posventa

---

## 2. Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │  Stock   │ │   CRM    │ │  Ventas  │ │   Taller   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │  Caja    │ │  Docs PDF│ │Facturac. │ │  Reportes  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API (JSON)
┌───────────────────────┴─────────────────────────────────┐
│                   Backend (FastAPI)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │   Auth   │ │ Vehículos│ │  Ventas  │ │    PDF     │ │
│  │ Supabase │ │  Stock   │ │  CRM     │ │ Generator  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │  Taller  │ │  Caja    │ │ Factura  │                 │
│  │  OT/Grilla│ │Movimientos│ │  ARCA   │                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
└───────────────────────┬─────────────────────────────────┘
                        │ SDK / REST
┌───────────────────────┴─────────────────────────────────┐
│               Supabase (PostgreSQL + Storage)            │
│   DB  │  Auth  │  Storage (fotos/docs)  │  Realtime     │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Módulos del Sistema

---

### 3.1 Stock de Vehículos

#### 3.1.1 Descripción
Gestión completa del inventario de vehículos: nuevos, usados y en consignación. Cada unidad tiene su ficha completa con fotos, historial de precios y estado.

#### 3.1.2 Tipos de Vehículos
- **Nuevo:** vehículo directo de fábrica/importador, sin uso previo
- **Usado:** vehículo con kilometraje y propietario anterior
- **Consignación:** vehículo de tercero vendido por la concesionaria con comisión

#### 3.1.3 Ficha de Vehículo
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | Identificador único |
| tipo | enum | nuevo / usado / consignacion |
| marca | string | Ej: Toyota, Ford |
| modelo | string | Ej: Corolla, Ranger |
| version | string | Ej: XEI AT 2.0 |
| año | integer | Año de fabricación |
| año_modelo | integer | Año del modelo |
| color | string | Color exterior |
| color_interior | string | Color interior |
| combustible | enum | nafta / diesel / hibrido / electrico / gnc |
| transmision | enum | manual / automatica |
| kilometraje | integer | Solo para usados |
| numero_chasis | string | VIN/Chasis (único) |
| numero_motor | string | |
| patente | string | Solo si tiene dominio |
| precio_lista | decimal | Precio público |
| precio_costo | decimal | Solo visible para admin |
| precio_minimo | decimal | Piso de negociación |
| estado | enum | disponible / reservado / vendido / baja |
| ubicacion | string | Salón / Depósito / En reparación |
| procedencia | string | Solo usados: cómo llegó |
| descripcion | text | Descripción para web/publicaciones |
| equipamiento | jsonb | Lista de equipamientos (aire, GPS, etc.) |
| fotos | array | URLs de Supabase Storage |
| fecha_ingreso | date | |
| fecha_venta | date | Se llena al vender |
| dias_en_stock | integer | Calculado automáticamente |
| propietario_consig_id | UUID | Solo para consignación |
| created_at, updated_at | timestamp | |

#### 3.1.4 Funcionalidades
- Alta, edición y baja de vehículos
- Carga masiva de fotos (hasta 20 por unidad) con preview
- Filtros por: tipo, marca, modelo, año, precio, estado, combustible, color
- Vista de grilla (tarjetas) y lista
- Historial de cambios de precio por unidad
- Alerta de stock de vehículos con muchos días en inventario (configurable, ej: >90 días)
- Exportar listado a PDF y Excel
- Reserva de unidad vinculada a un lead/cliente

---

### 3.2 CRM — Clientes y Leads

#### 3.2.1 Descripción
Gestión completa del ciclo de vida del cliente: desde el primer contacto (lead) hasta la postventa. Permite registrar todas las interacciones, intereses y seguimientos.

#### 3.2.2 Ficha de Persona (unifica cliente y lead)
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | |
| tipo | enum | lead / cliente / proveedor |
| nombre | string | |
| apellido | string | |
| dni_cuit | string | DNI o CUIT |
| condicion_iva | enum | consumidor_final / responsable_inscripto / monotributo / exento |
| email | string | |
| telefono | string | |
| whatsapp | string | Puede ser distinto al teléfono |
| direccion | string | |
| localidad | string | |
| provincia | string | |
| codigo_postal | string | |
| fecha_nacimiento | date | Para recordatorios |
| canal_origen | enum | web / instagram / facebook / mercadolibre / showroom / referido / otro |
| vendedor_asignado_id | UUID | FK a users |
| notas | text | |
| estado_lead | enum | nuevo / contactado / interesado / en_negociacion / cerrado_ganado / cerrado_perdido |
| motivo_perdida | string | Si cerrado_perdido |
| created_at, updated_at | timestamp | |

#### 3.2.3 Interacciones (historial)
Cada lead/cliente puede tener N interacciones registradas:
- Tipo: llamada / whatsapp / email / visita / test_drive / cotización_enviada
- Fecha y hora
- Resultado / notas
- Próximo contacto (fecha y acción)
- Vendedor responsable

#### 3.2.4 Funcionalidades
- Pipeline Kanban de leads por etapa
- Búsqueda global por nombre, DNI, teléfono, email
- Historial completo de interacciones por persona
- Asignación y reasignación de leads entre vendedores
- Recordatorios de seguimiento (fecha próximo contacto)
- Vehículos de interés vinculados al lead
- Clientes con compras anteriores (historial de ventas)
- Vista de cuenta corriente (saldo pendiente)
- Exportar base de clientes a Excel

---

### 3.3 Proceso de Ventas

#### 3.3.1 Descripción
Flujo completo de venta desde la cotización hasta la entrega y documentación final. Soporta venta al contado, financiada (plan de ahorro, crédito bancario) y combinada.

#### 3.3.2 Estados de una Venta
```
Cotización → Reserva → En proceso → Entregada → Cancelada
```

#### 3.3.3 Ficha de Venta
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | |
| numero | string | Correlativo por año: 2024-0001 |
| fecha | date | |
| cliente_id | UUID | FK a personas |
| vehiculo_id | UUID | FK a vehiculos |
| vendedor_id | UUID | FK a users |
| tipo_operacion | enum | contado / financiado / plan_ahorro / combinado |
| precio_venta | decimal | Precio acordado |
| descuento | decimal | Monto o porcentaje |
| precio_final | decimal | Precio acordado - descuento |
| usado_id | UUID | FK a vehiculos (si hay toma de usado) |
| valor_usado | decimal | Valor acordado del usado en parte de pago |
| monto_financiado | decimal | Si aplica |
| banco_financiador | string | Si aplica |
| cuotas | integer | Si aplica |
| valor_cuota | decimal | Si aplica |
| plan_ahorro | string | Si aplica (nombre del plan) |
| estado | enum | cotizacion / reserva / en_proceso / entregada / cancelada |
| motivo_cancelacion | string | |
| observaciones | text | |
| fecha_entrega | date | |
| created_at, updated_at | timestamp | |

#### 3.3.4 Documentos generados por venta
- Cotización (PDF)
- Boleto de compraventa (PDF)
- Recibo de seña (PDF)
- Contrato de financiamiento (PDF)
- Remito / Acta de entrega (PDF)
- Factura electrónica (ARCA/AFIP)

#### 3.3.5 Funcionalidades
- Nueva venta desde ficha del vehículo o desde ficha del cliente
- Calculadora de financiamiento en tiempo real
- Gestión de señas y pagos parciales
- Reserva de vehículo al iniciar la venta (bloquea la unidad)
- Generación de todos los documentos PDF con firma digital opcional
- Envío de documentos por WhatsApp/email desde el sistema
- Historial completo de pagos por venta
- Comisiones automáticas por vendedor

---

### 3.4 Toma de Usados (Parte de Pago)

#### 3.4.1 Descripción
Gestión del proceso de recepción de vehículos usados entregados como parte de pago en una compra. Incluye valuación, peritaje y registro fotográfico.

#### 3.4.2 Proceso
1. Registrar vehículo usado propuesto por el cliente
2. Cargar información técnica y fotos
3. Registrar valuación interna (precio ofrecido)
4. Aceptar/rechazar la toma
5. Si se acepta: ingresar el usado al stock como vehículo "usado"

#### 3.4.3 Ficha de Peritaje/Valuación
- Datos técnicos del vehículo (misma estructura que stock)
- Estado general: excelente / bueno / regular / para reparar
- Observaciones mecánicas y estéticas
- Fotos de daños y estado
- Monto de valuación ofrecido
- Comparativa con precio de mercado (referencia manual)
- Vinculación con la venta en la que se toma

---

### 3.5 Taller / Posventa

#### 3.5.1 Descripción
Módulo para gestión del servicio técnico: órdenes de trabajo, presupuestos de reparación, repuestos utilizados y facturación de servicios.

#### 3.5.2 Tipos de Trabajo
- Service programado (mantenimiento)
- Reparación mecánica
- Reparación de chapa y pintura
- Preparación de vehículo para venta
- Garantía de fábrica

#### 3.5.3 Orden de Trabajo (OT)
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | |
| numero | string | OT-2024-0001 |
| fecha_ingreso | date | |
| fecha_estimada_entrega | date | |
| fecha_entrega_real | date | |
| vehiculo_id | UUID | FK a vehiculos (stock propio o externo) |
| vehiculo_externo | jsonb | Si el auto no es del stock |
| cliente_id | UUID | FK a personas |
| tipo_trabajo | enum | ver arriba |
| descripcion | text | |
| estado | enum | recibido / en_proceso / listo / entregado / cancelado |
| mecanico_id | UUID | FK a users |
| items | jsonb | Lista de trabajos + repuestos |
| mano_de_obra | decimal | |
| repuestos | decimal | |
| total | decimal | |
| observaciones | text | |
| created_at, updated_at | timestamp | |

#### 3.5.4 Funcionalidades
- Grilla de órdenes de trabajo con estado y prioridad
- Presupuesto previo a la reparación
- Control de repuestos utilizados
- Generación de factura del servicio (ARCA)
- Historial de servicios por vehículo
- Notificación de vehículo listo (WhatsApp)

---

### 3.6 Caja y Financiero

#### 3.6.1 Descripción
Control de ingresos y egresos de caja, métodos de pago, comisiones y conciliación.

#### 3.6.2 Métodos de Pago
- Efectivo (ARS / USD)
- Transferencia bancaria
- Cheque (propio / de tercero)
- Tarjeta de crédito / débito
- Depósito bancario

#### 3.6.3 Funcionalidades
- Apertura y cierre de caja diaria
- Registro de cobros vinculados a ventas o servicios
- Registro de pagos (gastos de la concesionaria)
- Gestión de cheques recibidos y emitidos
- Caja en múltiples monedas (ARS y USD)
- Tipo de cambio configurable por día
- Cuenta corriente por cliente (saldo a favor / en contra)
- Comisiones calculadas por vendedor al cerrar venta
- Reportes de caja por período

---

### 3.7 Documentos y Contratos PDF

#### 3.7.1 Documentos del sistema

**Ventas:**
- Cotización de vehículo (con detalles del auto, condiciones y validez)
- Boleto de compraventa (contrato bilateral)
- Recibo de seña (con datos del vehículo y condiciones)
- Acta de entrega / remito de vehículo
- Factura A / B / C (ARCA)

**Usados:**
- Informe de peritaje y valuación
- Acta de recepción de vehículo para consignación

**Taller:**
- Orden de trabajo (presupuesto)
- Factura de servicio técnico

**Reportes:**
- Listado de stock con precios
- Reporte de ventas por período
- Comisiones por vendedor
- Cuenta corriente de cliente

#### 3.7.2 Membrete configurable
Todos los documentos deben incluir el membrete de la concesionaria (logo, razón social, CUIT, dirección, teléfono, email, web).

---

### 3.8 Facturación Electrónica (ARCA / AFIP)

Misma integración que el proyecto de referencia via MrBot API:
- Factura A (responsables inscriptos)
- Factura B (consumidores finales)
- Factura C (monotributistas)
- Notas de crédito y débito
- CAE automático con código QR
- Almacenamiento del response completo

---

### 3.9 Consignaciones

#### 3.9.1 Descripción
Gestión de vehículos de terceros (propietarios particulares) que son puestos a la venta por la concesionaria a cambio de una comisión.

#### 3.9.2 Funcionalidades
- Ficha del propietario (consignante)
- Contrato de consignación (PDF)
- Precio piso del propietario vs. precio de venta de la concesionaria
- Liquidación al propietario al concretar la venta (monto - comisión)
- Registro del porcentaje o monto de comisión pactado
- Estado: activa / vendida / retirada por el propietario

---

### 3.10 Dashboard y Reportes

#### 3.10.1 KPIs del dashboard (tiempo real vía Supabase Realtime)
- Vehículos en stock (por tipo: nuevos / usados / consignación)
- Ventas del mes (unidades y monto)
- Leads activos por etapa
- Días promedio de inventario
- Ventas por vendedor (mes actual)
- Vehículos reservados
- Órdenes de taller abiertas
- Caja del día

#### 3.10.2 Reportes exportables (PDF + Excel)
- Ventas por período (con filtro por vendedor, tipo de vehículo, tipo de operación)
- Stock valorizado
- Comisiones por vendedor
- Leads por canal de origen
- Antigüedad del stock (días en inventario)
- Cuenta corriente de clientes
- Movimientos de caja por período
- Rentabilidad por venta (precio costo vs. precio venta)

---

## 4. Gestión de Usuarios y Roles

### 4.1 Roles
| Rol | Descripción |
|---|---|
| admin | Acceso total: configuración, reportes, precios de costo, caja, usuarios |
| vendedor | Stock (sin costo), CRM propio, ventas propias, documentos |
| cajero | Caja, cobros, pagos, sin acceso a ventas o stock |
| mecanico | Solo taller: ver y gestionar OTs asignadas |

### 4.2 Reglas de acceso
- El **precio de costo** de los vehículos solo es visible para admin
- El **precio mínimo** (piso) solo es visible para admin y vendedor asignado
- Los vendedores solo ven leads y ventas de su cartera (salvo admin)
- La cuenta corriente solo la puede gestionar cajero o admin

---

## 5. Schema de Base de Datos (Supabase / PostgreSQL)

### 5.1 Tablas principales

| Tabla | Descripción |
|---|---|
| `users` | Usuarios del sistema (via Supabase Auth) |
| `user_profiles` | Datos adicionales del usuario (rol, nombre, avatar) |
| `vehicles` | Vehículos en stock (nuevos, usados, consignación) |
| `vehicle_photos` | Fotos de cada vehículo (URL Supabase Storage) |
| `vehicle_price_history` | Historial de cambios de precio |
| `persons` | Clientes, leads y propietarios de consignación |
| `interactions` | Historial de contactos e interacciones CRM |
| `sales` | Ventas / operaciones |
| `sale_payments` | Pagos y señas de cada venta |
| `trade_ins` | Usados tomados como parte de pago |
| `consignments` | Contratos de consignación con propietarios |
| `work_orders` | Órdenes de trabajo del taller |
| `work_order_items` | Ítems (trabajos + repuestos) de cada OT |
| `cash_registers` | Cajas diarias |
| `cash_movements` | Movimientos de caja |
| `invoices` | Facturas electrónicas (ARCA) |
| `documents` | Documentos PDF generados (URL Storage) |
| `businesses` | Datos de la concesionaria (membrete, config) |
| `price_lists` | Listas de precios configurables |

### 5.2 Políticas RLS (Row Level Security)
- Todos los accesos requieren autenticación (Supabase Auth)
- `admin` puede leer/escribir todo
- `vendedor` solo lee/escribe sus propios leads y ventas
- `cajero` solo accede a tablas de caja y pagos
- `mecanico` solo accede a work_orders
- `precio_costo` y `precio_minimo` solo visibles con rol `admin`

### 5.3 Convenciones
- Todas las tablas tienen: `id UUID DEFAULT gen_random_uuid()`, `created_at`, `updated_at`, `deleted_at` (soft delete)
- Migraciones versionadas: `db/migrations/001_init.sql`, `002_vehicles.sql`, etc.
- Seeds de prueba en: `db/seeds/`
- Funciones SQL en: `db/functions/`

---

## 6. Endpoints de la API

### 6.1 Autenticación
```
POST /api/v1/auth/login           - Login email/password (Supabase)
POST /api/v1/auth/logout          - Logout
GET  /api/v1/auth/me              - Usuario actual + perfil
POST /api/v1/auth/refresh         - Refrescar token
```

### 6.2 Vehículos
```
GET    /api/v1/vehicles           - Listar con filtros y paginación
POST   /api/v1/vehicles           - Crear vehículo
GET    /api/v1/vehicles/{id}      - Detalle de vehículo
PUT    /api/v1/vehicles/{id}      - Actualizar
DELETE /api/v1/vehicles/{id}      - Soft delete
POST   /api/v1/vehicles/{id}/photos      - Subir fotos
DELETE /api/v1/vehicles/{id}/photos/{photo_id} - Eliminar foto
GET    /api/v1/vehicles/{id}/price-history - Historial de precios
POST   /api/v1/vehicles/{id}/reserve      - Reservar unidad
```

### 6.3 Personas (CRM)
```
GET    /api/v1/persons            - Listar leads/clientes
POST   /api/v1/persons            - Crear persona
GET    /api/v1/persons/{id}       - Detalle + historial
PUT    /api/v1/persons/{id}       - Actualizar
POST   /api/v1/persons/{id}/interactions  - Registrar interacción
GET    /api/v1/persons/{id}/sales         - Compras del cliente
GET    /api/v1/persons/{id}/account       - Cuenta corriente
```

### 6.4 Ventas
```
GET    /api/v1/sales              - Listar ventas
POST   /api/v1/sales              - Crear venta
GET    /api/v1/sales/{id}         - Detalle de venta
PUT    /api/v1/sales/{id}         - Actualizar
POST   /api/v1/sales/{id}/payments        - Registrar pago/seña
GET    /api/v1/sales/{id}/documents       - Documentos generados
POST   /api/v1/sales/{id}/documents/{type} - Generar PDF
```

### 6.5 Taller
```
GET    /api/v1/work-orders        - Listar OTs
POST   /api/v1/work-orders        - Crear OT
GET    /api/v1/work-orders/{id}   - Detalle
PUT    /api/v1/work-orders/{id}   - Actualizar
POST   /api/v1/work-orders/{id}/invoice   - Generar factura
```

### 6.6 Caja
```
GET    /api/v1/cash-registers     - Listar cajas
POST   /api/v1/cash-registers     - Abrir caja
PUT    /api/v1/cash-registers/{id}/close - Cerrar caja
POST   /api/v1/cash-registers/{id}/movements - Agregar movimiento
GET    /api/v1/cash-registers/{id}/movements - Listar movimientos
```

### 6.7 Consignaciones
```
GET    /api/v1/consignments       - Listar consignaciones
POST   /api/v1/consignments       - Nueva consignación
PUT    /api/v1/consignments/{id}  - Actualizar
POST   /api/v1/consignments/{id}/settle - Liquidar (al vender)
```

### 6.8 Facturación
```
POST   /api/v1/invoices           - Emitir factura electrónica
GET    /api/v1/invoices/{id}      - Consultar factura
GET    /api/v1/invoices           - Listar facturas
```

### 6.9 Dashboard y Reportes
```
GET    /api/v1/dashboard          - KPIs principales
GET    /api/v1/reports/sales      - Reporte de ventas (PDF/Excel)
GET    /api/v1/reports/stock      - Reporte de stock
GET    /api/v1/reports/commissions - Reporte de comisiones
GET    /api/v1/reports/cash       - Reporte de caja
GET    /api/v1/reports/clients    - Reporte de cuenta corriente
```

---

## 7. Reglas de Negocio Clave

1. Un vehículo no puede estar en dos ventas activas simultáneamente (bloqueo por reserva)
2. La reserva de un vehículo expira automáticamente si no se confirma en X días (configurable)
3. Al registrar una venta como "entregada": el vehículo pasa a estado "vendido" y se genera la factura automáticamente
4. Un usado tomado como parte de pago ingresa automáticamente al stock como "usado" al aceptarse la toma
5. El precio de costo nunca aparece en ningún documento generado
6. Las comisiones se calculan sobre el margen (precio venta - precio costo) con porcentaje configurable por vendedor
7. La cuenta corriente se actualiza en tiempo real al registrar pagos
8. Los documentos PDF se almacenan en Supabase Storage y no se regeneran (historial inmutable)
9. Nunca modificar una factura electrónica emitida; se debe emitir nota de crédito
10. Los precios se manejan en ARS por defecto; los vehículos pueden tener precio en USD con conversión automática

---

## 8. Integraciones Futuras (Roadmap)

- **MercadoLibre Autos:** sincronización automática de stock y precios con publicaciones
- **WhatsApp Business API:** envío de cotizaciones, recordatorios y actas de entrega
- **Infoauto / Precio Online:** valuación automática de usados por patente
- **Bancos:** conciliación automática de transferencias con pagos registrados
- **App Mobile:** versión iOS/Android para vendedores en el salón
- **Portal web público:** catálogo de stock online embebible en la web de la concesionaria

---

## 9. Variables de Entorno Requeridas

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# JWT (generado por Supabase)
JWT_SECRET=

# ARCA / MrBot
MRBOT_EMAIL=
MRBOT_API_KEY=
AFIP_CUIT=
AFIP_PUNTO_VENTA=1
AFIP_TESTING=true
AFIP_CERT_PATH=
AFIP_KEY_PATH=

# App
APP_NAME=DM Cars
DEBUG=false
FRONTEND_URL=http://localhost:5173
```

---

## 10. Decisiones de Diseño

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Supabase como DB | PostgreSQL self-hosted | Auth + Storage + Realtime out-of-the-box, menor infraestructura |
| Supabase Auth | Google OAuth propio + JWT | Delegamos seguridad, soporte multi-provider, RLS nativo |
| FastAPI Python | Node.js + Express | Equipo familiarizado con Python, generación PDF más madura |
| React + Vite + TS | Next.js | Dashboard SPA, sin necesidad de SSR, más simple |
| RLS en Supabase | Lógica de permisos en backend | Seguridad en la capa de datos, no solo en la API |
| Soft delete | Hard delete | Auditoría y trazabilidad de operaciones comerciales |
