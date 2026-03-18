# Plan de Sesiones Pendientes — DM Cars
> Generado: 2026-03-17 | Basado en auditoría completa del codebase

---

## Estado Real del Proyecto (post-auditoría)

### ✅ Completado y funcionando

| Módulo | Archivos | Notas |
|--------|----------|-------|
| Backend completo | S-01 a S-06 | 8 routers, PDFs, ARCA |
| Frontend base | layout, auth, rutas | Dark mode, Zustand, TQ |
| Stock (M01) | StockPage + 3 componentes + hook | Bugs corregidos hoy |
| CRM (M02) | CRMPage + 5 componentes + 2 hooks | Bugs corregidos hoy |
| Ventas (M03) | VentasPage + 5 componentes + hook | Completo |
| Taller (M05) | TallerPage + 3 componentes + hook | Completo |

### ❌ Stubs (placeholder "en construcción")

| Página | Archivo | Trabajo pendiente |
|--------|---------|-------------------|
| Caja | `pages/caja/CajaPage.tsx` | Implementar completo |
| Consignaciones | `pages/consignaciones/ConsignPage.tsx` | Implementar completo |
| Documentos | `pages/documentos/DocumentosPage.tsx` | Implementar completo |
| Dashboard | `pages/DashboardPage.tsx` | KPIs reales + Realtime |

### ❌ Hooks faltantes

- `hooks/useCaja.ts` — no existe
- `hooks/useConsignaciones.ts` — no existe
- `hooks/useDocumentos.ts` — no existe
- `hooks/useDashboard.ts` — no existe

### ⚠️ Tipos incompletos en `types/index.ts`

- `CashMovement` — no definido
- `PaginatedCash` — no definido
- `PaginatedConsignments` — no definido
- `Document` (PDF generado) — no definido
- `DashboardKPIs` — no definido

---

## Sesión S-10: Frontend Caja + Consignaciones

**Objetivo:** Implementar los módulos de Caja (M06) y Consignaciones (M07) completos.

**Rama:** `session/010`

---

### S-10 — Parte A: Módulo de Caja

#### Endpoints de backend disponibles
```
GET    /api/v1/cash-registers              → lista de cajas (con filtro de fecha)
POST   /api/v1/cash-registers              → abrir caja { opening_balance_ars, opening_balance_usd, usd_rate }
GET    /api/v1/cash-registers/{id}         → detalle de caja
PUT    /api/v1/cash-registers/{id}/close   → cerrar caja { closing_balance_ars }
POST   /api/v1/cash-registers/{id}/movements → agregar movimiento
GET    /api/v1/cash-registers/{id}/movements → listar movimientos de una caja
GET    /api/v1/cash-registers/summary       → resumen actual
GET    /api/v1/cash-registers/report        → reporte por período (con date_from/date_to)
```

#### Tipos a agregar en `types/index.ts`
```typescript
export interface CashMovement {
  id: string
  cash_register_id: string
  movement_type: 'ingreso' | 'egreso'
  category: string        // 'cobro_venta' | 'cobro_servicio' | 'pago_proveedor' | 'gasto_operativo' | 'otro'
  amount_ars: number
  amount_usd?: number
  payment_method: string  // 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'deposito'
  currency: 'ARS' | 'USD'
  description: string
  reference?: string      // número de comprobante, cheque, etc.
  sale_id?: string
  work_order_id?: string
  created_by_name?: string
  created_at: string
}

export interface CashRegisterDetail extends CashRegister {
  movements: CashMovement[]
  total_ingresos_ars: number
  total_egresos_ars: number
  balance_ars: number
  closed_by_name?: string
  closing_date?: string
  difference_ars?: number   // diferencia de arqueo
}

export interface PaginatedCashRegisters {
  items: CashRegister[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface CashSummary {
  today_register?: CashRegister
  balance_ars: number
  balance_usd: number
  ingresos_hoy: number
  egresos_hoy: number
  usd_rate: number
}
```

#### Archivos a crear

