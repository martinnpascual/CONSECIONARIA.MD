import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  blue:    'bg-blue-100 text-blue-700',
  green:   'bg-green-100 text-green-700',
  yellow:  'bg-yellow-100 text-yellow-700',
  red:     'bg-red-100 text-red-700',
  gray:    'bg-gray-100 text-gray-500',
  purple:  'bg-purple-100 text-purple-700',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

// Mapeadores de dominio
export function vehicleStatusBadge(status: string) {
  const map: Record<string, BadgeVariant> = {
    disponible: 'green',
    reservado:  'yellow',
    vendido:    'gray',
    baja:       'red',
  }
  return <Badge variant={map[status] ?? 'default'}>{status}</Badge>
}

export function saleStatusBadge(status: string) {
  const map: Record<string, BadgeVariant> = {
    cotizacion:  'blue',
    reserva:     'yellow',
    en_proceso:  'purple',
    entregada:   'green',
    cancelada:   'red',
  }
  return <Badge variant={map[status] ?? 'default'}>{status.replace('_', ' ')}</Badge>
}

export function workOrderStatusBadge(status: string) {
  const map: Record<string, BadgeVariant> = {
    recibido:   'blue',
    en_proceso: 'yellow',
    listo:      'purple',
    entregado:  'green',
    cancelado:  'red',
  }
  return <Badge variant={map[status] ?? 'default'}>{status.replace('_', ' ')}</Badge>
}
