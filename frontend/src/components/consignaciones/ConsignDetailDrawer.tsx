import { useState } from 'react'
import { X, FileText, CheckCircle, ChevronRight, AlertCircle, Download } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useConsignacion, useChangeConsignStatus, useMarkSettlementPaid } from '@/hooks/useConsignaciones'
import { useIsAdmin } from '@/store/authStore'
import { useGeneratePDF } from '@/hooks/usePDFs'
import type { ConsignmentStatus } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────
const STATUS_LABEL: Record<ConsignmentStatus, string> = {
  activa:   'Activa',
  vendida:  'Vendida',
  retirada: 'Retirada',
}

const STATUS_COLOR: Record<ConsignmentStatus, string> = {
  activa:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  vendida:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  retirada: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

function fmtARS(n: number | undefined | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(s: string | undefined | null) {
  if (!s) return '—'
  return new Date(s + 'T12:00:00').toLocaleDateString('es-AR')
}

interface Props {
  consignId: string | null
  onClose: () => void
}

export function ConsignDetailDrawer({ consignId, onClose }: Props) {
  const isAdmin = useIsAdmin()

  const { data: consign, isLoading } = useConsignacion(consignId)
  const changeStatus    = useChangeConsignStatus(consignId ?? '')
  const markPaid        = useMarkSettlementPaid(consignId ?? '')

  const generatePDF = useGeneratePDF()

  const [showSalePrice, setShowSalePrice] = useState(false)
  const [salePrice, setSalePrice]         = useState('')
  const [showRetireConfirm, setShowRetireConfirm] = useState(false)

  async function handleGeneratePDF() {
    if (!consignId) return
    try {
      const doc = await generatePDF.mutateAsync({
        doc_type: 'contrato_consignacion',
        reference_id: consignId,
      })
      toast.success('Contrato generado')
      window.open(doc.public_url, '_blank')
    } catch {
      toast.error('Error al generar el contrato PDF')
    }
  }

  async function handleMarkSold() {
    if (!salePrice || Number(salePrice) <= 0) { toast.error('Ingresá el precio de venta'); return }
    try {
      await changeStatus.mutateAsync({ status: 'vendida', sale_price: Number(salePrice) })
      toast.success('Consignación marcada como vendida')
      setShowSalePrice(false)
      setSalePrice('')
    } catch {
      toast.error('Error al actualizar la consignación')
    }
  }

  async function handleRetire() {
    try {
      await changeStatus.mutateAsync({ status: 'retirada' })
      toast.success('Vehículo marcado como retirado')
      setShowRetireConfirm(false)
    } catch {
      toast.error('Error al retirar la consignación')
    }
  }

  async function handleMarkPaid() {
    try {
      await markPaid.mutateAsync()
      toast.success('Liquidación marcada como pagada')
    } catch {
      toast.error('Error al actualizar')
    }
  }

  const isOpen = !!consignId

  // Calcular comisión estimada con precio de lista
  function calcCommission(basePrice: number) {
    if (!consign) return 0
    if (consign.commission_type === 'porcentaje') {
      return Math.round(basePrice * consign.commission_value / 100)
    }
    return consign.commission_value
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]" onClick={onClose} />
      )}

      <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-gray-900 shadow-2xl
        flex flex-col transition-transform duration-300
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!isOpen}
      >
        {/* Solo renderizar contenido cuando hay selección activa */}
        {isOpen && <>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-brand-600" />
            {consign ? (
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100 font-mono">
                  {consign.consignment_number}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[consign.status]}`}>
                  {STATUS_LABEL[consign.status]}
                </span>
              </div>
            ) : (
              <p className="font-semibold text-gray-500">Cargando...</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {consign && (
              <Button
                variant="outline" size="sm"
                leftIcon={<Download className="h-3.5 w-3.5" />}
                onClick={handleGeneratePDF}
                isLoading={generatePDF.isPending}
              >
                Contrato PDF
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

          {consign && (
            <>
              {/* Vehículo */}
              <section>
                <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Vehículo</h3>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {consign.vehicle_info ?? '—'}
                </p>
              </section>

              {/* Propietario */}
              <section>
                <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Propietario</h3>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{consign.owner_name ?? '—'}</p>
              </section>

              {/* Términos económicos */}
              <section>
                <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                  Términos económicos
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Precio piso (propietario)</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {fmtARS(consign.owner_floor_price)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Comisión concesionaria</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {consign.commission_type === 'porcentaje'
                        ? `${consign.commission_value}%`
                        : fmtARS(consign.commission_value)
                      }
                      {' '}
                      <span className="text-gray-400 text-xs">
                        (≈ {fmtARS(calcCommission(consign.owner_floor_price))})
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-2">
                    <span className="text-gray-500">Estimado al propietario</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      ≈ {fmtARS(consign.owner_floor_price - calcCommission(consign.owner_floor_price))}
                    </span>
                  </div>
                </div>
              </section>

              {/* Fechas */}
              <section>
                <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Fechas</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-gray-500">Inicio</span>
                  <span>{fmtDate(consign.start_date)}</span>
                  <span className="text-gray-500">Vencimiento</span>
                  <span>{fmtDate(consign.end_date)}</span>
                </div>
                {consign.end_date && new Date(consign.end_date) < new Date() && consign.status === 'activa' && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Contrato vencido
                  </div>
                )}
              </section>

              {/* Resultado de la venta (si está vendida) */}
              {consign.status === 'vendida' && (
                <section className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                  <h3 className="text-xs font-semibold uppercase text-green-700 dark:text-green-400 mb-3">
                    Resultado de venta
                  </h3>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Precio de venta</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{fmtARS(consign.sale_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Comisión cobrada</span>
                      <span className="font-medium text-brand-600">{fmtARS(consign.commission_amount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-green-200 dark:border-green-700 pt-1.5">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Liquidación propietario</span>
                      <span className="font-bold text-green-700 dark:text-green-300">{fmtARS(consign.owner_settlement)}</span>
                    </div>
                  </div>

                  {/* Estado de pago de liquidación */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {consign.settlement_paid ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                            Liquidación pagada
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                          Liquidación pendiente
                        </span>
                      )}
                    </div>
                    {!consign.settlement_paid && isAdmin && (
                      <Button size="sm" variant="secondary" onClick={handleMarkPaid} isLoading={markPaid.isPending}>
                        Marcar pagada
                      </Button>
                    )}
                  </div>
                </section>
              )}

              {/* Notas */}
              {consign.notes && (
                <section>
                  <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Notas</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    {consign.notes}
                  </p>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer — acciones */}
        {consign && consign.status === 'activa' && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            {/* Marcar como vendida */}
            {!showSalePrice && !showRetireConfirm && (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => setShowSalePrice(true)}
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                >
                  Registrar venta
                </Button>
                {isAdmin && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setShowRetireConfirm(true)}
                  >
                    Retirar
                  </Button>
                )}
              </div>
            )}

            {/* Formulario precio de venta */}
            {showSalePrice && (
              <div className="space-y-2">
                <Input
                  label="Precio de venta final (ARS)"
                  type="number" min="0" step="1" required
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="Ingresá el precio de venta"
                  helperText={
                    salePrice && Number(salePrice) < consign.owner_floor_price
                      ? '⚠ Por debajo del precio piso acordado'
                      : undefined
                  }
                />
                {salePrice && Number(salePrice) > 0 && (
                  <div className="text-xs text-gray-500 space-y-0.5 px-1">
                    <p>Comisión: <strong>{fmtARS(calcCommission(Number(salePrice)))}</strong></p>
                    <p>Al propietario: <strong className="text-green-600">{fmtARS(Number(salePrice) - calcCommission(Number(salePrice)))}</strong></p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" size="sm" onClick={() => { setShowSalePrice(false); setSalePrice('') }}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" size="sm" onClick={handleMarkSold} isLoading={changeStatus.isPending}>
                    Confirmar venta
                  </Button>
                </div>
              </div>
            )}

            {/* Confirmar retiro */}
            {showRetireConfirm && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  ¿Confirmar que el propietario retiró el vehículo?
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" size="sm" onClick={() => setShowRetireConfirm(false)}>
                    Cancelar
                  </Button>
                  <Button variant="danger" className="flex-1" size="sm" onClick={handleRetire} isLoading={changeStatus.isPending}>
                    Confirmar retiro
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        </>}
      </div>
    </>
  )
}
