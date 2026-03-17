import { useState } from 'react'
import { X, Plus, Trash2, Wrench, Package, ChevronRight, Download, FileText, CheckCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { EmitirFacturaModal } from '@/components/facturacion/EmitirFacturaModal'
import { useWorkOrder, useChangeWorkOrderStatus, useAddWorkOrderItem, useDeleteWorkOrderItem } from '@/hooks/useTaller'
import { useInvoiceByRef } from '@/hooks/useInvoices'
import { useIsAdmin } from '@/store/authStore'
import { useGeneratePDF } from '@/hooks/usePDFs'
import type { WorkOrderStatus } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────
const STATUS_LABEL: Record<WorkOrderStatus, string> = {
  recibido:   'Recibido',
  en_proceso: 'En proceso',
  listo:      'Listo',
  entregado:  'Entregado',
  cancelado:  'Cancelado',
}

const STATUS_COLOR: Record<WorkOrderStatus, string> = {
  recibido:   'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  en_proceso: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  listo:      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  entregado:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelado:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const WORK_TYPE_LABEL: Record<string, string> = {
  service:           'Service',
  reparacion:        'Reparación',
  chapa_pintura:     'Chapa y pintura',
  preparacion_venta: 'Prep. venta',
  garantia:          'Garantía',
  otro:              'Otro',
}

// Transiciones válidas del estado
const NEXT_STATUS: Record<WorkOrderStatus, WorkOrderStatus | null> = {
  recibido:   'en_proceso',
  en_proceso: 'listo',
  listo:      'entregado',
  entregado:  null,
  cancelado:  null,
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('es-AR')
}

// ── Tipos de ítem ──
const ITEM_TYPE_OPTIONS = [
  { value: 'labor', label: 'Mano de obra' },
  { value: 'part',  label: 'Repuesto' },
  { value: 'other', label: 'Otro' },
]

interface Props {
  workOrderId: string | null
  onClose: () => void
}

export function WorkOrderDetailDrawer({ workOrderId, onClose }: Props) {
  const isAdmin = useIsAdmin()

  const { data: ot, isLoading } = useWorkOrder(workOrderId)
  const changeStatus  = useChangeWorkOrderStatus(workOrderId ?? '')
  const addItem       = useAddWorkOrderItem(workOrderId ?? '')
  const deleteItem    = useDeleteWorkOrderItem(workOrderId ?? '')
  const generatePDF   = useGeneratePDF()

  async function handleGeneratePDF() {
    if (!workOrderId) return
    try {
      const doc = await generatePDF.mutateAsync({
        doc_type: 'orden_trabajo',
        reference_id: workOrderId,
      })
      toast.success('Orden de trabajo generada')
      window.open(doc.public_url, '_blank')
    } catch {
      toast.error('Error al generar el PDF')
    }
  }

  // Estado para nuevo ítem
  const [showAddItem, setShowAddItem]     = useState(false)
  const [newItemType, setNewItemType]     = useState('labor')
  const [newItemDesc, setNewItemDesc]     = useState('')
  const [newItemCode, setNewItemCode]     = useState('')
  const [newItemQty, setNewItemQty]       = useState('1')
  const [newItemPrice, setNewItemPrice]   = useState('')

  // Cancelación
  const [showCancelInput, setShowCancelInput] = useState(false)
  const [cancelReason, setCancelReason]       = useState('')
  const [showFactura, setShowFactura]         = useState(false)

  const { data: invoice } = useInvoiceByRef('work_order', workOrderId)

  function resetItem() {
    setNewItemType('labor'); setNewItemDesc(''); setNewItemCode('')
    setNewItemQty('1'); setNewItemPrice(''); setShowAddItem(false)
  }

  async function handleNextStatus() {
    if (!ot) return
    const next = NEXT_STATUS[ot.status]
    if (!next) return
    try {
      await changeStatus.mutateAsync({ status: next })
      toast.success(`OT pasó a: ${STATUS_LABEL[next]}`)
    } catch {
      toast.error('Error al cambiar el estado')
    }
  }

  async function handleCancel() {
    try {
      await changeStatus.mutateAsync({ status: 'cancelado', observations: cancelReason })
      toast.success('OT cancelada')
      setShowCancelInput(false)
    } catch {
      toast.error('Error al cancelar la OT')
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemDesc.trim() || !newItemPrice) { toast.error('Completá descripción y precio'); return }
    try {
      await addItem.mutateAsync({
        item_type:   newItemType,
        description: newItemDesc,
        part_code:   newItemCode || undefined,
        quantity:    Number(newItemQty),
        unit_price:  Number(newItemPrice),
      })
      toast.success('Ítem agregado')
      resetItem()
    } catch {
      toast.error('Error al agregar ítem')
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await deleteItem.mutateAsync(itemId)
      toast.success('Ítem eliminado')
    } catch {
      toast.error('Error al eliminar ítem')
    }
  }

  const isOpen = !!workOrderId
  const nextStatus = ot ? NEXT_STATUS[ot.status] : null
  const canEdit = ot && ot.status !== 'entregado' && ot.status !== 'cancelado'

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-gray-900 shadow-2xl
          flex flex-col transition-transform duration-300
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!isOpen}
      >
        {isOpen && <>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Wrench className="h-5 w-5 text-brand-600" />
            {ot ? (
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100 font-mono">{ot.order_number}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[ot.status]}`}>
                  {STATUS_LABEL[ot.status]}
                </span>
              </div>
            ) : (
              <p className="font-semibold text-gray-500">Cargando...</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {ot && (
              <Button
                variant="outline" size="sm"
                leftIcon={<Download className="h-3.5 w-3.5" />}
                onClick={handleGeneratePDF}
                isLoading={generatePDF.isPending}
              >
                PDF OT
              </Button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {isLoading && (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {ot && (
            <>
              {/* ── Info del trabajo ── */}
              <section>
                <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                  Trabajo
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-gray-500">Tipo</span>
                  <span className="font-medium">{WORK_TYPE_LABEL[ot.work_type] ?? ot.work_type}</span>
                  <span className="text-gray-500">Ingreso</span>
                  <span>{fmtDate(ot.entry_date)}</span>
                  {ot.estimated_delivery_date && (
                    <>
                      <span className="text-gray-500">Entrega estimada</span>
                      <span>{fmtDate(ot.estimated_delivery_date)}</span>
                    </>
                  )}
                  {ot.actual_delivery_date && (
                    <>
                      <span className="text-gray-500">Entrega real</span>
                      <span>{fmtDate(ot.actual_delivery_date)}</span>
                    </>
                  )}
                  {ot.mechanic_name && (
                    <>
                      <span className="text-gray-500">Mecánico</span>
                      <span>{ot.mechanic_name}</span>
                    </>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  {ot.description}
                </p>
                {ot.observations && (
                  <p className="mt-1 text-xs text-gray-500 italic">{ot.observations}</p>
                )}
              </section>

              {/* ── Vehículo ── */}
              <section>
                <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                  Vehículo
                </h3>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {ot.vehicle_info ?? (
                    ot.external_vehicle
                      ? `${ot.external_vehicle.brand} ${ot.external_vehicle.model} ${ot.external_vehicle.year ?? ''}`
                      : '—'
                  )}
                </p>
                {ot.external_vehicle?.plate && (
                  <p className="text-xs text-gray-500 mt-0.5">Patente: {ot.external_vehicle.plate}</p>
                )}
                {ot.external_vehicle?.mileage != null && (
                  <p className="text-xs text-gray-500">
                    {ot.external_vehicle.mileage.toLocaleString('es-AR')} km
                  </p>
                )}
              </section>

              {/* ── Cliente ── */}
              {ot.client_name && (
                <section>
                  <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                    Cliente
                  </h3>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ot.client_name}</p>
                </section>
              )}

              {/* ── Ítems (mano de obra + repuestos) ── */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                    Ítems
                  </h3>
                  {canEdit && (
                    <button
                      onClick={() => setShowAddItem(v => !v)}
                      className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar
                    </button>
                  )}
                </div>

                {/* Formulario nuevo ítem */}
                {showAddItem && (
                  <form onSubmit={handleAddItem} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={newItemType}
                        onChange={(e) => setNewItemType(e.target.value)}
                        options={ITEM_TYPE_OPTIONS}
                        label="Tipo"
                      />
                      {newItemType === 'part' && (
                        <Input
                          label="Código"
                          value={newItemCode}
                          onChange={(e) => setNewItemCode(e.target.value)}
                          placeholder="Ej: OIL-5W30"
                        />
                      )}
                    </div>
                    <Input
                      label="Descripción"
                      required
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      placeholder="Ej: Cambio de aceite"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        label="Cantidad"
                        type="number" min="0.01" step="0.01"
                        value={newItemQty}
                        onChange={(e) => setNewItemQty(e.target.value)}
                      />
                      <Input
                        label="Precio unitario"
                        type="number" min="0" step="0.01"
                        required
                        value={newItemPrice}
                        onChange={(e) => setNewItemPrice(e.target.value)}
                        placeholder="15000"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={resetItem}>Cancelar</Button>
                      <Button type="submit" size="sm" isLoading={addItem.isPending}>Guardar</Button>
                    </div>
                  </form>
                )}

                {/* Lista de ítems */}
                {ot.items && ot.items.length > 0 ? (
                  <div className="space-y-1">
                    {ot.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {item.item_type === 'labor'
                            ? <Wrench className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            : <Package className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                          }
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{item.description}</p>
                            <p className="text-xs text-gray-500">
                              {item.quantity} × {fmtCurrency(item.unit_price)}
                              {item.part_code && ` · ${item.part_code}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {fmtCurrency(item.subtotal)}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">Sin ítems cargados</p>
                )}
              </section>

              {/* ── Totales ── */}
              <section className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Mano de obra</span>
                    <span>{fmtCurrency(ot.labor_cost)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Repuestos</span>
                    <span>{fmtCurrency(ot.parts_cost)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base text-gray-900 dark:text-gray-100 pt-1 border-t border-gray-200 dark:border-gray-700">
                    <span>Total</span>
                    <span>{fmtCurrency(ot.total)}</span>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer — acciones */}
        {ot && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            {/* Facturación — visible cuando la OT está entregada */}
            {ot.status === 'entregado' && (
              invoice ? (
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
                  variant="outline"
                  className="w-full"
                  leftIcon={<FileText className="h-4 w-4" />}
                  onClick={() => setShowFactura(true)}
                >
                  Emitir factura electrónica
                </Button>
              )
            )}

            {/* Avanzar estado */}
            {nextStatus && (
              <Button
                className="w-full"
                onClick={handleNextStatus}
                isLoading={changeStatus.isPending}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Pasar a: {STATUS_LABEL[nextStatus]}
              </Button>
            )}

            {/* Cancelar (solo admin, si no está en estado final) */}
            {isAdmin && ot.status !== 'entregado' && ot.status !== 'cancelado' && (
              <>
                {!showCancelInput ? (
                  <Button variant="danger" className="w-full" size="sm" onClick={() => setShowCancelInput(true)}>
                    Cancelar OT
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="Motivo de cancelación..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowCancelInput(false)}>
                        Volver
                      </Button>
                      <Button variant="danger" size="sm" className="flex-1" onClick={handleCancel} isLoading={changeStatus.isPending}>
                        Confirmar cancelación
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        </>}
      </div>

      {ot && (
        <EmitirFacturaModal
          isOpen={showFactura}
          onClose={() => setShowFactura(false)}
          referenceType="work_order"
          referenceId={ot.id}
          clientName={ot.client_name}
          totalAmount={ot.total}
        />
      )}
    </>
  )
}
