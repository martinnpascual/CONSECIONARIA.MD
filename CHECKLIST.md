# CHECKLIST — DM Cars

## S-00: Estructura base del proyecto ✅

- [x] Crear estructura de carpetas del repositorio
- [x] `PRD.md` — Especificación completa del sistema
- [x] `AGENTS.md` — Definición de agentes de desarrollo
- [x] `PROJECT_SPEC.md` — Spec vivo del proyecto para Dev Manager
- [x] `.claude/CLAUDE.md` — Instrucciones del agente
- [x] `.env.example` — Variables de entorno documentadas
- [x] `docker-compose.yml` — Orquestación de servicios
- [x] `README.md` — Guía de inicio rápido
- [x] `CHECKLIST.md` — Este archivo
- [x] `.gitignore` — Ignorar .env, certs, node_modules, __pycache__

---

## S-01: Migraciones Supabase + RLS ✅

- [x] `001_init.sql` — Tablas: user_profiles, businesses + funciones helper (get_my_role, handle_new_user)
- [x] `002_vehicles.sql` — Tablas: vehicles, vehicle_photos, vehicle_price_history + vista v_vehicles_public
- [x] `003_persons_crm.sql` — Tablas: persons, interactions, person_vehicle_interests
- [x] `004_sales.sql` — Tablas: sales, sale_payments, trade_ins + triggers de lógica de negocio
- [x] `005_work_orders.sql` — Tablas: work_orders, work_order_items + triggers de totales automáticos
- [x] `006_cash.sql` — Tablas: cash_registers, cash_movements + vista v_cash_summary
- [x] `007_consignments.sql` — Tabla: consignments + trigger de liquidación automática
- [x] `008_invoices.sql` — Tablas: invoices, documents
- [x] `009_rls_policies.sql` — 35 políticas RLS por rol + buckets Storage (vehicle-photos, documents)
- [x] `seeds/001_seed_data.sql` — 7 vehículos, 5 personas/leads, 1 consignación, interacciones CRM

---

## S-02: Backend — Auth + Vehículos ✅

- [x] `backend/app/main.py` — Entry point FastAPI + CORS + lifespan
- [x] `backend/app/config.py` — Configuración pydantic-settings desde .env
- [x] `backend/app/supabase_client.py` — Cliente admin (service role) y anon
- [x] `backend/app/utils/security.py` — Validación JWT + dependencias por rol (require_admin, etc.)
- [x] `backend/app/routers/auth.py` — GET /me, PUT /me, GET /users, POST /users, PUT /users/{id}
- [x] `backend/app/routers/vehicles.py` — CRUD completo (10 endpoints)
- [x] `backend/app/services/vehicle_service.py` — Lógica de vehículos con filtros avanzados
- [x] `backend/app/schemas/vehicle_schemas.py` — VehiclePublic, VehicleAdmin, VehicleCreate, VehicleUpdate, filtros, paginación
- [x] Upload de fotos a Supabase Storage (validación de tipo y tamaño)
- [x] Endpoint de reserva de vehículo con validación de estado
- [x] `backend/requirements.txt` y `backend/Dockerfile`

---

## S-03: Backend — CRM ✅

- [x] `backend/app/schemas/person_schemas.py` — PersonCreate/Update/Out, InteractionCreate/Out, KanbanBoard/Card/Column, AccountStatement, filtros
- [x] `backend/app/services/person_service.py` — CRUD, Kanban agrupado, interacciones, vehículos de interés, historial de ventas, cuenta corriente
- [x] `backend/app/routers/persons.py` — 11 endpoints: CRUD + Kanban + interacciones + intereses + historial + cuenta corriente
- [x] Búsqueda global por nombre/DNI/teléfono/email con debounce en el schema
- [x] Avance automático de estado: 'nuevo' → 'contactado' al registrar primera interacción
- [x] Kanban con última interacción, días sin contacto y vehículos de interés por tarjeta
- [x] Registrado en main.py (v0.3.0)

---

## S-04: Backend — Ventas ✅

- [x] `backend/app/schemas/sale_schemas.py` — FinancingRequest/Result, TradeInCreate/Update/Out, PaymentCreate/Out, SaleCreate/Update/Out, SaleStatusUpdate, SaleListItem, SaleFilters, PaginatedSales, CommissionSummary
- [x] `backend/app/services/sale_service.py` — Calculadora francesa, CRUD, gestión de pagos, trade-in, comisiones
- [x] `backend/app/routers/sales.py` — 14 endpoints: calculadora + CRUD + pagos + trade-in + comisiones
- [x] Máquina de estados validada: cotizacion → reserva → en_proceso → entregada | cancelada
- [x] Calculadora de financiamiento sistema francés (cuota fija)
- [x] Gestión de pagos y señas: primera seña avanza a 'reserva' automáticamente
- [x] Toma de usados: registrar, actualizar, aceptar (da de alta al stock)
- [x] Al entregar: vehículo cambia a 'vendido', lead avanza a 'cerrado_ganado'
- [x] Cálculo de comisiones por margen (configurable en tabla businesses)
- [x] Registrado en main.py (v0.4.0)

