import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Phone, Mail, MapPin, User, Car, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { InteractionTimeline } from '@/components/crm/InteractionTimeline'
import { LeadFormModal } from '@/components/crm/LeadFormModal'
import { PersonFormModal } from '@/components/crm/PersonFormModal'
import { usePerson } from '@/hooks/usePersons'
import { formatDate, formatARS, capitalize } from '@/lib/utils'
import { LEAD_STATUS_LABELS } from '@/hooks/useLeads'
import type { Lead } from '@/types'

export function PersonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: person, isLoading } = usePerson(id ?? null)

  const [editPersonOpen, setEditPersonOpen] = useState(false)
  const [newLeadOpen,    setNewLeadOpen]    = useState(false)
  const [editingLead,   setEditingLead]    = useState<Lead | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!person) {
    return (
      <div className="flex flex-col items-center py-20 text-gray-400">
        <p>Persona no encontrada</p>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mt-3">
          Volver
        </Button>
      </div>
    )
  }

  const fullName = `${person.first_name} ${person.last_name}`

  const TYPE_LABEL: Record<string, string> = {
    cliente: 'Cliente', prospecto: 'Prospecto', proveedor: 'Proveedor', otro: 'Otro',
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al CRM
      </button>

      {/* Card principal */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-brand-700 dark:text-brand-300">
                {person.first_name[0]}{person.last_name?.[0] ?? ''}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{fullName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="blue">{TYPE_LABEL[person.person_type] ?? person.person_type}</Badge>
                {person.dni && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">DNI {person.dni}</span>
                )}
                {person.cuit && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">CUIT {person.cuit}</span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Edit2 className="h-3.5 w-3.5" />}
            onClick={() => setEditPersonOpen(true)}
          >
            Editar
          </Button>
        </div>

        {/* Datos de contacto */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {person.phone && (
            <a
              href={`tel:${person.phone}`}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-brand-600 transition-colors"
            >
              <Phone className="h-4 w-4 text-gray-400" />
              {person.phone}
            </a>
          )}
          {person.email && (
            <a
              href={`mailto:${person.email}`}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-brand-600 transition-colors"
            >
              <Mail className="h-4 w-4 text-gray-400" />
              {person.email}
            </a>
          )}
          {person.address && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
              {person.address}
            </div>
          )}
          {person.province && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
              {person.province}{person.city ? `, ${person.city}` : ''}
            </div>
          )}
        </div>

        {person.notes && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 italic">
            {person.notes}
          </p>
        )}
      </div>

      {/* Sección leads */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            Leads ({person.leads?.length ?? 0})
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewLeadOpen(true)}
          >
            + Nuevo lead
          </Button>
        </div>

        {person.leads?.length ? (
          <div className="space-y-2">
            {person.leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all"
                onClick={() => setEditingLead(lead)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {lead.interested_description ?? 'Vehículo no especificado'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(lead.created_at)}
                    {lead.budget_max && ` · hasta ${formatARS(lead.budget_max)}`}
                  </p>
                </div>
                <Badge variant={
                  lead.status === 'cerrado_ganado' ? 'green'
                  : lead.status === 'cerrado_perdido' ? 'red'
                  : lead.status === 'en_negociacion' ? 'yellow'
                  : 'blue'
                }>
                  {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] ?? lead.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-4">
            Sin leads registrados
          </p>
        )}
      </div>

      {/* Timeline de interacciones */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <InteractionTimeline personId={person.id} />
      </div>

      {/* Modales */}
      <PersonFormModal
        person={person}
        open={editPersonOpen}
        onClose={() => setEditPersonOpen(false)}
      />
      <LeadFormModal
        defaultPersonId={person.id}
        open={newLeadOpen}
        onClose={() => setNewLeadOpen(false)}
      />
      <LeadFormModal
        lead={editingLead}
        open={!!editingLead}
        onClose={() => setEditingLead(null)}
      />
    </div>
  )
}