**`hooks/useCaja.ts`**
```
Exports:
- useCashRegisters(filters)     → lista paginada
- useCashRegister(id)           → detalle + movimientos
- useCashSummary()              → resumen del día
- useOpenCashRegister()         → mutation POST
- useCloseCashRegister(id)      → mutation PUT /close
- useAddMovement(registerId)    → mutation POST /movements
- useCajaFilters()              → estado de filtros con debounce
```

**`components/caja/OpenCashModal.tsx`**
```
Props: isOpen, onClose
Campos:
  - Saldo inicial ARS (número)
  - Saldo inicial USD (número, opcional)
  - Tipo de cambio del día (ARS por USD)
  - Observaciones
Acción: POST /cash-registers
```

**`components/caja/CloseCashModal.tsx`**
```
Props: isOpen, register: CashRegister, onClose
Campos:
  - Saldo final ARS (arqueo físico)
  - Observaciones
Muestra: diferencia entre saldo calculado y arqueo
Acción: PUT /cash-registers/{id}/close
```

**`components/caja/MovementFormModal.tsx`**
```
Props: isOpen, registerId, onClose
Campos:
  - Tipo: ingreso / egreso (toggle visual)
  - Categoría (select según tipo)
  - Monto ARS
  - Moneda: ARS/USD (si USD, muestra campo de monto USD y usa el tipo de cambio)
  - Método de pago (select)
  - Descripción (texto libre)
  - Referencia (número de cheque/comprobante, opcional)
Acción: POST /cash-registers/{id}/movements
```

**`components/caja/MovementRow.tsx`**
```
Props: movement: CashMovement
Muestra: icono ingreso/egreso coloreado, categoría, método, descripción, monto
Colores: verde para ingresos, rojo para egresos
```

**`pages/caja/CajaPage.tsx`** (reemplazar stub)
```
Estructura:
  1. Header: título + botón "Abrir caja" (si no hay caja abierta) o estado de caja activa
  2. Banner de caja activa: balance ARS, balance USD, ingresos/egresos del día
  3. Tabla de movimientos del día con paginación
  4. Botón "Registrar movimiento" (si caja abierta)
  5. Botón "Cerrar caja" (solo admin, si caja abierta)
  6. Historial de cajas anteriores (acordeón o tabla secundaria)
```

---

### S-10 — Parte B: Módulo de Consignaciones

#### Endpoints de backend disponibles
```
GET    /api/v1/consignments              → lista paginada
POST   /api/v1/consignments             → nueva consignación
GET    /api/v1/consignments/{id}        → detalle
PUT    /api/v1/consignments/{id}        → actualizar
POST   /api/v1/consignments/{id}/sell   → registrar venta { sale_price, buyer_id?, notes }
POST   /api/v1/consignments/{id}/withdraw → retiro por el propietario { reason }
POST   /api/v1/consignments/{id}/settle → pagar liquidación al propietario
```

#### Tipos a agregar en `types/index.ts`
```typescript
export interface ConsignmentDetail extends Consignment {
  vehicle_id?: string
  owner_id: string
  owner_phone?: string
  owner_email?: string
  sale_price?: number
  commission_amount?: number
  notes?: string
  withdraw_reason?: string
  updated_at: string
}

export interface PaginatedConsignments {
  items: Consignment[]
  total: number
  page: number
  per_page: number
  pages: number
}
```

#### Archivos a crear

**`hooks/useConsignaciones.ts`**
```
Exports:
- useConsignments(filters)         → lista paginada
- useConsignment(id)               → detalle
- useCreateConsignment()           → mutation POST
- useUpdateConsignment(id)         → mutation PUT
- useSellConsignment(id)           → mutation POST /sell
- useWithdrawConsignment(id)       → mutation POST /withdraw
- useSettleConsignment(id)         → mutation POST /settle
- useConsignFilters()              → filtros con debounce
```

**`components/consignaciones/ConsignFormModal.tsx`**
```
Props: consignment?, isOpen, onClose
Campos:
  - Propietario (buscador inline contra /persons)
  - Vehículo del stock (selector) O datos de vehículo externo
  - Precio piso del propietario (ARS)
  - Tipo de comisión: porcentaje / monto fijo
  - Valor de comisión
  - Notas
Acción: POST/PUT /consignments
```

