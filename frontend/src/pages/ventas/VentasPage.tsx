import { useState } from 'react'
import { Plus, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { saleStatusBadge } from '@/components/ui/Badge'
import { SaleFilters } from '@/components/ventas/SaleFilters'
import { SaleFormModal } from '@/components/ventas/SaleFormModal'
import { SaleDetailDrawer } from '@/components/ventas/SaleDetailDrawer'
import { useSales, useSaleFilters } from '@/hooks/useSales'
import { formatARS, formatDate } from '@/lib/utils'

const OP_TYPE_LABEL: Record<string, string> = {
  contado:     'Contado',
  financiado:  'Financiado',
  plan_ahorro: 'Plan ahorro',
  combinado:   'Combinado',
}

export function VentasPage() {
  const [showForm, setShowForm] = useState(false)
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)

  const { filters, setFilter } = useSaleFilters()
  const { data, isLoading } = useSales(filters)

  const sales = data?.items ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-brand-700 dark:text-brand-300" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ventas</h1>
            <p className="text-sm text-gray-500">
              {total} venta{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>
          Nueva venta
        </Button>
      </div>

      {/* Filtros */}
      <SaleFilters filters={filters} onFilter={setFilter} />

      {/* Tabla */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">N° Venta</th>
                <th className="px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="px-4 py-3 font-medium text-gray-500">Vehículo</th>
                <th className="px-4 py-3 font-medium text-gray-500">Estado</th>
                <th className="px-4 py-3 font-medium text-gray-500">Tipo</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right">Precio final</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right">Saldo</th>
                <th className="px-4 py-3 font-medium text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && sales.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No se encontraron ventas
                  </td>
                </tr>
              )}

              {!isLoading && sales.map((sale) => {
                const balanceDue = Number(sale.final_price) - Number(sale.total_paid)
                return (
                  <tr
                    key={sale.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => setSelectedSaleId(sale.id)}
                  >
                    <td className="px-4 py-3 font-mono font-medium text-brand-700 dark:text-brand-300">
                      {sale.sale_number}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                      {sale.client_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {sale.vehicle_info ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {saleStatusBadge(sale.status)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {OP_TYPE_LABEL[sale.operation_type] ?? sale.operation_type}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatARS(Number(sale.final_price))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {balanceDue > 0
                        ? <span className="text-red-600 font-medium">{formatARS(balanceDue)}</span>
                        : <span className="text-green-600">Pagado</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(sale.sale_date)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              Página {filters.page} de {pages} — {total} resultados
            </p>
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
      </div>

      {/* Modales */}
      <SaleFormModal isOpen={showForm} onClose={() => setShowForm(false)} />
      <SaleDetailDrawer saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
    </div>
  )
}
