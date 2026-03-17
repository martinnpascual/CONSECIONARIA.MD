import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useCreateTradeIn, useUpdateTradeIn } from '@/hooks/useTradeIns'
import type { TradeIn } from '@/hooks/useTradeIns'
import { formatARS } from '@/lib/utils'

interface Props {
  isOpen: boolean
  onClose: () => void
  saleId: string
  tradeIn?: TradeIn  // Si existe, es edición
}

const FUEL_OPTIONS = [
  { value: 'nafta',    label: 'Nafta' },
  { value: 'diesel',   label: 'Diesel' },
  { value: 'gnc',      label: 'GNC' },
  { value: 'hibrido',  label: 'Híbrido' },
  { value: 'electrico',label: 'Eléctrico' },
]

const TRANSMISSION_OPTIONS = [
  { value: 'manual',    label: 'Manual' },
  { value: 'automatica',label: 'Automática' },
]

const CONDITION_OPTIONS = [
  { value: 'excelente',    label: 'Excelente' },
  { value: 'bueno',        label: 'Bueno' },
  { value: 'regular',      label: 'Regular' },
  { value: 'para_reparar', label: 'Para reparar' },
]

export function TradeInFormModal({ isOpen, onClose, saleId, tradeIn }: Props) {
  const isEdit = !!tradeIn
  const create = useCreateTradeIn()
  const update = useUpdateTradeIn()

  const [form, setForm] = useState({
    brand:             tradeIn?.brand ?? '',
    model:             tradeIn?.model ?? '',
    version:           tradeIn?.version ?? '',
    year:              String(tradeIn?.year ?? new Date().getFullYear()),
    color:             tradeIn?.color ?? '',
    plate:             tradeIn?.plate ?? '',
    chassis_number:    tradeIn?.chassis_number ?? '',
    mileage:           String(tradeIn?.mileage ?? ''),
    fuel_type:         tradeIn?.fuel_type ?? 'nafta',
    transmission:      tradeIn?.transmission ?? 'manual',
    general_condition: tradeIn?.general_condition ?? 'bueno',
    mechanical_notes:  tradeIn?.mechanical_notes ?? '',
    cosmetic_notes:    tradeIn?.cosmetic_notes ?? '',
    market_reference:  String(tradeIn?.market_reference ?? ''),
    offered_value:     String(tradeIn?.offered_value ?? ''),
    notes:             tradeIn?.notes ?? '',
  })

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.brand || !form.model || !form.year || !form.offered_value) {
      toast.error('Completá marca, modelo, año y valor ofrecido')
      return
    }

    const payload = {
      sale_id:           saleId,
      brand:             form.brand,
      model:             form.model,
      version:           form.version || undefined,
      year:              Number(form.year),
      color:             form.color || undefined,
      plate:             form.plate || undefined,
      chassis_number:    form.chassis_number || undefined,
      mileage:           form.mileage ? Number(form.mileage) : undefined,
      fuel_type:         form.fuel_type,
      transmission:      form.transmission,
      general_condition: form.general_condition,
      mechanical_notes:  form.mechanical_notes || undefined,
      cosmetic_notes:    form.cosmetic_notes || undefined,
      market_reference:  form.market_reference ? Number(form.market_reference) : undefined,
      offered_value:     Number(form.offered_value),
      notes:             form.notes || undefined,
    }

    try {
      if (isEdit && tradeIn) {
        await update.mutateAsync({ id: tradeIn.id, ...payload })
        toast.success('Toma de usado actualizada')
      } else {
        await create.mutateAsync(payload)
        toast.success('Toma de usado registrada')
      }
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Error al guardar'
      toast.error(msg)
    }
  }

  if (!isOpen) return null

  const isPending = create.isPending || update.isPending

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Editar toma de usado' : 'Registrar toma de usado'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
          {/* Identificación */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Datos del vehículo</h3>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Marca *" required value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Toyota" />
              <Input label="Modelo *" required value={form.model} onChange={e => set('model', e.target.value)} placeholder="Corolla" />
              <Input label="Versión" value={form.version} onChange={e => set('version', e.target.value)} placeholder="XEI AT" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Input label="Año *" type="number" min="1900" max="2099" required value={form.year} onChange={e => set('year', e.target.value)} />
              <Input label="Color" value={form.color} onChange={e => set('color', e.target.value)} />
              <Input label="Patente" value={form.plate} onChange={e => set('plate', e.target.value)} placeholder="AA123BB" />
              <Input label="N° Chasis" value={form.chassis_number} onChange={e => set('chassis_number', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Kilometraje" type="number" min="0" value={form.mileage} onChange={e => set('mileage', e.target.value)} placeholder="85000" />
              <Select label="Combustible" value={form.fuel_type} onChange={e => set('fuel_type', e.target.value)} options={FUEL_OPTIONS} />
              <Select label="Transmisión" value={form.transmission} onChange={e => set('transmission', e.target.value)} options={TRANSMISSION_OPTIONS} />
            </div>
          </section>

          {/* Estado */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estado del vehículo</h3>
            <Select
              label="Condición general"
              value={form.general_condition}
              onChange={e => set('general_condition', e.target.value)}
              options={CONDITION_OPTIONS}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observaciones mecánicas</label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                  rows={3}
                  value={form.mechanical_notes}
                  onChange={e => set('mechanical_notes', e.target.value)}
                  placeholder="Ej: Motor en buen estado, necesita cambio de aceite"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observaciones estéticas</label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                  rows={3}
                  value={form.cosmetic_notes}
                  onChange={e => set('cosmetic_notes', e.target.value)}
                  placeholder="Ej: Pequeñas abolladuras en puerta trasera"
                />
              </div>
            </div>
          </section>

          {/* Valuación */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Valuación</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Precio de referencia de mercado"
                type="number" min="0" step="1000"
                value={form.market_reference}
                onChange={e => set('market_reference', e.target.value)}
                placeholder="Referencia Mercado Libre, etc."
              />
              <Input
                label="Valor ofrecido al cliente *"
                type="number" min="0" step="1000"
                required
                value={form.offered_value}
                onChange={e => set('offered_value', e.target.value)}
                placeholder="Monto en ARS"
              />
            </div>
            {form.offered_value && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Valor ofrecido: <span className="font-semibold text-gray-900 dark:text-white">{formatARS(Number(form.offered_value))}</span>
                {form.market_reference && (
                  <span className="ml-3 text-xs text-gray-400">
                    (referencia: {formatARS(Number(form.market_reference))})
                  </span>
                )}
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notas adicionales</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                rows={2}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Observaciones generales"
              />
            </div>
          </section>

          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" isLoading={isPending}>
              {isEdit ? 'Guardar cambios' : 'Registrar toma de usado'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