**`components/consignaciones/ConsignDetailDrawer.tsx`**
```
Props: consignmentId, onClose
Secciones:
  - Datos del propietario (nombre, tel, email)
  - Info del vehículo
  - Condiciones económicas (precio piso, comisión, precio de venta sugerido)
  - Estado actual con badge
  - Botones según estado:
      · activa: "Registrar venta", "Marcar como retirado"
      · vendida: "Pagar liquidación" (si !settlement_paid)
      · botón "Ver contrato PDF" (llama a /documents/consignment/{id})
```

**`pages/consignaciones/ConsignPage.tsx`** (reemplazar stub)
```
Estructura:
  1. Header: título + contador + botón "Nueva consignación"
  2. Filtros: búsqueda, estado (activa/vendida/retirada), fecha
  3. Tabla con columnas: N° consig, propietario, vehículo, precio piso, comisión, estado, fecha inicio
  4. Click fila → abre ConsignDetailDrawer
```

---

## Sesión S-11: Frontend Documentos + Dashboard Realtime

**Objetivo:** Implementar módulo de Documentos PDF, Dashboard con KPIs reales y Supabase Realtime.

**Rama:** `session/011`

---

### S-11 — Parte A: Módulo de Documentos

#### Endpoints de backend disponibles
```
GET  /api/v1/invoices                  → lista de facturas
GET  /api/v1/invoices/{id}             → detalle factura
POST /api/v1/invoices                  → emitir factura { sale_id, invoice_type }
POST /api/v1/sales/{id}/documents/{type}      → generar PDF de venta
                                              types: cotizacion | boleto | recibo_sena | acta_entrega
POST /api/v1/work-orders/{id}/documents       → generar PDF de OT
POST /api/v1/consignments/{id}/documents      → generar contrato consignación
```

#### Tipos a agregar en `types/index.ts`
```typescript
export interface Document {
  id: string
  document_type: string   // 'cotizacion' | 'boleto' | 'recibo_sena' | 'acta_entrega' | 'orden_trabajo' | 'contrato_consig'
  related_id: string      // sale_id, work_order_id, consignment_id
  related_type: string    // 'sale' | 'work_order' | 'consignment'
  file_url: string        // URL de Supabase Storage
  generated_by_name?: string
  created_at: string
}

export interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'A' | 'B' | 'C'
  cae: string
  cae_expiry: string
  amount: number
  sale_id?: string
  work_order_id?: string
  status: 'emitida' | 'anulada'
  qr_code_base64?: string
  created_at: string
}

export interface PaginatedInvoices {
  items: Invoice[]
  total: number
  page: number
  per_page: number
  pages: number
}
```

#### Archivos a crear

**`hooks/useDocumentos.ts`**
```
Exports:
- useInvoices(filters)              → lista paginada de facturas
- useInvoice(id)                    → detalle de factura
- useEmitInvoice()                  → mutation POST /invoices
- useGenerateSaleDocument()         → mutation POST /sales/{id}/documents/{type}
- useGenerateWorkOrderDocument()    → mutation POST /work-orders/{id}/documents
- useGenerateConsignDocument()      → mutation POST /consignments/{id}/documents
```

**`pages/documentos/DocumentosPage.tsx`** (reemplazar stub)
```
Tabs:
  1. "Facturas" — tabla paginada con: N° factura, tipo (A/B/C), CAE, monto, venta asociada, estado, fecha
     - Botón "Ver factura" → abre PDF en nueva pestaña
     - Botón "Emitir factura" (admin/cajero) → emite para una venta

  2. "Documentos de Venta" — tabla de PDFs generados (cotizaciones, boletos, recibos, actas)
     - Columnas: tipo, cliente, vehículo, generado por, fecha
     - Botón "Descargar" → abre URL de Storage

  3. "OTs y Consignaciones" — PDFs de taller y contratos
```

---

### S-11 — Parte B: Dashboard con KPIs reales

