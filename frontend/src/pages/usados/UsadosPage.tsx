import { useState } from 'react'
import { Car, ChevronRight } from 'lucide-react'
import { useTradeIns, CONDITION_LABELS, CONDITION_COLORS } from '@/hooks/useTradeIns'
import { TradeInDetailDrawer } from '@/components/usados/TradeInDetailDrawer'
import { formatARS, formatDate } from '@/lib/utils'

type FilterAccepted = 'all' | 'pending' | 'accepted'

export function UsadosPage() {
  const [filter, setFilter] = useState<FilterAccepted>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const accepted = filter === 'all' ? undefined : filter === 'accepted'
  const { data, isLoading } = useTradeIns()

  const filtered = (data ?? []).filter(t => {
    if (filter === 'pending')  return !t.accepted
    if (filter === 'accepted') return t.accepted
    return true
  })

  const filterTabs: { id: FilterAccepted; label: string }[] = [
    { id: 'all',      label: 'Todos' },
    { id: 'pending',  label: 'Pendientes' },
    { id: 'accepted', label: 'Aceptados' },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Car className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Toma de Usados</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isLoading ? 'Cargando...' : data ? `${filtered.length} registro${filtered.length !== 1 ? 's' : ''}` : 'Sin conexión al servidor'}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {filterTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`text-sm font-medium rounded-lg px-4 py-1.5 transition-colors
              ${filter === t.id
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {isLoading && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-14 bg-gray-50 dark:bg-gray-800 animate-pulse border-b border-gray-200 dark:border-gray-700 last:border-0" />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
          <Car className="h-10 w-10" />
          <p className="text-sm font-medium">
            {!data ? 'No se pudo conectar al servidor' : 'Sin tomas de usados registradas'}
          </p>
          {!data && <p className="text-xs">El backend debe estar en línea</p>}
        </div>
      )}

      {!isLoading && data && filtered.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <span className="col-span-3">Vehículo</span>
            <span className="col-span-2">Patente / Año</span>
            <span className="col-span-2">Condición</span>
            <span className="col-span-2 text-right">Valor ofrecido</span>
            <span className="col-span-2">Venta</span>
            <span className="col-span-1 text-right">Estado</span>
          </div>

          {filtered.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className="w-full grid grid-cols-12 gap-4 px-4 py-3 text-left border-b border-gray-100 dark:border-gray-700 last:border-0
                hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group"
            >
              <span className="col-span-3 text-sm font-medium text-gray-900 dark:text-white truncate">
                {t.brand} {t.model}{t.version ? ` ${t.version}` : ''}
              </span>
              <span className="col-span-2 text-sm text-gray-600 dark:text-gray-400">
                {t.plate ?? '—'} · {t.year}
              </span>
              <span className="col-span-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONDITION_COLORS[t.general_condition]}`}>
                  {CONDITION_LABELS[t.general_condition]}
                </span>
              </span>
              <span className="col-span-2 text-sm font-semibold text-gray-900 dark:text-white text-right">
                {formatARS(t.offered_value)}
              </span>
              <span className="col-span-2 text-xs text-gray-500 truncate">
                {t.sales?.sale_number ?? '—'}
              </span>
              <span className="col-span-1 flex items-center justify-end gap-1">
                {t.accepted ? (
                  <span className="text-xs text-green-600 font-medium">Aceptado</span>
                ) : (
                  <span className="text-xs text-amber-600 font-medium">Pendiente</span>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </span>
            </button>
          ))}
        </div>
      )}

      {!isLoading && data && filtered.length === 0 && data.length > 0 && (
        <p className="text-center text-sm text-gray-400 py-10">
          No hay registros con el filtro seleccionado
        </p>
      )}

      <TradeInDetailDrawer
        tradeInId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
