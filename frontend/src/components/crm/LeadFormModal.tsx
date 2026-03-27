import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCreateLead, useUpdateLead, LEAD_STATUSES, LEAD_STATUS_LABELS } from '@/hooks/useLeads'
import toast from 'react-hot-toast'
import type { Lead } from '@/types'

interface LeadFormModalProps {
  lead?: Lead | null
  defaultPersonId?: string
  open: boolean
  onClose: () => void
}

type FormData = {
  status: string
  source: string
  interested_description: string
  budget_min: string
  budget_max: string
  next_contact_date: string
  notes: string
  // datos de persona nueva (si no hay defaultPersonId)
  first_name: string
  last_name: string
  phone: string
  email: string
  dni: string
}

const EMPTY: FormData = {
  status: 'nuevo',
  source: '',
  interested_description: '',
  budget_min: '',
  budget_max: '',
  next_contact_date: '',
  notes: '',
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  dni: '',
}

// Valores válidos en el backend (origin_channel enum)
const SOURCE_OPTIONS = [
  { value: '',             label: 'Fuente (opcional)' },
  { value: 'web',          label: 'Web' },
  { value: 'instagram',    label: 'Instagram' },
  { value: 'facebook',     label: 'Facebook' },
  { value: 'mercadolibre', label: 'MercadoLibre' },
  { value: 'showroom',     label: 'Showroom' },
  { value: 'referido',     label: 'Referido' },
  { value: 'otro',         label: 'Otro' },
]

export function LeadFormModal({ lead, defaultPersonId, open, onClose }: LeadFormModalProps) {
  const create = useCreateLead()
  const update = useUpdateLead()
  const [form, setForm] = useState<FormData>(EMPTY)

  const isEditing = !!lead

  useEffect(() => {
    if (!open) return
    if (lead) {
      setForm({
        status:                 lead.status,
        source:                 lead.source ?? '',
        interested_description: lead.interested_description ?? '',
        budget_min:             lead.budget_min != null ? String(lead.budget_min) : '',
        budget_max:             lead.budget_max != null ? String(lead.budget_max) : '',
        next_contact_date:      lead.next_contact_date?.slice(0, 10) ?? '',
        notes:                  lead.notes ?? '',
        first_name: '', last_name: '', phone: '', email: '', dni: '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, lead])

  function set(k: keyof FormData, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isEditing && !form.first_name) {
      toast.error('El nombre del cliente es obligatorio')
      return
    }

    try {
      if (isEditing) {
        // Backend espera PersonUpdate: lead_status, origin_channel (no status/source)
        await update.mutateAsync({
          id:               lead!.id,
          lead_status:      form.status as Lead['status'],
          origin_channel:   form.source || undefined,
          next_contact_date: form.next_contact_date || undefined,
          notes:            form.notes || undefined,
        } as any)
        toast.success('Lead actualizado')
      } else {
        // Backend espera PersonCreate: campos planos first_name, last_name, lead_status, origin_channel
        await create.mutateAsync({
          first_name:     form.first_name.trim(),
          last_name:      form.last_name.trim() || '-',
          phone:          form.phone.trim() || undefined,
          email:          form.email.trim() || undefined,
          dni_cuit:       form.dni.trim()   || undefined,
          lead_status:    form.status,
          origin_channel: form.source || 'showroom',
          person_type:    'lead',
          notes:          form.notes || undefined,
          next_contact_date: form.next_contact_date || undefined,
        } as any)
        toast.success('Lead creado')
      }
      onClose()
    } catch {
      toast.error('Error al guardar el lead')
    }
  }

  const isBusy = create.isPending || update.isPending

  const statusOptions = LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEditing ? 'Editar lead' : 'Nuevo lead'}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isBusy}>Cancelar</Button>
          <Button onClick={handleSubmit as any} isLoading={isBusy}>
            {isEditing ? 'Guardar cambios' : 'Crear lead'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Datos del cliente — solo en creación sin person preexistente */}
        {!isEditing && !defaultPersonId && (
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Cliente
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nombre *"
                value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                placeholder="Juan"
              />
              <Input
                label="Apellido"
                value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                placeholder="Pérez"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Teléfono"
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+54 9 11 1234-5678"
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="juan@email.com"
              />
            </div>
            <Input
              label="DNI"
              value={form.dni}
              onChange={(e) => set('dni', e.target.value)}
              placeholder="30123456"
            />
          </fieldset>
        )}

        {/* Datos del lead */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Lead
          </legend>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Estado"
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              options={statusOptions}
            />
            <Select
              label="Fuente"
              value={form.source}
              onChange={(e) => set('source', e.target.value)}
              options={SOURCE_OPTIONS}
            />
          </div>

          <Input
            label="Vehículo de interés"
            value={form.interested_description}
            onChange={(e) => set('interested_description', e.target.value)}
            placeholder="Toyota Corolla 2023, financiado"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Presupuesto mínimo (ARS)"
              type="number"
              value={form.budget_min}
              onChange={(e) => set('budget_min', e.target.value)}
              placeholder="8000000"
              min={0}
            />
            <Input
              label="Presupuesto máximo (ARS)"
              type="number"
              value={form.budget_max}
              onChange={(e) => set('budget_max', e.target.value)}
              placeholder="15000000"
              min={0}
            />
          </div>

          <Input
            label="Próximo contacto"
            type="date"
            value={form.next_contact_date}
            onChange={(e) => set('next_contact_date', e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="Observaciones, preferencias, historial de conversación..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}