#### Endpoints de backend disponibles
```
GET /api/v1/dashboard   → KPIs: { vehicles_available, vehicles_reserved,
                                   sales_this_month_count, sales_this_month_amount,
                                   leads_by_status: {...}, avg_stock_days,
                                   open_work_orders, cash_today_balance }
```

#### Tipos a agregar en `types/index.ts`
```typescript
export interface DashboardKPIs {
  vehicles_available: number
  vehicles_reserved: number
  vehicles_in_stock: number
  sales_this_month_count: number
  sales_this_month_amount: number
  leads_by_status: Record<string, number>
  avg_stock_days: number
  open_work_orders: number
  cash_today_balance: number
  top_sellers: { name: string; sales_count: number; amount: number }[]
}
```

#### Archivos a crear

**`hooks/useDashboard.ts`**
```
Exports:
- useDashboardKPIs()     → useQuery GET /dashboard (refetchInterval: 60_000)
- useRealtimeVehicles()  → suscripción Supabase Realtime a tabla 'vehicles'
- useRealtimeSales()     → suscripción Supabase Realtime a tabla 'sales'
```

Patrón de Supabase Realtime:
```typescript
import { supabase } from '@/lib/supabase'

function useRealtimeVehicles(onUpdate: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('vehicles-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vehicles'
      }, () => onUpdate())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [onUpdate])
}
```

**`components/dashboard/KPICard.tsx`**
```
Props: label, value, delta?, icon, colorClass, isLoading
Muestra: tarjeta con icono, valor grande, label, y delta opcional (↑/↓ vs mes anterior)
Skeleton cuando isLoading=true
```

**`components/dashboard/SalesChart.tsx`**
```
Gráfico de barras (Recharts BarChart) de ventas por mes
Data: últimos 6 meses (agregar endpoint GET /reports/sales?group_by=month o calcular del lado del cliente)
Props: data: { month: string; count: number; amount: number }[]
```

**`components/dashboard/LeadsFunnelChart.tsx`**
```
Gráfico de embudo horizontal mostrando leads por etapa
Data: leads_by_status del endpoint /dashboard
Muestra conteo por etapa: nuevo → contactado → interesado → en_negociacion → cerrado_ganado
```

**`components/dashboard/StockByTypeCard.tsx`**
```
Tarjeta con 3 números: nuevos / usados / consignación
Con mini barra proporcional por tipo
```

**`pages/DashboardPage.tsx`** (reemplazar stub)
```
Estructura:
  1. Fila de KPI cards (6 cards): Disponibles, Reservados, Ventas mes, OTs abiertas, Caja hoy, Leads activos
  2. Gráfico de barras de ventas (últimos 6 meses)
  3. Fila inferior: StockByTypeCard + LeadsFunnelChart + Top vendedores (tabla pequeña)
  4. Badge "Actualizado hace Xs" con botón refresh manual
  5. Supabase Realtime: invalidar queries de vehicles/sales cuando hay cambios
```

---

## Sesión S-12: Hardening

**Objetivo:** Tests, manejo de errores robusto, RUNBOOK.md.

**Rama:** `session/012`

### Tareas

#### 1. Manejo de errores global en frontend
- Componente `ErrorBoundary` en App.tsx
- Interceptor de axios: errores 401 → logout automático, errores 5xx → toast con mensaje genérico
- Página `404.tsx` y `500.tsx` para rutas no encontradas y errores inesperados

#### 2. Tests unitarios backend (Pytest)
```
backend/tests/
  test_vehicle_service.py   → crear, editar, filtrar, reservar, soft-delete
  test_sale_service.py      → calculadora francesa, máquina de estados, pagos
  test_cash_service.py      → apertura, cierre, movimientos, arqueo
  test_pdf_service.py       → generar cotización sin precio de costo
  test_auth.py              → login, roles, JWT, acceso denegado
```
Cobertura mínima: 70% en `/services/`

#### 3. Tests de integración (Pytest + httpx)
```
tests/integration/
  test_lead_to_sale.py     → flujo completo: lead → venta → factura
  test_consignment.py      → consignar → vender → liquidar
  test_work_order.py       → crear OT → agregar ítems → entregar
```