---

## S-05: Backend — Taller + Caja + Consignaciones ✅

- [x] `backend/app/schemas/work_order_schemas.py` — WorkOrderCreate/Update/Out, WorkOrderItemCreate/Out, ExternalVehicle, filtros, paginación
- [x] `backend/app/services/work_order_service.py` — CRUD, máquina de estados, ítems, totales automáticos vía trigger
- [x] `backend/app/routers/work_orders.py` — 9 endpoints: CRUD + estado + ítems
- [x] `backend/app/schemas/cash_schemas.py` — CashRegisterOpen/Close/Out, CashMovementCreate/Out, CashSummary, CashPeriodReport
- [x] `backend/app/services/cash_service.py` — Apertura/cierre, movimientos, resumen, reporte por período. Multi-moneda ARS/USD
- [x] `backend/app/routers/cash.py` — 9 endpoints: registros + movimientos + resumen + reporte
- [x] `backend/app/schemas/consignment_schemas.py` — ConsignmentCreate/Update/Out, ConsignmentSell, ConsignmentSettlementPay
- [x] `backend/app/services/consignment_service.py` — CRUD, venta (con validación de precio mínimo), retiro, liquidación al propietario
- [x] `backend/app/routers/consignments.py` — 8 endpoints: CRUD + venta + retiro + liquidación
- [x] Liquidación automática al propietario (trigger DB) al marcar como vendida
- [x] Registrados en main.py (v0.5.0)

---

## S-06: Backend — PDFs + Facturación ARCA ✅

- [x] `backend/app/templates/base.html` — Membrete configurable (CSS WeasyPrint A4)
- [x] `backend/app/templates/cotizacion.html` — Cotización con financiamiento y firma
- [x] `backend/app/templates/boleto_compraventa.html` — Contrato bilateral con cláusulas legales
- [x] `backend/app/templates/recibo_sena.html` — Recibo de seña/pago con detalle
- [x] `backend/app/templates/acta_entrega.html` — Acta de entrega con checklist de accesorios
- [x] `backend/app/templates/orden_trabajo.html` — OT con ítems, totales y autorización
- [x] `backend/app/templates/contrato_consignacion.html` — Mandato de venta con cláusulas
- [x] `backend/app/services/pdf_service.py` — WeasyPrint + Jinja2, upload Storage, registro en `documents`
- [x] `backend/app/services/mrbot_service.py` — Cliente MrBot API con retry (FECAESolicitar, último comprobante)
- [x] `backend/app/services/invoice_service.py` — Emisión Factura A/B/C, CAE, QR AFIP base64, inmutabilidad
- [x] `backend/app/schemas/invoice_schemas.py` — InvoiceRequest/Out, DocumentRequest/Out, filtros
- [x] `backend/app/routers/invoices.py` — 5 endpoints: facturas + PDFs
- [x] Registrado en main.py (v0.6.0)

---

## S-07: Frontend — Base + Stock ✅

- [x] `frontend/package.json` — React 18 + Vite + TailwindCSS + Zustand + TanStack Query
- [x] `frontend/vite.config.ts` — alias `@`, proxy `/api` → backend
- [x] `frontend/tailwind.config.js` — `darkMode: 'class'`, colores `brand`
- [x] `frontend/src/lib/supabase.ts` — cliente Supabase
- [x] `frontend/src/lib/api.ts` — axios + interceptors JWT + helpers apiGet/Post/Put/Patch/Delete
- [x] `frontend/src/lib/utils.ts` — cn, formatARS, formatDate, debounce
- [x] `frontend/src/store/authStore.ts` — Zustand persist + initialize() + refreshProfile()
- [x] `frontend/src/types/index.ts` — tipos de dominio completos
- [x] `frontend/src/components/ui/` — Badge, Button, Input/Select, Modal/ConfirmDialog, Skeleton
- [x] `frontend/src/components/layout/Sidebar.tsx` — colapsable, filtrado por rol
- [x] `frontend/src/components/layout/Header.tsx` — breadcrumb + dark mode + avatar
- [x] `frontend/src/components/layout/MainLayout.tsx` — outlet protegido con guard de sesión
- [x] `frontend/src/pages/LoginPage.tsx` — formulario Supabase Auth
- [x] `frontend/src/App.tsx` — rutas lazy por módulo
- [x] `frontend/src/main.tsx` — QueryClient + Toaster + BrowserRouter
- [x] `frontend/src/index.css` — TailwindCSS base + dark mode
- [x] `frontend/src/hooks/useVehicles.ts` — useVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle, useDebouncedFilters
- [x] `frontend/src/components/stock/VehicleCard.tsx` — tarjeta con foto, status badge, precio costo solo admin
- [x] `frontend/src/components/stock/VehicleFilters.tsx` — filtros con debounce 300ms
- [x] `frontend/src/components/stock/VehicleFormModal.tsx` — crear/editar vehículo, cost_price solo admin
- [x] `frontend/src/pages/stock/StockPage.tsx` — grilla paginada + modal form + confirm delete
- [x] `frontend/Dockerfile` — multi-stage: dev (hot-reload) + production (nginx)
- [x] `frontend/nginx.conf` — SPA fallback + gzip + cache de assets

