import { useState } from 'react'
import { X, Plus, Truck, XCircle, FileText, CheckCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { saleStatusBadge } from '@/components/ui/Badge'
import { PaymentFormModal } from './PaymentFormModal'
import { EmitirFacturaModal } from '@/components/facturacion/EmitirFacturaModal'
import { useSale, useChangeSaleStatus } from '@/hooks/useSales'
import { useInvoiceByRef } from '@/hooks/useInvoices'
import { formatARS, formatDate } from '@/lib/utils'
import { useIsAdmin } from '@/store/authStore'

const STATUS_FLOW: Record<string, { next: string; label: string } | null> = {
  cotizacion: { next: 'reserva',     label: 'Pasar a Reserva' },
  reserva:    { next: 'en_proceso',  label: 'Pasar a En proceso' },
  en_proceso: { next: 'entregada',   label: 'Marcar como Entregada' },
  entregada:  null,
  cancelada:  null,
}

interface Props {
  saleId: string | null
  onClose: () => void
}

export function SaleDetailDrawer({ saleId, onClose }: Props) {
  const [showPayment, setShowPayment] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelInput, setShowCancelInput] = useState(false)
  const [showFactura, setShowFactura] = useState(false)

  const isAdmin = useIsAdmin()
  const { data: sale, isLoading } = useSale(saleId)
  const changeStatus = useChangeSaleStatus()
  const { data: invoice } = useInvoiceByRef('sale', saleId)

  async function advanceStatus() {
    if (!sale) return
    const next = STATUS_FLOW[sale.status]
    if (!next) return
    try {
      await changeStatus.mutateAsync({ id: sale.id, status: next.next })
      toast.success(`Estado actualizado: ${next.next.replace('_', ' ')}`)
    } catch {
      toast.error('Error al cambiar el estado')
    }
  }

  async function cancelSale() {
    if (!sale) return
    try {
      await changeStatus.mutateAsync({
        id: sale.id,
        status: 'cancelada',
        cancellation_reason: cancelReason || undefined,
      })
      toast.success('Venta cancelada')
      setShowCancelInput(false)
    } catch {
      toast.error('Error al cancelar la venta')
    }
  }

  if (!saleId) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {sale ? `Venta ${sale.sale_number}` : 'Cargando...'}
            </h2>
            {sale && saleStatusBadge(sale.status)}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {isLoading && (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-6 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />)}
            </div>
          )}

          {sale && (
            <>
              {/* Datos generales */}
              <section className="space-y-2 text-sm">
                <h3 className="font-medium text-gray-500 uppercase tracking-wide text-xs">Datos de la venta</h3>
                <Row label="Vehículo" value={sale.vehicle_info ?? '—'} />
                <Row label="Cliente" value={sale.client_name ?? '—'} />
                <Row label="Vendedor" value={sale.seller_name ?? '—'} />
                <Row label="Tipo de operación" value={sale.operation_type.replace('_', ' ')} />
                <Row label="Fecha" value={formatDate(sale.sale_date)} />
                {sale.delivery_date && <Row label="Entrega" value={formatDate(sale.delivery_date)} />}
              </section>

              {/* Resumen financiero */}
              <section className="space-y-2 text-sm">
                <h3 className="font-medium text-gray-500 uppercase tracking-wide text-xs">Financiero</h3>
                <Row label="Precio lista" value={formatARS(sale.list_price)} />
                <Row label="Precio venta" value={formatARS(sale.sale_price)} />
                {sale.discount > 0 && <Row label="Descuento" value={`- ${formatARS(sale.discount)}`} />}
                <Row label="Precio final" value={formatARS(sale.final_price)} bold />
                {sale.financed_amount && <Row label="Monto financiado" value={formatARS(Number(sale.financed_amount))} />}
                {sale.installments && <Row label="Cuotas" value={`${sale.installments} × ${formatARS(Number(sale.installment_value))}`} />}
                {sale.financing_bank && <Row label="Banco" value={sale.financing_bank} />}
                <Row label="Total pagado" value={formatARS(sale.total_paid)} />
                <Row label="Saldo pendiente" value={formatARS(sale.balance_due)}
                  className={sale.balance_due > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'} />
              </section>

              {/* Pagos */}
              {sale.payments.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-medium text-gray-500 uppercase tracking-wide text-xs">Pagos registrados</h3>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
                    {sale.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium capitalize">{p.payment_type.replace('_', ' ')}</span>
                          <span className="text-gray-400 ml-2">{p.payment_method}</span>
                          <span className="text-gray-400 ml-2">{formatDate(p.payment_date)}</span>
                        </div>
                        <span className="font-semibold">{formatARS(Number(p.amount))} {p.currency !== 'ARS' && p.currency}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {sale.observations && (
                <section className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <p className="font-medium text-gray-500 text-xs uppercase tracking-wide mb-1">Observaciones</p>
                  {sale.observations}
                </section>
              )}
            </>
          )}
        </div>

        {/* Facturación — visible cuando la venta está entregada */}
        {sale && sale.status === 'entregada' && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            {invoice ? (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-green-700 dark:text-green-400 font-medium">
                  Factura {invoice.invoice_type} emitida
                </span>
                <span className="text-gray-400 ml-auto font-mono text-xs">
                  CAE: {invoice.cae}
                </span>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                leftIcon={<FileText className="h-4 w-4" />}
                onClick={() => setShowFactura(true)}
                className="w-full"
              >
                Emitir factura electrónica
              </Button>
            )}
          </div>
        )}

        {/* Acciones */}
        {sale && !['entregada', 'cancelada'].includes(sale.status) && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex gap-2">
              <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setShowPayment(true)}>
                Registrar pago
              </Button>

              {STATUS_FLOW[sale.status] && (
                <Button size="sm" variant="outline"
                  leftIcon={<Truck className="h-4 w-4" />}
                  onClick={advanceStatus}
                  isLoading={changeStatus.isPending}
                  disabled={sale.status === 'en_proceso' && !isAdmin}
                >
                  {STATUS_FLOW[sale.status]!.label}
                </Button>
              )}

              {isAdmin && (
                <Button size="sm" variant="ghost"
                  leftIcon={<XCircle className="h-4 w-4" />}
                  onClick={() => setShowCancelInput((v) => !v)}
                >
                  Cancelar
                </Button>
              )}
            </div>

            {showCancelInput && (
              <div className="flex gap-2 items-end">
                <input
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Motivo de cancelación (opcional)"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <Button size="sm" variant="danger" onClick={cancelSale}
                  isLoading={changeStatus.isPending}>
                  Confirmar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {sale && showPayment && (
        <PaymentFormModal
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          saleId={sale.id}
          balanceDue={sale.balance_due}
        />
      )}

      {sale && (
        <EmitirFacturaModal
          isOpen={showFactura}
          onClose={() => setShowFactura(false)}
          referenceType="sale"
          referenceId={sale.id}
          clientName={sale.client_name}
          totalAmount={sale.final_price}
        />
      )}
    </>
  )
}

function Row({ label, value, bold, className }: {
  label: string; value: string; bold?: boolean; className?: string
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? 'font-semibold' : ''} ${className ?? ''}`}>{value}</span>
    </div>
  )
}
