import { Search, X } from 'lucide-react'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { VehicleFiltersState } from '@/hooks/useVehicles'
import { DEFAULT_FILTERS } from '@/hooks/useVehicles'

interface VehicleFiltersProps {
  filters: VehicleFiltersState
  searchValue: string
  onChange: <K extends keyof VehicleFiltersState>(key: K, value: VehicleFiltersState[K]) => void
}

const STATUS_OPTIONS = [
  { value: '',           label: 'Todos los estados' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'reservado',  label: 'Reservado' },
  { value: 'vendido',    label: 'Vendido' },
  { value: 'baja',       label: 'Baja' },
]

const TYPE_OPTIONS = [
  { value: '',             label: 'Todos los tipos' },
  { value: 'nuevo',        label: 'Nuevo' },
  { value: 'usado',        label: 'Usado' },
  { value: 'consignacion', label: 'Consignación' },
]

const YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [
  { value: '', label: 'Desde año' },
  ...[...Array(20)].map((_, i) => {
    const y = String(YEAR - i)
    return { value: y, label: y }
  }),
]

export function VehicleFilters({ filters, searchValue, onChange }: VehicleFiltersProps) {
  const isDirty =
    searchValue !== '' ||
    filters.status !== '' ||
    filters.vehicle_type !== '' ||
    filters.brand !== '' ||
    filters.year_from !== ''

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Búsqueda libre */}
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar marca, modelo, patente..."
            value={searchValue}
            onChange={(e) => onChange('search', e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>

        {/* Estado */}
        <div className="w-44">
          <Select
            value={filters.status}
            onChange={(e) => onChange('status', e.target.value)}
            options={STATUS_OPTIONS}
          />
        </div>

        {/* Tipo */}
        <div className="w-44">
          <Select
            value={filters.vehicle_type}
            onChange={(e) => onChange('vehicle_type', e.target.value)}
            options={TYPE_OPTIONS}
          />
        </div>

        {/* Año desde */}
        <div className="w-36">
          <Select
            value={filters.year_from}
            onChange={(e) => onChange('year_from', e.target.value)}
            options={YEAR_OPTIONS}
          />
        </div>

        {/* Limpiar filtros */}
        {isDirty && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<X className="h-4 w-4" />}
            onClick={() => {
              onChange('search', DEFAULT_FILTERS.search)
              onChange('status', DEFAULT_FILTERS.status)
              onChange('vehicle_type', DEFAULT_FILTERS.vehicle_type)
              onChange('brand', DEFAULT_FILTERS.brand)
              onChange('year_from', DEFAULT_FILTERS.year_from)
              onChange('page', 1)
            }}
            className="text-gray-500"
          >
            Limpiar
          </Button>
        )}
      </div>
    </div>
  )
}
