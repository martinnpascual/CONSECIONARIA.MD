import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCreateWorkOrder } from '@/hooks/useTaller'
import { apiGet } from '@/lib/api'
import type { Vehicle } from '@/types'

const WORK_TYPE_OPTIONS = [
  { value: 'service',           label: 'Service programado' },
  { value: 'reparacion',        label: 'Reparación mecánica' },
  { value: 'chapa_pintura',     label: 'Chapa y pintura' },
  { value: 'preparacion_venta', label: 'Preparación para venta' },
  { value: 'garantia',          label: 'Garantía de fábrica' },
  { value: 'otro',              label: 'Otro' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function WorkOrderFormModal({ isOpen, onClose }: Props) {
  // Búsqueda de cliente
  const [clientSearch, setClientSearch] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientLabel, setClientLabel] = useState('')

  // Vehículo: del stock o externo
  const [vehicleSource, setVehicleSource] = useState<'stock' | 'externo'>('externo')
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [vehicleLabel, setVehicleLabel] = useState('')

  // Vehículo externo
  const [extBrand, setExtBrand]     = useState('')
  const [extModel, setExtModel]     = useState('')
  const [extYear, setExtYear]       = useState('')
  const [extPlate, setExtPlate]     = useState('')
  const [extMileage, setExtMileage] = useState('')

  // Datos de la OT
  const [workType, setWorkType]         = useState('reparacion')
  const [description, setDescription]   = useState('')
  const [estimatedDate, setEstimatedDate] = useState('')
  const [observations, setObservations] = useState('')

  const createOT = useCreateWorkOrder()

  // ── Búsqueda de clientes ──────────────────────────────────────────
  const { data: clientResults } = useQuery({
    queryKey: ['persons-search-ot', clientSearch],
    queryFn: () =>
      apiGet<{ data: { id: string; full_name: string; dni_cuit?: string }[] }>(
        `/persons?search=${encodeURIComponent(clientSearch)}&per_page=8`
      ),
    enabled: clientSearch.length >= 2 && !clientId,
  })

  // ── Búsqueda de vehículos del stock ──────────────────────────────
  const { data: vehicleResults } = useQuery({
    queryKey: ['vehicles-search-ot', vehicleSearch],
    queryFn: () =>
      apiGet<{ data: Vehicle[] }>(
        `/vehicles?search=${encodeURIComponent(vehicleSearch)}&per_page=8`
      ),
    enabled: vehicleSource === 'stock' && vehicleSearch.length >= 2 && !vehicleId,
  })

  function resetForm() {
    setClientSearch(''); setClientId(''); setClientLabel('')
    setVehicleSource('externo'); setVehicleSearch(''); setVehicleId(''); setVehicleLabel('')
    setExtBrand(''); setExtModel(''); setExtYear(''); setExtPlate(''); setExtMileage('')
    setWorkType('reparacion'); setDescription(''); setEstimatedDate(''); setObservations('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) { toast.error('Ingresá una descripción del trabajo'); return }
    if (vehicleSource === 'stock' && !vehicleId) { toast.error('Seleccioná un vehículo del stock'); return }
    if (vehicleSource === 'externo' && (!extBrand || !extModel)) {
      toast.error('Completá marca y modelo del vehículo externo'); return
    }

    const payload: Record<string, unknown> = {
      work_type: workType,
      description,
      ...(estimatedDate && { estimated_delivery_date: estimatedDate }),
      ...(observations && { observations }),
      ...(clientId && { client_id: clientId }),
    }

    if (vehicleSource === 'stock') {
      payload.vehicle_id = vehicleId
    } else {
      payload.external_vehicle = {
        brand:   extBrand,
        model:   extModel,
        year:    extYear ? Number(extYear) : undefined,
        plate:   extPlate || undefined,
        mileage: extMileage ? Number(extMileage) : undefined,
      }
    }

    try {
      await createOT.mutateAsync(payload)
      toast.success('Orden de trabajo creada')
      resetForm()
      onClose()
    } catch {
      toast.error('Error al crear la OT')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { resetForm(); onClose() }}
      title="Nueva orden de trabajo"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Tipo de trabajo ── */}
        <Select
          label="Tipo de trabajo"
          required
          value={workType}
          onChange={(e) => setWorkType(e.target.value)}
          options={WORK_TYPE_OPTIONS}
        />

        {/* ── Cliente (opcional) ── */}
        <div className="relative">
          <Input
            label="Cliente"
            placeholder="Buscar por nombre o DNI..."
            value={clientId ? clientLabel : clientSearch}
            onChange={(e) => {
              if (clientId) { setClientId(''); setClientLabel('') }
              setClientSearch(e.target.value)
            }}
          />
          {!clientId && clientSearch.length >= 2 && clientResults?.data && clientResults.data.length > 0 && (
            <ul className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
              {clientResults.data.map((p) => (
                <li
                  key={p.id}
                  className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => { setClientId(p.id); setClientLabel(p.full_name); setClientSearch('') }}
                >
                  <span className="font-medium">{p.full_name}</span>
                  {p.dni_cuit && <span className="text-gray-500 ml-2 text-xs">{p.dni_cuit}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Origen del vehículo ── */}
        <div>
          <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Vehículo</p>
          <div className="flex gap-4 mb-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio" name="vehicle_source" value="externo"
                checked={vehicleSource === 'externo'}
                onChange={() => { setVehicleSource('externo'); setVehicleId(''); setVehicleLabel(''); setVehicleSearch('') }}
              />
              Cliente externo
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio" name="vehicle_source" value="stock"
                checked={vehicleSource === 'stock'}
                onChange={() => { setVehicleSource('stock'); setExtBrand(''); setExtModel(''); setExtYear(''); setExtPlate(''); setExtMileage('') }}
              />
              Del stock propio
            </label>
          </div>

          {vehicleSource === 'stock' ? (
            <div className="relative">
              <Input
                placeholder="Buscar por marca, modelo o patente..."
                value={vehicleId ? vehicleLabel : vehicleSearch}
                onChange={(e) => {
                  if (vehicleId) { setVehicleId(''); setVehicleLabel('') }
                  setVehicleSearch(e.target.value)
                }}
              />
              {!vehicleId && vehicleSearch.length >= 2 && vehicleResults?.data && vehicleResults.data.length > 0 && (
                <ul className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                  {vehicleResults.data.map((v) => (
                    <li
                      key={v.id}
                      className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => {
                        setVehicleId(v.id)
                        setVehicleLabel(`${v.brand} ${v.model} ${v.version ?? ''} (${v.year})`)
                        setVehicleSearch('')
                      }}
                    >
                      <span className="font-medium">{v.brand} {v.model}</span>
                      <span className="text-gray-500 ml-2 text-xs">{v.version} · {v.year}</span>
                      {v.plate && <span className="text-gray-400 ml-2 text-xs">{v.plate}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Marca" required
                value={extBrand}
                onChange={(e) => setExtBrand(e.target.value)}
                placeholder="Ej: Ford"
              />
              <Input
                label="Modelo" required
                value={extModel}
                onChange={(e) => setExtModel(e.target.value)}
                placeholder="Ej: Focus"
              />
              <Input
                label="Año"
                type="number" min="1990" max="2030"
                value={extYear}
                onChange={(e) => setExtYear(e.target.value)}
                placeholder="2020"
              />
              <Input
                label="Patente"
                value={extPlate}
                onChange={(e) => setExtPlate(e.target.value)}
                placeholder="AB 123 CD"
              />
              <Input
                label="Kilometraje"
                type="number" min="0"
                value={extMileage}
                onChange={(e) => setExtMileage(e.target.value)}
                placeholder="45000"
                className="col-span-2"
              />
            </div>
          )}
        </div>

        {/* ── Descripción ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Descripción del trabajo <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describí el trabajo solicitado..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* ── Entrega estimada ── */}
        <Input
          label="Entrega estimada"
          type="date"
          value={estimatedDate}
          onChange={(e) => setEstimatedDate(e.target.value)}
        />

        {/* ── Observaciones ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Observaciones
          </label>
          <textarea
            rows={2}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Observaciones adicionales..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* ── Botones ── */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => { resetForm(); onClose() }}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={createOT.isPending}>
            Crear OT
          </Button>
        </div>
      </form>
    </Modal>
  )
}
