import { useState } from 'react'
import { X, Pencil, CheckCircle, Car } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { TradeInFormModal } from './TradeInFormModal'
import { useTradeIn, useAcceptTradeIn, CONDITION_LABELS, CONDITION_COLORS } from '@/hooks/useTradeIns'
import { formatARS, formatDate } from '@/lib/utils'

interface Props {
  tradeInId: string | null
  onClose: () => void
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  )
}

export function TradeInDetailDrawer({ tradeInId, onClose }: Props) {
  const [showEdit, setShowEdit] = useState(false)
  const { data: tradeIn, isLoading } = useTradeIn(tradeInId)
  const accept = useAcceptTradeIn()

  async function handleAccept() {
    if (!tradeIn) return
    if (!confirm(`¿Aceptar la toma de ${tradeIn.brand} ${tradeIn.model}? El vehículo ingresará al stock.`)) return
    try {
      await accept.mutateAsync(tradeIn.id)
      toast.success('Vehículo aceptado e ingresado al stock')
    } catch {
      toast.error('Error al aceptar el vehículo')
    }
  }

  const isOpen = !!tradeInId

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />}

      <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl flex flex-col
        transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {isOpen && <>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Car className="h-5 w-5 text-brand-600" />
              <div>
                {tradeIn ? (
                  <>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {tradeIn.brand} {tradeIn.model} {tradeIn.year}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONDITION_COLORS[tradeIn.general_condition]}`}>
                      {CONDITION_LABELS[tradeIn.general_condition]}
                    </span>
                  </>
                ) : (
                  <p className="font-semibold text-gray-500">Cargando...</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tradeIn && !tradeIn.accepted && (
                <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => setShowEdit(true)}>
                  Editar
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
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-6 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />)}
              </div>
            )}

            {tradeIn && (
              <>
                {/* Estado aceptado */}
                {tradeIn.accepted && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium">Aceptado — ingresado al stock</span>
                  </div>
                )}

                {/* Datos del vehículo */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vehículo</h3>
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 space-y-2">
                    <InfoRow label="Marca / Modelo" value={`${tradeIn.brand} ${tradeIn.model}${tradeIn.version ? ` ${tradeIn.version}` : ''}`} />
                    <InfoRow label="Año" value={String(tradeIn.year)} />
                    {tradeIn.color && <InfoRow label="Color" value={tradeIn.color} />}
                    {tradeIn.plate && <InfoRow label="Patente" value={tradeIn.plate} />}
                    {tradeIn.chassis_number && <InfoRow label="N° Chasis" value={tradeIn.chassis_number} />}
                    {tradeIn.mileage != null && <InfoRow label="Kilometraje" value={`${tradeIn.mileage.toLocaleString('es-AR')} km`} />}
                    <InfoRow label="Combustible" value={tradeIn.fuel_type} />
                    <InfoRow label="Transmisión" value={tradeIn.transmission} />
                  </div>
                </section>

                {/* Estado del vehículo */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</h3>
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Condición general</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${CONDITION_COLORS[tradeIn.general_condition]}`}>
                        {CONDITION_LABELS[tradeIn.general_condition]}
                      </span>
                    </div>
                    {tradeIn.mechanical_notes && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Mecánica</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{tradeIn.mechanical_notes}</p>
                      </div>
                    )}
                    {tradeIn.cosmetic_notes && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Estética</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{tradeIn.cosmetic_notes}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Valuación */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Valuación</h3>
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 space-y-2">
                    {tradeIn.market_reference != null && (
                      <InfoRow label="Referencia de mercado" value={formatARS(tradeIn.market_reference)} />
                    )}
                    <InfoRow label="Valor ofrecido" value={formatARS(tradeIn.offered_value)} />
                  </div>
                </section>

                {tradeIn.notes && (
                  <section className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notas</p>
                    {tradeIn.notes}
                  </section>
                )}

                <p className="text-xs text-gray-400 text-right">
                  Registrado {formatDate(tradeIn.created_at)}
                </p>
              </>
            )}
          </div>

          {/* Footer — aceptar */}
          {tradeIn && !tradeIn.accepted && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                className="w-full"
                leftIcon={<CheckCircle className="h-4 w-4" />}
                onClick={handleAccept}
                isLoading={accept.isPending}
              >
                Aceptar toma e ingresar al stock
              </Button>
              <p className="text-xs text-gray-400 text-center mt-2">
                El vehículo se creará automáticamente en Stock como "usado"
              </p>
            </div>
          )}
        </>}
      </div>

      {tradeIn && showEdit && (
        <TradeInFormModal
          isOpen={showEdit}
          onClose={() => setShowEdit(false)}
          saleId={tradeIn.sale_id}
          tradeIn={tradeIn}
        />
      )}
    </>
  )
}
