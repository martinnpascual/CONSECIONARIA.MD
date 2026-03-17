import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCreateConsignacion } from '@/hooks/useConsignaciones'
import { apiGet } from '@/lib/api'
import type { Vehicle } from '@/types'

const COMMISSION_TYPE_OPTIONS = [
  { value: 'porcentaje',  label: 'Porcentaje del precio de venta (%)' },
  { value: 'monto_fijo',  label: 'Monto fijo (ARS)' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function ConsignFormModal({ isOpen, onClose }: Props) {
  // Propietario
  const [ownerSearch, setOwnerSearch] = useState('')
  const [ownerId, setOwnerId]         = useState('')
  const [ownerLabel, setOwnerLabel]   = useState('')

  // Vehículo del stock tipo consignacion
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [vehicleId, setVehicleId]         = useState('')
  const [vehicleLabel, setVehicleLabel]   = useState('')

  // Términos
  const [floorPrice, setFloorPrice]         = useState('')
  const [commType, setCommType]             = useState<'porcentaje' | 'monto_fijo'>('porcentaje')
  const [commValue, setCommValue]           = useState('')
  const [startDate, setStartDate]           = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate]               = useState('')
  const [notes, setNotes]                   = useState('')

  const createConsign = useCreateConsignacion()

  // Búsqueda propietario (personas)
  const { data: ownerResults } = useQuery({
    queryKey: ['persons-search-consign', ownerSearch],
    queryFn: () =>
      apiGet<{ data: { id: string; full_name: string; dni_cuit?: string }[] }>(
        `/persons?search=${encodeURIComponent(ownerSearch)}&per_page=8`
      ),
    enabled: ownerSearch.length >= 2 && !ownerId,
  })

  // Búsqueda vehículos en consignación (status=disponible, vehicle_type=consignacion)
  const { data: vehicleResults } = useQuery({
    queryKey: ['vehicles-search-consign', vehicleSearch],
    queryFn: () =>
      apiGet<{ data: Vehicle[] }>(
        `/vehicles?search=${encodeURIComponent(vehicleSearch)}&vehicle_type=consignacion&per_page=8`
      ),
    enabled: vehicleSearch.length >= 2 && !vehicleId,
  })

  function resetForm() {
    setOwnerSearch(''); setOwnerId(''); setOwnerLabel('')
    setVehicleSearch(''); setVehicleId(''); setVehicleLabel('')
    setFloorPrice(''); setCommType('porcentaje'); setCommValue('')
    setStartDate(new Date().toISOString().split('T')[0]); setEndDate(''); setNotes('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ownerId) { toast.error('Seleccioná el propietario'); return }
    if (!vehicleId) { toast.error('Seleccioná el vehículo'); return }
    if (!floorPrice || Number(floorPrice) <= 0) { toast.error('Ingresá el precio piso'); return }
    if (!commValue || Number(commValue) <= 0) { toast.error('Ingresá el valor de comisión'); return }

    try {
      await createConsign.mutateAsync({
        owner_id:         ownerId,
        vehicle_id:       vehicleId,
        owner_floor_price: Number(floorPrice),
        commission_type:  commType,
        commission_value: Number(commValue),
        start_date:       startDate,
        end_date:         endDate || undefined,
        notes:            notes || undefined,
      })
      toast.success('Consignación creada correctamente')
      resetForm()
      onClose()
    } catch {
      toast.error('Error al crear la consignación')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { resetForm(); onClose() }}
      title="Nueva consignación"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Propietario ── */}
        <div className="relative">
          <Input
            label="Propietario (consignante)"
            required
            placeholder="Buscar por nombre o DNI/CUIT..."
            value={ownerId ? ownerLabel : ownerSearch}
            onChange={(e) => {
              if (ownerId) { setOwnerId(''); setOwnerLabel('') }
              setOwnerSearch(e.target.value)
            }}
          />
          {!ownerId && ownerSearch.length >= 2 && ownerResults?.data && ownerResults.data.length > 0 && (
            <ul className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
              {ownerResults.data.map((p) => (
                <li
                  key={p.id}
                  className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => { setOwnerId(p.id); setOwnerLabel(p.full_name); setOwnerSearch('') }}
                >
                  <span className="font-medium">{p.full_name}</span>
                  {p.dni_cuit && <span className="text-gray-400 ml-2 text-xs">{p.dni_cuit}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Vehículo ── */}
        <div className="relative">
          <Input
            label="Vehículo en consignación"
            required
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
                  <span className="text-gray-400 ml-2 text-xs">{v.version} · {v.year}</span>
                  {v.plate && <span className="text-gray-400 ml-2 text-xs">{v.plate}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Precio piso ── */}
        <Input
          label="Precio piso (ARS)"
          type="number" min="0" step="1" required
          value={floorPrice}
          onChange={(e) => setFloorPrice(e.target.value)}
          placeholder="Ej: 45000000"
          helperText="Monto mínimo que el propietario acepta recibir"
        />

        {/* ── Comisión ── */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo de comisión"
            required
            value={commType}
            onChange={(e) => setCommType(e.target.value as 'porcentaje' | 'monto_fijo')}
            options={COMMISSION_TYPE_OPTIONS}
          />
          <Input
            label={commType === 'porcentaje' ? 'Porcentaje (%)' : 'Monto fijo (ARS)'}
            type="number" min="0" step="0.01" required
            value={commValue}
            onChange={(e) => setCommValue(e.target.value)}
            placeholder={commType === 'porcentaje' ? 'Ej: 5' : 'Ej: 500000'}
          />
        </div>

        {/* ── Fechas ── */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Fecha de inicio"
            type="date" required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Fecha de vencimiento"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            helperText="Opcional"
          />
        </div>

        {/* ── Notas ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notas del contrato
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Condiciones especiales, acuerdos adicionales..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* ── Resumen comisión (si hay datos) ── */}
        {floorPrice && commValue && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm border border-blue-200 dark:border-blue-800">
            <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Estimación (sobre precio piso)</p>
            <div className="space-y-0.5 text-blue-700 dark:text-blue-300">
              {commType === 'porcentaje' ? (
                <>
                  <p>Comisión: {Number(commValue)}% = <strong>
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
                      .format(Number(floorPrice) * Number(commValue) / 100)}
                  </strong></p>
                  <p>Al propietario: <strong>
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
                      .format(Number(floorPrice) * (1 - Number(commValue) / 100))}
                  </strong></p>
                </>
              ) : (
                <>
                  <p>Comisión fija: <strong>
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
                      .format(Number(commValue))}
                  </strong></p>
                  <p>Al propietario: <strong>
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
                      .format(Number(floorPrice) - Number(commValue))}
                  </strong></p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={() => { resetForm(); onClose() }}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={createConsign.isPending}>
            Crear consignación
          </Button>
        </div>
      </form>
    </Modal>
  )
}
