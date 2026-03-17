import { useState } from 'react'
import { Plus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { TallerFilters } from '@/components/taller/TallerFilters'
import { WorkOrderFormModal } from '@/components/taller/WorkOrderFormModal'
import { WorkOrderDetailDrawer } from '@/components/taller/WorkOrderDetailDrawer'
import { useWorkOrders, useTallerFilters } from '@/hooks/useTaller'
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

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('es-AR')
}

export function TallerPage() {
  const [showForm, setShowForm]               = useState(false)
  const [selectedOTId, setSelectedOTId]       = useState<string | null>(null)

  const { filters, searchInput, handleFilter } = useTallerFilters()
  const { data, isLoading }                    = useWorkOrders(filters)

  const orders = data?.items ?? []
  const total  = data?.total ?? 0
  const pages  = data?.pages ?? 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-brand-700 dark:text-brand-300" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Taller</h1>
            <p className="text-sm text-gray-500">
              {total} orden{total !== 1 ? 'es' : ''} encontrada{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>
          Nueva OT
        </Button>
      </div>

      {/* Filtros */}
      <TallerFilters filters={filters} searchInput={searchInput} onFilter={handleFilter} />

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">N° OT</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Estado</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Tipo</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Vehículo</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Mecánico</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Ingreso</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}

            {!isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  No se encontraron órdenes de trabajo
                </td>
              </tr>
            )}

            {!isLoading && orders.map((ot) => {
              const vehicleInfo = ot.vehicle_info
                ?? (ot.external_vehicle
                  ? `${ot.external_vehicle.brand} ${ot.external_vehicle.model} ${ot.external_vehicle.year ?? ''}`
                  : '—')

              return (
                <tr
                  key={ot.id}
                  onClick={() => setSelectedOTId(ot.id)}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-brand-700 dark:text-brand-300 font-medium">
                    {ot.order_number}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[ot.status]}`}>
                      {STATUS_LABEL[ot.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {WORK_TYPE_LABEL[ot.work_type] ?? ot.work_type}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-[200px] truncate">
                    {vehicleInfo}
                    {ot.external_vehicle?.plate && (
                      <span className="ml-1 text-xs text-gray-400">{ot.external_vehicle.plate}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {ot.client_name ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {ot.mechanic_name ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {fmtDate(ot.entry_date)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                    {ot.total > 0 ? fmtCurrency(ot.total) : <span className="text-gray-400 font-normal">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Página {filters.page} de {pages}</span>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              disabled={filters.page <= 1}
              onClick={() => handleFilter('page', filters.page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={filters.page >= pages}
              onClick={() => handleFilter('page', filters.page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Modales */}
      <WorkOrderFormModal isOpen={showForm} onClose={() => setShowForm(false)} />
      <WorkOrderDetailDrawer workOrderId={selectedOTId} onClose={() => setSelectedOTId(null)} />
    </div>
  )
}
