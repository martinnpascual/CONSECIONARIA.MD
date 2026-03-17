import { useState } from 'react'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { VehicleCard } from '@/components/stock/VehicleCard'
import { VehicleFilters } from '@/components/stock/VehicleFilters'
import { VehicleFormModal } from '@/components/stock/VehicleFormModal'
import { VehicleCardSkeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useVehicles, useDebouncedFilters, useDeleteVehicle } from '@/hooks/useVehicles'
import { useIsAdmin } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { Vehicle } from '@/types'

export function StockPage() {
  const isAdmin = useIsAdmin()
  const { filters, debouncedSearch, setFilter } = useDebouncedFilters()
  const { data, isLoading, isFetching } = useVehicles(filters)
  const deleteVehicle = useDeleteVehicle()

  const [formOpen, setFormOpen]     = useState(false)
  const [editing, setEditing]       = useState<Vehicle | null>(null)
  const [toDelete, setToDelete]     = useState<Vehicle | null>(null)

  function openCreate() { setEditing(null); setFormOpen(true) }
  function openEdit(v: Vehicle) { setEditing(v); setFormOpen(true) }
  function closeForm() { setFormOpen(false); setEditing(null) }

  async function handleDelete() {
    if (!toDelete) return
    try {
      await deleteVehicle.mutateAsync(toDelete.id)
      toast.success('Vehículo dado de baja')
      setToDelete(null)
    } catch {
      toast.error('Error al dar de baja el vehículo')
    }
  }

  const vehicles = data?.data ?? []
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="space-y-5">
      {/* Header de página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Stock de Vehículos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {isLoading
              ? 'Cargando...'
              : data
              ? `${data.total} vehículo${data.total !== 1 ? 's' : ''} en total`
              : 'No se pudo conectar al servidor'}
          </p>
        </div>
        {isAdmin && (
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Nuevo vehículo
          </Button>
        )}
      </div>

      {/* Filtros */}
      <VehicleFilters
        filters={filters}
        searchValue={debouncedSearch}
        onChange={setFilter}
      />

      {/* Grid de tarjetas */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <VehicleCardSkeleton key={i} />)}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600">
          <p className="text-sm font-medium">No se encontraron vehículos</p>
          <p className="text-xs mt-1">Probá con otros filtros o agregá un vehículo nuevo</p>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity ${
            isFetching ? 'opacity-60' : 'opacity-100'
          }`}
        >
          {vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onEdit={openEdit}
              onDelete={setToDelete}
            />
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ChevronLeft className="h-4 w-4" />}
            disabled={filters.page <= 1}
            onClick={() => setFilter('page', filters.page - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400 px-3">
            {filters.page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            rightIcon={<ChevronRight className="h-4 w-4" />}
            disabled={filters.page >= totalPages}
            onClick={() => setFilter('page', filters.page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Modal form */}
      <VehicleFormModal
        vehicle={editing}
        open={formOpen}
        onClose={closeForm}
      />

      {/* Confirm delete */}
      <Modal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Dar de baja vehículo"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={deleteVehicle.isPending}
            >
              Dar de baja
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          ¿Dar de baja{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {toDelete?.brand} {toDelete?.model}
          </span>
          ? El vehículo pasará al estado <em>baja</em> y no aparecerá en el stock activo.
        </p>
      </Modal>
    </div>
  )
}
