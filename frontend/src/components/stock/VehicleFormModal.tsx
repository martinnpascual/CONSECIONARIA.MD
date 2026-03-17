import { useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCreateVehicle, useUpdateVehicle } from '@/hooks/useVehicles'
import { useIsAdmin } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { Vehicle } from '@/types'

// react-hook-form no está en el package original — usamos estado manual
// para no agregar dependencia. Se reemplazará por RHF en S-08.
import { useState } from 'react'

interface VehicleFormModalProps {
  vehicle?: Vehicle | null
  open: boolean
  onClose: () => void
}

type FormData = {
  vehicle_type: string
  brand: string
  model: string
  version: string
  year: string
  color: string
  mileage: string
  plate: string
  asking_price: string
  cost_price: string
  minimum_price: string
  description: string
}

const EMPTY: FormData = {
  vehicle_type: 'usado',
  brand: '', model: '', version: '',
  year: String(new Date().getFullYear()),
  color: '', mileage: '', plate: '',
  asking_price: '', cost_price: '', minimum_price: '',
  description: '',
}

function vehicleToForm(v: Vehicle): FormData {
  return {
    vehicle_type:  v.vehicle_type,
    brand:         v.brand,
    model:         v.model,
    version:       v.version ?? '',
    year:          String(v.year),
    color:         v.color ?? '',
    mileage:       v.mileage != null ? String(v.mileage) : '',
    plate:         v.plate ?? '',
    asking_price:  String(v.asking_price),
    cost_price:    v.cost_price != null ? String(v.cost_price) : '',
    minimum_price: v.minimum_price != null ? String(v.minimum_price) : '',
    description:   v.description ?? '',
  }
}

export function VehicleFormModal({ vehicle, open, onClose }: VehicleFormModalProps) {
  const isAdmin = useIsAdmin()
  const create  = useCreateVehicle()
  const update  = useUpdateVehicle()
  const [form, setForm] = useState<FormData>(EMPTY)

  useEffect(() => {
    if (open) setForm(vehicle ? vehicleToForm(vehicle) : EMPTY)
  }, [open, vehicle])

  const isEditing = !!vehicle

  function set(key: keyof FormData, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.brand || !form.model || !form.asking_price) {
      toast.error('Completá los campos obligatorios')
      return
    }

    const payload: Partial<Vehicle> = {
      vehicle_type:  form.vehicle_type as Vehicle['vehicle_type'],
      brand:         form.brand.trim(),
      model:         form.model.trim(),
      version:       form.version.trim() || undefined,
      year:          Number(form.year),
      color:         form.color.trim() || undefined,
      mileage:       form.mileage ? Number(form.mileage) : undefined,
      plate:         form.plate.trim() || undefined,
      asking_price:  Number(form.asking_price),
      minimum_price: form.minimum_price ? Number(form.minimum_price) : undefined,
      description:   form.description.trim() || undefined,
      ...(isAdmin && form.cost_price ? { cost_price: Number(form.cost_price) } : {}),
    }

    try {
      if (isEditing) {
        await update.mutateAsync({ id: vehicle!.id, ...payload })
        toast.success('Vehículo actualizado')
      } else {
        await create.mutateAsync(payload)
        toast.success('Vehículo creado')
      }
      onClose()
    } catch {
      toast.error('Error al guardar el vehículo')
    }
  }

  const isBusy = create.isPending || update.isPending

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEditing ? 'Editar vehículo' : 'Nuevo vehículo'}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isBusy}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit as any} isLoading={isBusy}>
            {isEditing ? 'Guardar cambios' : 'Crear vehículo'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo *"
            value={form.vehicle_type}
            onChange={(e) => set('vehicle_type', e.target.value)}
            options={[
              { value: 'nuevo',        label: 'Nuevo' },
              { value: 'usado',        label: 'Usado' },
              { value: 'consignacion', label: 'Consignación' },
            ]}
          />
          <Input
            label="Año *"
            type="number"
            value={form.year}
            onChange={(e) => set('year', e.target.value)}
            min={1960}
            max={new Date().getFullYear() + 1}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Marca *"
            value={form.brand}
            onChange={(e) => set('brand', e.target.value)}
            placeholder="Toyota"
          />
          <Input
            label="Modelo *"
            value={form.model}
            onChange={(e) => set('model', e.target.value)}
            placeholder="Corolla"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Versión"
            value={form.version}
            onChange={(e) => set('version', e.target.value)}
            placeholder="XEI CVT"
          />
          <Input
            label="Color"
            value={form.color}
            onChange={(e) => set('color', e.target.value)}
            placeholder="Blanco"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Kilometraje"
            type="number"
            value={form.mileage}
            onChange={(e) => set('mileage', e.target.value)}
            placeholder="45000"
            min={0}
          />
          <Input
            label="Patente"
            value={form.plate}
            onChange={(e) => set('plate', e.target.value.toUpperCase())}
            placeholder="AB123CD"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Precio de venta * (ARS)"
            type="number"
            value={form.asking_price}
            onChange={(e) => set('asking_price', e.target.value)}
            placeholder="15000000"
            min={0}
          />
          <Input
            label="Precio mínimo (ARS)"
            type="number"
            value={form.minimum_price}
            onChange={(e) => set('minimum_price', e.target.value)}
            placeholder="14000000"
            min={0}
          />
        </div>

        {/* Precio de costo — solo admin */}
        {isAdmin && (
          <Input
            label="Precio de costo (ARS) — solo admin"
            type="number"
            value={form.cost_price}
            onChange={(e) => set('cost_price', e.target.value)}
            placeholder="12000000"
            min={0}
            helperText="Este campo no aparece en documentos ni es visible para otros roles"
          />
        )}

        <Input
          label="Descripción / observaciones"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Único dueño, service al día..."
        />
      </form>
    </Modal>
  )
}
