import { Search, X } from 'lucide-react'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { TallerFiltersState } from '@/hooks/useTaller'

const STATUS_OPTIONS = [
  { value: 'recibido',   label: 'Recibido' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'listo',      label: 'Listo' },
  { value: 'entregado',  label: 'Entregado' },
  { value: 'cancelado',  label: 'Cancelado' },
]

const WORK_TYPE_OPTIONS = [
  { value: 'service',           label: 'Service' },
  { value: 'reparacion',        label: 'Reparación' },
  { value: 'chapa_pintura',     label: 'Chapa y pintura' },
  { value: 'preparacion_venta', label: 'Prep. para venta' },
  { value: 'garantia',          label: 'Garantía' },
  { value: 'otro',              label: 'Otro' },
]

interface Props {
  filters: TallerFiltersState
  searchInput: string
  onFilter: <K extends keyof TallerFiltersState>(key: K, value: TallerFiltersState[K]) => void
}

export function TallerFilters({ filters, searchInput, onFilter }: Props) {
  const hasActiveFilters =
    filters.status || filters.work_type || filters.date_from || filters.date_to || filters.search

  function clearFilters() {
    onFilter('status', '')
    onFilter('work_type', '')
    onFilter('date_from', '')
    onFilter('date_to', '')
    onFilter('search', '')
  }

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="Buscar por número, cliente o vehículo..."
          value={searchInput}
          onChange={(e) => onFilter('search', e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
      </div>

      <div className="w-40">
        <Select
          value={filters.status}
          onChange={(e) => onFilter('status', e.target.value)}
          options={STATUS_OPTIONS}
          placeholder="Estado"
        />
      </div>

      <div className="w-44">
        <Select
          value={filters.work_type}
          onChange={(e) => onFilter('work_type', e.target.value)}
          options={WORK_TYPE_OPTIONS}
          placeholder="Tipo de trabajo"
        />
      </div>

      <div className="w-36">
        <Input
          type="date"
          value={filters.date_from}
          onChange={(e) => onFilter('date_from', e.target.value)}
          label="Desde"
        />
      </div>

      <div className="w-36">
        <Input
          type="date"
          value={filters.date_to}
          onChange={(e) => onFilter('date_to', e.target.value)}
          label="Hasta"
        />
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<X className="h-4 w-4" />}>
          Limpiar
        </Button>
      )}
    </div>
  )
}
