import { useState } from 'react'
import { Plus, Handshake, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConsignFormModal } from '@/components/consignaciones/ConsignFormModal'
import { ConsignDetailDrawer } from '@/components/consignaciones/ConsignDetailDrawer'
import { useConsignaciones, useConsignFilters } from '@/hooks/useConsignaciones'
import type { ConsignmentStatus, CommissionType } from '@/types'

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

const STATUS_FILTER_OPTIONS = [
  { value: 'activa',   label: 'Activas' },
  { value: 'vendida',  label: 'Vendidas' },
  { value: 'retirada', label: 'Retiradas' },
]

function fmtARS(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s + 'T12:00:00').toLocaleDateString('es-AR')
}

function commissionLabel(type: CommissionType, value: number) {
  return type === 'porcentaje' ? `${value}%` : fmtARS(value)
}

export function ConsignPage() {
  const [showForm, setShowForm]   = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { filters, searchInput, handleFilter } = useConsignFilters()
  const { data, isLoading } = useConsignaciones(filters)

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1

  const hasActiveFilters = filters.status || filters.search

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Handshake className="h-6 w-6 text-brand-700 dark:text-brand-300" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Consignaciones</h1>
            <p className="text-sm text-gray-500">
              {total} contrato{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>
          Nueva consignación
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar por número, propietario o vehículo..."
            value={searchInput}
            onChange={(e) => handleFilter('search', e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-40">
          <Select
            value={filters.status}
            onChange={(e) => handleFilter('status', e.target.value)}
            options={STATUS_FILTER_OPTIONS}
            placeholder="Estado"
          />
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost" size="sm"
            leftIcon={<X className="h-4 w-4" />}
            onClick={() => { handleFilter('search', ''); handleFilter('status', '') }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">N° Contrato</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Estado</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Vehículo</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Propietario</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Precio piso</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Comisión</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Precio venta</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Liquidación</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Inicio</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                {Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                ))}
              </tr>
            ))}

            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  No se encontraron consignaciones
                </td>
              </tr>
            )}

            {!isLoading && items.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-mono text-brand-700 dark:text-brand-300 font-medium">
                  {c.consignment_number}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[200px] truncate text-gray-900 dark:text-gray-100 font-medium">
                  {c.vehicle_info ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {c.owner_name ?? '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                  {fmtARS(c.owner_floor_price)}
                </td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                  {commissionLabel(c.commission_type, c.commission_value)}
                </td>
                <td className="px-4 py-3 text-right">
                  {c.sale_price
                    ? <span className="font-semibold text-green-600 dark:text-green-400">{fmtARS(c.sale_price)}</span>
                    : <span className="text-gray-400">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-center">
                  {c.status === 'vendida' ? (
                    c.settlement_paid
                      ? <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full">Pagada</span>
                      : <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full">Pendiente</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {fmtDate(c.start_date)}
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
              onClick={() => handleFilter('page', filters.page - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm"
              disabled={filters.page >= pages}
              onClick={() => handleFilter('page', filters.page + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Modales */}
      <ConsignFormModal isOpen={showForm} onClose={() => setShowForm(false)} />
      <ConsignDetailDrawer consignId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
