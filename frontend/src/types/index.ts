// ──────────────────────────────────────────────
// Tipos del dominio DM Cars
// ──────────────────────────────────────────────

// ── Vehículos ──
export type VehicleType = 'nuevo' | 'usado' | 'consignacion'
export type VehicleStatus = 'disponible' | 'reservado' | 'vendido' | 'baja'

export interface Vehicle {
  id: string
  vehicle_type: VehicleType
  status: VehicleStatus
  brand: string
  model: string
  version?: string
  year: number
  color?: string
  mileage?: number
  plate?: string
  vin?: string
  engine?: string
  transmission?: string
  fuel_type?: string
  doors?: number
  asking_price: number
  cost_price?: number       // Solo visible para admin
  minimum_price?: number
  description?: string
  observations?: string
  consignment_id?: string
  created_at: string
  updated_at: string
  // Relaciones
  photos?: VehiclePhoto[]
  main_photo_url?: string
}

export interface VehiclePhoto {
  id: string
  vehicle_id: string
  url: string
  is_main: boolean
  order_index: number
}

// ── Personas / CRM ──
export type LeadStatus =
  | 'nuevo' | 'contactado' | 'interesado'
  | 'en_negociacion' | 'cerrado_ganado' | 'cerrado_perdido'

export type PersonType = 'cliente' | 'prospecto' | 'proveedor' | 'otro'

export interface Person {
  id: string
  person_type: PersonType
  first_name: string
  last_name?: string
  full_name?: string          // campo calculado del backend
  dni?: string
  cuit?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  province?: string
  notes?: string
  created_at: string
  updated_at: string
  // Relaciones
  leads?: Lead[]
}

export interface Lead {
  id: string
  status: LeadStatus
  source?: string
  person_id?: string
  vehicle_id?: string
  interested_description?: string
  budget_min?: number
  budget_max?: number
  next_contact_date?: string
  notes?: string
  assigned_to?: string
  created_at: string
  updated_at: string
  // Relaciones expandidas
  person?: Person
  interested_vehicle?: Vehicle
}

export interface Interaction {
  id: string
  person_id: string
  lead_id?: string
  interaction_type: 'llamada' | 'whatsapp' | 'email' | 'visita' | 'nota'
  notes: string
  created_at: string
  created_by?: string
}

// ── Ventas ──
export type SaleStatus = 'cotizacion' | 'reserva' | 'en_proceso' | 'entregada' | 'cancelada'
export type OperationType = 'contado' | 'financiado' | 'plan_ahorro' | 'combinado'

export interface SalePayment {
  id: string
  sale_id: string
  payment_type: string
  amount: number
  currency: string
  usd_rate?: number
  payment_method: string
  payment_date: string
  reference?: string
  notes?: string
  created_at: string
}

// Detalle completo (SaleOut del backend)
export interface Sale {
  id: string
  sale_number: string
  status: SaleStatus
  cancellation_reason?: string
  sale_date: string
  delivery_date?: string
  client_id: string
  client_name?: string
  vehicle_id: string
  vehicle_info?: string
  seller_id: string
  seller_name?: string
  operation_type: OperationType
  list_price: number
  sale_price: number
  discount: number
  final_price: number
  financed_amount?: number
  financing_bank?: string
  installments?: number
  installment_value?: number
  interest_rate?: number
  savings_plan_name?: string
  trade_in_id?: string
  trade_in_info?: string
  commission_amount?: number
  commission_paid: boolean
  observations?: string
  payments: SalePayment[]
  total_paid: number
  balance_due: number
  invoice_id?: string | null
  created_at: string
  updated_at: string
}

// Item resumido para listados
export interface SaleListItem {
  id: string
  sale_number: string
  status: SaleStatus
  sale_date: string
  client_name?: string
  vehicle_info?: string
  seller_name?: string
  operation_type: OperationType
  final_price: number
  total_paid: number
  created_at: string
}

