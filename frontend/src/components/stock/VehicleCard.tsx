import { Car, Edit2, Trash2 } from 'lucide-react'
import { Badge, vehicleStatusBadge } from '@/components/ui/Badge'
// vehicleStatusBadge returns JSX directly — do not destructure
import { Button } from '@/components/ui/Button'
import { formatARS, capitalize } from '@/lib/utils'
import { useIsAdmin } from '@/store/authStore'
import type { Vehicle } from '@/types'

interface VehicleCardProps {
  vehicle: Vehicle
  onEdit: (v: Vehicle) => void
  onDelete: (v: Vehicle) => void
}

export function VehicleCard({ vehicle, onEdit, onDelete }: VehicleCardProps) {
  const isAdmin = useIsAdmin()

  const typeLabel: Record<string, string> = {
    nuevo:        'Nuevo',
    usado:        'Usado',
    consignacion: 'Consignación',
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Foto */}
      <div className="relative aspect-video bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
        {vehicle.main_photo_url ? (
          <img
            src={vehicle.main_photo_url}
            alt={`${vehicle.brand} ${vehicle.model}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <Car className="h-12 w-12 text-gray-300 dark:text-gray-600" />
        )}
        <div className="absolute top-2 left-2">
          {vehicleStatusBadge(vehicle.status)}
        </div>
        <div className="absolute top-2 right-2">
          <Badge variant="gray">{typeLabel[vehicle.vehicle_type] ?? vehicle.vehicle_type}</Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {capitalize(vehicle.brand)} {capitalize(vehicle.model)}
            {vehicle.version && (
              <span className="text-gray-400 dark:text-gray-500 font-normal"> {vehicle.version}</span>
            )}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {vehicle.year}
            {vehicle.mileage != null && ` · ${vehicle.mileage.toLocaleString('es-AR')} km`}
            {vehicle.color && ` · ${capitalize(vehicle.color)}`}
          </p>
        </div>

        {/* Precios */}
        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {formatARS(vehicle.asking_price)}
          </p>
          {isAdmin && vehicle.cost_price != null && (
            <p className="text-xs text-gray-400 dark:text-gray-600">
              Costo: {formatARS(vehicle.cost_price)}
            </p>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="px-4 pb-4 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Edit2 className="h-3.5 w-3.5" />}
          onClick={() => onEdit(vehicle)}
          className="flex-1"
        >
          Editar
        </Button>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={() => onDelete(vehicle)}
            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Dar de baja
          </Button>
        )}
      </div>
    </div>
  )
}
