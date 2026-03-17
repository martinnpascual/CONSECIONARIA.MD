import { Phone, Mail, Car, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatDate, truncate } from '@/lib/utils'
import type { Lead } from '@/types'
import type { DraggableProvided } from '@hello-pangea/dnd'

interface LeadCardProps {
  lead: Lead
  provided: DraggableProvided
  onClick: (lead: Lead) => void
}

const SOURCE_LABEL: Record<string, string> = {
  web:            'Web',
  instagram:      'Instagram',
  facebook:       'Facebook',
  whatsapp:       'WhatsApp',
  referido:       'Referido',
  visita:         'Visita directa',
  llamada:        'Llamada',
  mercadolibre:   'MercadoLibre',
}

export function LeadCard({ lead, provided, onClick }: LeadCardProps) {
  const personName = lead.person
    ? `${lead.person.first_name} ${lead.person.last_name}`
    : 'Sin cliente'

  const vehicleInfo = lead.interested_vehicle
    ? `${lead.interested_vehicle.brand} ${lead.interested_vehicle.model} ${lead.interested_vehicle.year}`
    : lead.interested_description ?? null

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => onClick(lead)}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:shadow-md hover:border-brand-300 dark:hover:border-brand-600 transition-all select-none"
    >
      {/* Nombre + badge fuente */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
          {personName}
        </p>
        {lead.source && (
          <Badge variant="gray" className="shrink-0 text-xs">
            {SOURCE_LABEL[lead.source] ?? lead.source}
          </Badge>
        )}
      </div>

      {/* Vehículo de interés */}
      {vehicleInfo && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-2">
          <Car className="h-3 w-3 shrink-0" />
          <span className="truncate">{truncate(vehicleInfo, 40)}</span>
        </div>
      )}

      {/* Contacto */}
      <div className="flex flex-col gap-1">
        {lead.person?.phone && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{lead.person.phone}</span>
          </div>
        )}
        {lead.person?.email && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{truncate(lead.person.email, 28)}</span>
          </div>
        )}
      </div>

      {/* Fecha de próximo contacto */}
      {lead.next_contact_date && (
        <div className="flex items-center gap-1.5 text-xs mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Calendar className="h-3 w-3 text-brand-500 shrink-0" />
          <span className="text-brand-600 dark:text-brand-400 font-medium">
            {formatDate(lead.next_contact_date)}
          </span>
        </div>
      )}

      {/* Notas truncadas */}
      {lead.notes && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 italic leading-tight">
          {truncate(lead.notes, 60)}
        </p>
      )}
    </div>
  )
}
