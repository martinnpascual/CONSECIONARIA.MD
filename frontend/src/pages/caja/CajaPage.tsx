import { useState } from 'react'
import { Plus, Minus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { OpenCashPanel, CashSummaryPanel } from '@/components/caja/CashRegisterPanel'
import { MovementFormModal } from '@/components/caja/MovementFormModal'
import {
  useActiveCashRegister, useCashSummary,
  useCashMovements, useMovementsFilters
} from '@/hooks/useCaja'
import type { CashCategory, PaymentMethod } from '@/types'

// ── Labels ────────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<CashCategory, string> = {
  cobro_venta:              'Cobro venta',
  cobro_servicio:           'Cobro servicio',
  seña:                     'Seña',
  devolucion:               'Devolución',
  gasto_operativo:          'Gasto operativo',
  gasto_publicidad:         'Publicidad',
  comision:                 'Comisión',
  liquidacion_consignacion: 'Liquidación consig.',
  otro:                     'Otro',
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  efectivo:        'Efectivo',
  transferencia:   'Transferencia',
  cheque:          'Cheque',
  tarjeta_credito: 'Tarj. crédito',
  tarjeta_debito:  'Tarj. débito',
  deposito:        'Depósito',
}

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}
function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('es-AR')
}

const CATEGORY_FILTER_OPTIONS = [
  { value: 'cobro_venta',              label: 'Cobro venta' },
  { value: 'cobro_servicio',           label: 'Cobro servicio' },
  { value: 'seña',                     label: 'Seña' },
  { value: 'devolucion',               label: 'Devolución' },
  { value: 'gasto_operativo',          label: 'Gasto operativo' },
  { value: 'gasto_publicidad',         label: 'Publicidad' },
  { value: 'comision',                 label: 'Comisión' },
  { value: 'liquidacion_consignacion', label: 'Liquidación consig.' },
  { value: 'otro',                     label: 'Otro' },
]

export function CajaPage() {
  const [showMovForm, setShowMovForm]       = useState(false)
  const [defaultMovType, setDefaultMovType] = useState<'ingreso' | 'egreso'>('ingreso')

  const { data: register, isLoading: loadingRegister, isError: errorRegister, refetch: refetchRegister } =
    useActiveCashRegister()

  const { data: summary } = useCashSummary(register?.id)

  const { filters, setFilter } = useMovementsFilters(register?.id)
  const { data: movData, isLoading: loadingMovs } = useCashMovements(filters)

  const movements = movData?.items ?? []
  const totalMovs = movData?.total ?? 0
  const pages     = movData?.pages ?? 1

  function openMovModal(type: 'ingreso' | 'egreso') {
    setDefaultMovType(type)
    setShowMovForm(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-brand-700 dark:text-brand-300" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caja</h1>
            <p className="text-sm text-gray-500">Movimientos del día</p>
          </div>
        </div>

        {register && (
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              leftIcon={<Minus className="h-4 w-4" />}
              onClick={() => openMovModal('egreso')}
            >
              Egreso
            </Button>
            <Button
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => openMovModal('ingreso')}
            >
              Ingreso
            </Button>
          </div>
        )}
      </div>

      {/* Cargando */}
      {loadingRegister && (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error de red — backend no disponible */}
      {!loadingRegister && errorRegister && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <Wallet className="h-10 w-10" />
          <p className="text-sm font-medium">No se pudo conectar al servidor</p>
          <button
            onClick={() => refetchRegister()}
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Sin caja abierta */}
      {!loadingRegister && !errorRegister && !register && (
        <OpenCashPanel onOpened={() => refetchRegister()} />
      )}

      {/* Caja abierta */}
      {!loadingRegister && !errorRegister && register && (
        <>
          <CashSummaryPanel
            register={register}
            summary={summary}
            onClosed={() => refetchRegister()}
          />

          {/* Filtros de movimientos */}
          <div className="flex flex-wrap gap-3 items-center">
            <Select
              value={filters.movement_type ?? ''}
              onChange={(e) => setFilter('movement_type', e.target.value)}
              options={[
                { value: 'ingreso', label: 'Ingresos' },
                { value: 'egreso',  label: 'Egresos' },
              ]}
              placeholder="Todos"
            />
            <Select
              value={filters.category ?? ''}
              onChange={(e) => setFilter('category', e.target.value)}
              options={CATEGORY_FILTER_OPTIONS}
              placeholder="Categoría"
            />
            <span className="text-sm text-gray-500 ml-auto">
              {totalMovs} movimiento{totalMovs !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Tabla de movimientos */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Descripción</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Categoría</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Método</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Ingreso</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Egreso</th>
                </tr>
              </thead>
              <tbody>
                {loadingMovs && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))}

                {!loadingMovs && movements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                      Sin movimientos registrados en esta caja
                    </td>
                  </tr>
                )}

                {!loadingMovs && movements.map((mov) => (
                  <tr
                    key={mov.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {fmtDate(mov.movement_date)}
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{mov.description}</p>
                      {mov.reference && (
                        <p className="text-xs text-gray-400">Ref: {mov.reference}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {CATEGORY_LABEL[mov.category] ?? mov.category}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {METHOD_LABEL[mov.payment_method] ?? mov.payment_method}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {mov.movement_type === 'ingreso' ? (
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {mov.currency === 'USD' ? fmtUSD(mov.amount) : fmtARS(mov.amount)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {mov.movement_type === 'egreso' ? (
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {mov.currency === 'USD' ? fmtUSD(mov.amount) : fmtARS(mov.amount)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {pages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Página {filters.page} de {pages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"
                  disabled={filters.page <= 1}
                  onClick={() => setFilter('page', filters.page - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm"
                  disabled={filters.page >= pages}
                  onClick={() => setFilter('page', filters.page + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal nuevo movimiento */}
      {register && (
        <MovementFormModal
          isOpen={showMovForm}
          onClose={() => setShowMovForm(false)}
          cashRegisterId={register.id}
          usdRate={register.usd_rate}
          defaultType={defaultMovType}
        />
      )}
    </div>
  )
}
