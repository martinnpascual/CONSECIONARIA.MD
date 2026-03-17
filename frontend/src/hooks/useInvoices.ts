/**
 * hooks/useInvoices.ts — Facturación ARCA (S-15)
 *
 * Gestión de facturas electrónicas via backend → MrBot → ARCA.
 * Los tipos de comprobante son: A (RI), B (CF), C (Monotributo).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'

// ── Tipos ─────────────────────────────────────────────────────────────────

export type InvoiceType = 'A' | 'B' | 'C'
export type InvoiceStatus = 'pendiente' | 'emitida' | 'error'
export type IvaCondicion =
  | 'Responsable Inscripto'
  | 'Consumidor Final'
  | 'Monotributo'
  | 'Exento'

export interface Invoice {
  id: string
  invoice_type: InvoiceType
  invoice_number: string | null
  cae: string | null
  cae_expiry_date: string | null
  punto_venta: number
  emisor_cuit: string
  receptor_cuit: string | null
  receptor_name: string
  receptor_iva_cond: string
  reference_type: 'sale' | 'work_order'
  reference_id: string
  net_amount: number
  iva_amount: number
  total_amount: number
  status: InvoiceStatus
  error_message: string | null
  qr_url: string | null
  invoice_date: string
  created_by: string
  created_at: string
  created_by_name?: string
}

export interface EmitirFacturaRequest {
  reference_type: 'sale' | 'work_order'
  reference_id: string
  invoice_type: InvoiceType
  receptor_name?: string
  receptor_cuit?: string
  receptor_iva_cond?: IvaCondicion
  total_amount?: number
  net_amount?: number
  iva_amount?: number
  description?: string
}

// ── Hooks ─────────────────────────────────────────────────────────────────

/** Factura vinculada a una venta u OT específica */
export function useInvoiceByRef(referenceType: 'sale' | 'work_order', referenceId: string | null) {
  return useQuery({
    queryKey: ['invoice', referenceType, referenceId],
    queryFn: async () => {
      const list = await apiGet<{ data: Invoice[] }>(
        `/documents/invoices?reference_type=${referenceType}&reference_id=${referenceId}`
      )
      return list.data?.[0] ?? null
    },
    enabled: !!referenceId,
    staleTime: 30_000,
  })
}

/** Emitir una nueva factura electrónica */
export function useEmitirFactura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EmitirFacturaRequest) =>
      apiPost<Invoice>('/documents/invoices', data),
    onSuccess: (invoice) => {
      // Invalidar la query de la factura del reference específico
      qc.invalidateQueries({ queryKey: ['invoice', invoice.reference_type, invoice.reference_id] })
      // Invalidar la lista de ventas/OTs para reflejar el cambio de invoice_id
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })
}
