import { useState } from 'react'
import { MessageCircle, Phone, Mail, Users, Plus, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { formatDate } from '@/lib/utils'
import { useInteractions, useCreateInteraction } from '@/hooks/usePersons'
import toast from 'react-hot-toast'
import type { Interaction } from '@/types'

const TYPE_ICON: Record<string, React.ElementType> = {
  llamada: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  visita: Users,
  nota: MessageCircle,
}

const TYPE_LABEL: Record<string, string> = {
  llamada: 'Llamada',
  whatsapp: 'WhatsApp',
  email: 'Email',
  visita: 'Visita',
  nota: 'Nota',
}

const TYPE_COLOR: Record<string, string> = {
  llamada:  'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
  whatsapp: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300',
  email:    'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300',
  visita:   'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300',
  nota:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

interface InteractionTimelineProps {
  personId: string
}

export function InteractionTimeline({ personId }: InteractionTimelineProps) {
  const { data: interactions, isLoading } = useInteractions(personId)
  const createInteraction = useCreateInteraction()

  const [showForm, setShowForm] = useState(false)
  const [type, setType]         = useState('nota')
  const [notes, setNotes]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!notes.trim()) { toast.error('Escribí una nota'); return }
    try {
      await createInteraction.mutateAsync({
        personId,
        interaction_type: type as Interaction['interaction_type'],
        notes: notes.trim(),
      })
      toast.success('Interacción registrada')
      setNotes('')
      setShowForm(false)
    } catch {
      toast.error('Error al registrar la interacción')
    }
  }

  return (
    <div className="space-y-4">
      {/* Botón agregar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Historial de contactos
        </h3>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => setShowForm((s) => !s)}
        >
          Registrar
        </Button>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-2 border border-gray-200 dark:border-gray-700"
        >
          <Select
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="¿Qué pasó en este contacto?"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              leftIcon={<Send className="h-3.5 w-3.5" />}
              isLoading={createInteraction.isPending}
            >
              Guardar
            </Button>
          </div>
        </form>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : !interactions?.length ? (
        <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-6">
          Sin contactos registrados aún
        </p>
      ) : (
        <ol className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-4 space-y-4">
          {interactions.map((item) => {
            const Icon = TYPE_ICON[item.interaction_type] ?? MessageCircle
            const color = TYPE_COLOR[item.interaction_type] ?? TYPE_COLOR.nota

            return (
              <li key={item.id} className="ml-5">
                {/* Dot */}
                <span className={`absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full ${color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {TYPE_LABEL[item.interaction_type] ?? item.interaction_type}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {item.notes}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