---

## S-08: Frontend — CRM ✅

- [x] `frontend/src/types/index.ts` — Tipos `Person`, `Lead`, `Interaction` actualizados con todos los campos
- [x] `frontend/src/hooks/useLeads.ts` — useLeads, useLeadKanban, useLead, useCreateLead, useUpdateLead, useMoveLead, useDeleteLead; `groupByStatus()` para Kanban
- [x] `frontend/src/hooks/usePersons.ts` — usePersons, usePerson, useCreatePerson, useUpdatePerson, useDeletePerson, useInteractions, useCreateInteraction
- [x] `frontend/src/components/crm/LeadCard.tsx` — tarjeta Kanban con fuente, vehículo de interés, contacto, próximo contacto
- [x] `frontend/src/components/crm/LeadKanban.tsx` — DragDropContext con @hello-pangea/dnd, 6 columnas coloreadas por estado, indicador de dragging
- [x] `frontend/src/components/crm/LeadFormModal.tsx` — crear lead (con datos de persona inline) o editar; fuente, presupuesto min/max, próximo contacto, notas
- [x] `frontend/src/components/crm/PersonFormModal.tsx` — crear/editar persona completa (nombre, contacto, DNI, CUIT, dirección)
- [x] `frontend/src/components/crm/InteractionTimeline.tsx` — historial cronológico con iconos por tipo; formulario inline para registrar nueva interacción
- [x] `frontend/src/pages/crm/PersonDetailPage.tsx` — ficha completa: avatar, datos de contacto, lista de leads, timeline de interacciones
- [x] `frontend/src/pages/crm/CRMPage.tsx` — router interno; toggle Kanban / lista de personas; search con debounce en ambas vistas

---

## S-09: Frontend — Ventas ✅

- [x] `frontend/src/types/index.ts` — Tipos `Sale`, `SaleListItem`, `PaginatedSales`, `SalePayment`, `FinancingResult` actualizados con todos los campos del backend
- [x] `frontend/src/hooks/useSales.ts` — useSales, useSale, useCreateSale, useUpdateSale, useChangeSaleStatus, useAddPayment, useCalculateFinancing, useSaleFilters
- [x] `frontend/src/components/ventas/SaleFilters.tsx` — búsqueda, estado, tipo de operación, rango de fechas con debounce 300ms
- [x] `frontend/src/components/ventas/FinancingCalculator.tsx` — calculadora sistema francés: entrega, toma de usado, TNA, cuotas; muestra CFT y botón "Aplicar a la venta"
- [x] `frontend/src/components/ventas/SaleFormModal.tsx` — nueva venta con buscador de cliente y vehículo (inline dropdown), tipo de operación, precio, descuento, campos de financiamiento opcionales, calculadora integrada
- [x] `frontend/src/components/ventas/PaymentFormModal.tsx` — registro de pago: tipo, monto, moneda (ARS/USD), método, fecha, referencia
- [x] `frontend/src/components/ventas/SaleDetailDrawer.tsx` — drawer lateral con datos completos, resumen financiero, historial de pagos, avance de estado y cancelación (admin)
- [x] `frontend/src/pages/ventas/VentasPage.tsx` — tabla paginada con filtros, columnas: N° venta, cliente, vehículo, estado badge, tipo, precio final, saldo; click abre drawer

---

## S-10 a S-11: Frontend — Módulos restantes 🔲

- [ ] Módulo de Taller: grilla de OTs + cambio de estado
- [ ] Módulo de Caja: apertura/cierre + movimientos
- [ ] Módulo de Consignaciones: lista + liquidación
- [ ] Módulo de Documentos: lista de PDFs + descarga + facturación
- [ ] Dashboard con KPIs (Supabase Realtime)
- [ ] Páginas de reportes con exportación a PDF/Excel

---

## S-12: Hardening 🔲

- [ ] Tests unitarios backend (cobertura >70% en services)
- [ ] Tests de integración de endpoints principales
- [ ] Tests de flujo completo: lead → venta → factura
- [ ] Manejo de errores estandarizado
- [ ] Validaciones de borde (vehículo ya vendido, precio debajo del mínimo, etc.)
- [ ] `RUNBOOK.md` — Guía de operación y resolución de problemas

---

## Pendientes Transversales

- [ ] Configuración de notificaciones WhatsApp (futuro)
- [ ] Integración MercadoLibre Autos (futuro)
- [ ] App mobile (futuro)
- [ ] Portal web público de stock (futuro)