export interface PaginatedSales {
  items: SaleListItem[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface FinancingResult {
  vehicle_price: number
  down_payment: number
  trade_in_value: number
  financed_amount: number
  annual_rate: number
  monthly_rate: number
  installments: number
  installment_value: number
  total_to_pay: number
  total_interest: number
  cft: number
}

// ── OT ──
export type WorkOrderStatus = 'recibido' | 'en_proceso' | 'listo' | 'entregado' | 'cancelado'
export type WorkType = 'service' | 'reparacion' | 'chapa_pintura' | 'preparacion_venta' | 'garantia' | 'otro'
export type WorkOrderItemType = 'labor' | 'part' | 'other'

export interface WorkOrderItem {
  id: string
  work_order_id: string
  item_type: WorkOrderItemType
  description: string
  part_code?: string
  quantity: number
  unit_price: number
  subtotal: number
  created_at: string
}

// Ítem resumido para listados
export interface WorkOrderListItem {
  id: string
  order_number: string
  status: WorkOrderStatus
  work_type: WorkType
  entry_date: string
  estimated_delivery_date?: string
  client_id?: string
  client_name?: string
  mechanic_id?: string
  mechanic_name?: string
  vehicle_id?: string
  vehicle_info?: string
  external_vehicle?: { brand: string; model: string; year: number; plate?: string; mileage?: number }
  labor_cost: number
  parts_cost: number
  total: number
  created_at: string
}

// Detalle completo (con ítems)
export interface WorkOrder extends WorkOrderListItem {
  description: string
  observations?: string
  actual_delivery_date?: string
  items: WorkOrderItem[]
  updated_at: string
}

export interface PaginatedWorkOrders {
  items: WorkOrderListItem[]
  total: number
  page: number
  per_page: number
  pages: number
}

// ── Caja ──
export type CashMovementType = 'ingreso' | 'egreso'
export type CashCategory =
  | 'cobro_venta' | 'cobro_servicio' | 'seña' | 'devolucion'
  | 'gasto_operativo' | 'gasto_publicidad' | 'comision'
  | 'liquidacion_consignacion' | 'otro'
export type PaymentMethod =
  | 'efectivo' | 'transferencia' | 'cheque'
  | 'tarjeta_credito' | 'tarjeta_debito' | 'deposito'

export interface CashRegister {
  id: string
  open_date: string
  opened_at: string
  closed_at?: string
  status: 'abierta' | 'cerrada'
  opening_balance_ars: number
  opening_balance_usd: number
  closing_balance_ars?: number
  closing_balance_usd?: number
  usd_rate?: number
  notes?: string
  opened_by_name?: string
  closed_by_name?: string
}

export interface CashMovement {
  id: string
  cash_register_id: string
  movement_type: CashMovementType
  category: CashCategory
  description: string
  amount: number
  currency: 'ARS' | 'USD'
  usd_rate?: number
  payment_method: PaymentMethod
  reference_type?: string
  reference_id?: string
  person_id?: string
  person_name?: string
  movement_date: string
  reference?: string
  notes?: string
  registered_by_name?: string
  created_at: string
}

export interface CashSummary {
  cash_register_id: string
  open_date: string
  status: 'abierta' | 'cerrada'
  opening_balance_ars: number
  opening_balance_usd: number
  usd_rate?: number
  total_income_ars: number
  total_income_usd: number
  total_expense_ars: number
  total_expense_usd: number
  // Calculados en frontend:
  balance_ars?: number
  balance_usd?: number
}

export interface PaginatedMovements {
  items: CashMovement[]
  total: number
  page: number
  per_page: number
  pages: number
}

// ── Consignación ──
export type ConsignmentStatus = 'activa' | 'vendida' | 'retirada'
export type CommissionType = 'porcentaje' | 'monto_fijo'

// Lista resumida
export interface ConsignmentListItem {
  id: string
  consignment_number: string
  status: ConsignmentStatus
  owner_id: string
  owner_name?: string
  vehicle_id: string
  vehicle_info?: string
  start_date: string
  end_date?: string
  owner_floor_price: number
  sale_price?: number
  commission_type: CommissionType
  commission_value: number
  commission_amount?: number
  owner_settlement?: number
  settlement_paid: boolean
  created_at: string
}

// Detalle completo
export interface Consignment extends ConsignmentListItem {
  sale_id?: string
  settlement_date?: string
  notes?: string
  contract_doc_url?: string
  updated_at: string
}

export interface PaginatedConsignments {
  items: ConsignmentListItem[]
  total: number
  page: number
  per_page: number
  pages: number
}

// ── Paginación genérica ──
export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// ── Filtros genéricos ──
export interface BaseFilters {
  search?: string
  page?: number
  per_page?: number
}
