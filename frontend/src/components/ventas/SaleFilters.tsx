import { Search, X } from 'lucide-react'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { SaleFiltersState } from '@/hooks/useSales'

const STATUS_OPTIONS = [
  { value: 'cotizacion',  label: 'Cotización' },
  { value: 'reserva',     label: 'Reserva' },
  { value: 'en_proceso',  label: 'En proceso' },
  { value: 'entregada',   label: 'Entregada' },
  { value: 'cancelada',   label: 'Cancelada' },
]

const OP_TYPE_OPTIONS = [
  { value: 'contado',     label: 'Contado' },
  { value: 'financiado',  label: 'Financiado' },
  { value: 'plan_ahorro', label: 'Plan ahorro' },
  { value: 'combinado',   label: 'Combinado' },
]

interface Props {
  filters: SaleFiltersState
  onFilter: <K extends keyof SaleFiltersState>(key: K, value: SaleFiltersState[K]) => void
}

export function SaleFilters({ filters, onFilter }: Props) {
  const hasActiveFilters =
    filters.status || filters.operation_type || filters.date_from || filters.date_to

  function clearFilters() {
    onFilter('status', '')
    onFilter('operation_type', '')
    onFilter('date_from', '')
    onFilter('date_to', '')
    onFilter('search', '')
  }

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="Buscar por número, cliente o vehículo..."
          defaultValue={filters.search}
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

      <div className="w-40">
        <Select
          value={filters.operation_type}
          onChange={(e) => onFilter('operation_type', e.target.value)}
          options={OP_TYPE_OPTIONS}
          placeholder="Tipo de op."
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