#### 4. Validaciones de borde (backend)
- Vehículo ya vendido no se puede reservar nuevamente
- Precio de venta menor al precio mínimo → advertencia (no bloquear, solo log)
- Caja ya cerrada no admite movimientos
- Factura ya emitida es inmutable (solo nota de crédito)

#### 5. RUNBOOK.md
```
Secciones:
  - Cómo iniciar el sistema en desarrollo
  - Cómo iniciar en producción (Docker Compose)
  - Cómo aplicar migraciones (supabase db push)
  - Cómo renovar certificados ARCA
  - Cómo hacer backup de Supabase Storage
  - Errores frecuentes y soluciones
  - Variables de entorno requeridas (referencia)
```

#### 6. Actualizar PROJECT_SPEC.md y CHECKLIST.md al finalizar

---

## Roadmap Visual

```
S-10 (próxima)          S-11                    S-12
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Caja            │     │ Documentos PDF  │     │ Tests >70%   │
│  - useCaja      │     │  - useDocumentos│     │ Error pages  │
│  - OpenModal    │     │  - FacturasTab  │     │ RUNBOOK.md   │
│  - CloseModal   │     │  - DocsTab      │     │ Edge cases   │
│  - MovementModal│  →  │                 │  →  │              │
│ Consignaciones  │     │ Dashboard Real  │     │ ✅ SISTEMA   │
│  - useConsign   │     │  - KPICard      │     │    COMPLETO  │
│  - ConsignForm  │     │  - SalesChart   │     │              │
│  - ConsignDrawer│     │  - Realtime     │     │              │
└─────────────────┘     └─────────────────┘     └──────────────┘
  ~3-4h de trabajo        ~3-4h de trabajo        ~2-3h de trabajo
```

---

## Dependencias entre tareas

```
S-10 no requiere nada previo — todos los endpoints backend están listos

S-11 (Documentos) puede empezar en paralelo con S-10
S-11 (Dashboard) depende de que existan datos reales → necesita S-10 completo para ver movimientos en caja

S-12 puede empezar una vez S-10 y S-11 estén completos
```

---

## Checklist de inicio para cada sesión

### Antes de empezar S-10
- [ ] Verificar que `POST /api/v1/cash-registers` responde correctamente
- [ ] Verificar que `GET /api/v1/consignments` paginado funciona
- [ ] Leer `types/index.ts` sección Caja y Consignaciones
- [ ] Agregar tipos faltantes antes de escribir hooks

### Antes de empezar S-11
- [ ] Verificar que `GET /api/v1/dashboard` responde con la estructura esperada
- [ ] Verificar que Supabase Realtime está habilitado en el proyecto
- [ ] Confirmar que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` están en el .env

### Antes de empezar S-12
- [ ] Hacer `pip install pytest pytest-asyncio httpx coverage`
- [ ] Crear `backend/tests/__init__.py` y `backend/tests/conftest.py`
- [ ] Tener un proyecto Supabase de testing separado o usar mocks

---

## Notas técnicas importantes

### Patrón de hook a seguir (igual que el resto del proyecto)

```typescript
// hooks/useCaja.ts — estructura estándar
export function useCashRegisters(filters: CajaFiltersState) {
  return useQuery({
    queryKey: ['cash-registers', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      // ... mapear filtros a params
      return apiGet<PaginatedCashRegisters>(`/cash-registers?${params}`)
    },
    placeholderData: (prev) => prev,
  })
}
```

### Reglas a respetar en todos los componentes nuevos
1. `<Modal isOpen={...}>` — nunca `open={...}`
2. Los badges de estado deben usar el patrón JSX directo (no destructurar)
3. Componentes < 200 líneas — dividir si excede
4. `precio_costo` y `precio_minimo` solo visible si `useIsAdmin()` es true
5. Debounce de 300ms en todos los buscadores
6. Loading skeletons, no spinners genéricos
7. Confirmación antes de cualquier acción destructiva (usar `ConfirmDialog`)
