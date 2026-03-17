import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCreatePerson, useUpdatePerson } from '@/hooks/usePersons'
import toast from 'react-hot-toast'
import type { Person } from '@/types'

interface PersonFormModalProps {
  person?: Person | null
  open: boolean
  onClose: () => void
}

type FormData = {
  person_type: string
  first_name: string
  last_name: string
  phone: string
  email: string
  dni: string
  cuit: string
  address: string
  city: string
  province: string
  notes: string
}

const EMPTY: FormData = {
  person_type: 'prospecto',
  first_name: '', last_name: '',
  phone: '', email: '',
  dni: '', cuit: '',
  address: '', city: '', province: '',
  notes: '',
}

function toForm(p: Person): FormData {
  return {
    person_type: p.person_type,
    first_name:  p.first_name,
    last_name:   p.last_name   ?? '',
    phone:       p.phone       ?? '',
    email:       p.email       ?? '',
    dni:         p.dni         ?? '',
    cuit:        p.cuit        ?? '',
    address:     p.address     ?? '',
    city:        p.city        ?? '',
    province:    p.province    ?? '',
    notes:       p.notes       ?? '',
  }
}

const TYPE_OPTIONS = [
  { value: 'prospecto', label: 'Prospecto' },
  { value: 'cliente',   label: 'Cliente' },
  { value: 'proveedor', label: 'Proveedor' },
  { value: 'otro',      label: 'Otro' },
]

export function PersonFormModal({ person, open, onClose }: PersonFormModalProps) {
  const create = useCreatePerson()
  const update = useUpdatePerson()
  const [form, setForm] = useState<FormData>(EMPTY)
  const isEditing = !!person

  useEffect(() => {
    if (open) setForm(person ? toForm(person) : EMPTY)
  }, [open, person])

  function set(k: keyof FormData, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim()) { toast.error('El nombre es obligatorio'); return }

    const payload: Partial<Person> = {
      person_type: form.person_type as Person['person_type'],
      first_name:  form.first_name.trim(),
      last_name:   form.last_name.trim()  || undefined,
      phone:       form.phone.trim()      || undefined,
      email:       form.email.trim()      || undefined,
      dni:         form.dni.trim()        || undefined,
      cuit:        form.cuit.trim()       || undefined,
      address:     form.address.trim()    || undefined,
      city:        form.city.trim()       || undefined,
      province:    form.province.trim()   || undefined,
      notes:       form.notes.trim()      || undefined,
    }

    try {
      if (isEditing) {
        await update.mutateAsync({ id: person!.id, ...payload })
        toast.success('Persona actualizada')
      } else {
        await create.mutateAsync(payload)
        toast.success('Persona creada')
      }
      onClose()
    } catch {
      toast.error('Error al guardar la persona')
    }
  }

  const isBusy = create.isPending || update.isPending

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEditing ? 'Editar persona' : 'Nueva persona'}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isBusy}>Cancelar</Button>
          <Button onClick={handleSubmit as any} isLoading={isBusy}>
            {isEditing ? 'Guardar cambios' : 'Crear persona'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Tipo"
          value={form.person_type}
          onChange={(e) => set('person_type', e.target.value)}
          options={TYPE_OPTIONS}
        />

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

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="DNI"
            value={form.dni}
            onChange={(e) => set('dni', e.target.value)}
            placeholder="30123456"
          />
          <Input
            label="CUIT"
            value={form.cuit}
            onChange={(e) => set('cuit', e.target.value)}
            placeholder="20-30123456-4"
          />
        </div>

        <Input
          label="Dirección"
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
          placeholder="Av. Corrientes 1234"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Ciudad"
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
            placeholder="Buenos Aires"
          />
          <Input
            label="Provincia"
            value={form.province}
            onChange={(e) => set('province', e.target.value)}
            placeholder="CABA"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notas
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Observaciones adicionales..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>
      </form>
    </Modal>
  )
}
