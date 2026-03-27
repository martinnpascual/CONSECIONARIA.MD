import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { FinancingCalculator } from './FinancingCalculator'
import { useCreateSale } from '@/hooks/useSales'
import { apiGet } from '@/lib/api'
import type { Paginated, Vehicle } from '@/types'

const OP_TYPES = [
  { value: 'contado',     label: 'Contado' },
  { value: 'financiado',  label: 'Financiado' },
  { value: 'plan_ahorro', label: 'Plan ahorro' },
  { value: 'combinado',   label: 'Combinado' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function SaleFormModal({ isOpen, onClose }: Props) {
  const [clientSearch, setClientSearch] = useState('')
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [clientId, setClientId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [discount, setDiscount] = useState('0')
  const [opType, setOpType] = useState('contado')
  const [installments, setInstallments] = useState('')
  const [installmentValue, setInstallmentValue] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [financingBank, setFinancingBank] = useState('')
  const [savingsPlanName, setSavingsPlanName] = useState('')
  const [observations, setObservations] = useState('')
  const [showCalc, setShowCalc] = useState(false)

  const createSale = useCreateSale()

  const { data: clients } = useQuery({
    queryKey: ['persons-search', clientSearch],
    queryFn: () => apiGet<{ items: { id: string; full_name: string; dni_cuit?: string }[] }>(`/persons?search=${clientSearch}&per_page=8`),
    enabled: clientSearch.length >= 2,
  })

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles-available', vehicleSearch],
    queryFn: () => apiGet<Paginated<Vehicle>>(`/vehicles?search=${vehicleSearch}&status=disponible&per_page=8`),
    enabled: vehicleSearch.length >= 1,
  })

  const selectedVehicle = vehicles?.items?.find((v) => v.id === vehicleId)
  const needsFinancing = opType === 'financiado' || opType === 'combinado'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !vehicleId || !salePrice) {
      toast.error('Cliente, vehículo y precio son obligatorios')
      return
    }
    try {
      await createSale.mutateAsync({
        client_id: clientId,
        vehicle_id: vehicleId,
        operation_type: opType,
        sale_price: Number(salePrice),
        discount: Number(discount),
        ...(needsFinancing && {
          installments: installments ? Number(installments) : undefined,
          installment_value: installmentValue ? Number(installmentValue) : undefined,
          interest_rate: interestRate ? Number(interestRate) : undefined,
          financing_bank: financingBank || undefined,
        }),
        ...(opType === 'plan_ahorro' && { savings_plan_name: savingsPlanName || undefined }),
        observations: observations || undefined,
      })
      toast.success('Venta creada como cotización')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Error al crear la venta')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nueva venta" size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={createSale.isPending}>Crear cotización</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cliente */}
        <div>
          <Input
            label="Cliente *"
            placeholder="Buscar por nombre o DNI..."
            value={clientSearch}
            onChange={(e) => { setClientSearch(e.target.value); setClientId('') }}
          />
          {clients?.items && clients.items.length > 0 && !clientId && (
            <ul className="mt-1 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 text-sm max-h-36 overflow-y-auto">
              {clients.items.map((p) => (
                <li key={p.id}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => { setClientId(p.id); setClientSearch(p.full_name) }}
                >
                  {p.full_name} {p.dni_cuit && <span className="text-gray-400 ml-1">— {p.dni_cuit}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Vehículo */}
        <div>
          <Input
            label="Vehículo disponible *"
            placeholder="Buscar por marca, modelo, patente..."
            value={vehicleSearch}
            onChange={(e) => { setVehicleSearch(e.target.value); setVehicleId('') }}
          />
          {vehicles?.items && vehicles.items.length > 0 && !vehicleId && (
            <ul className="mt-1 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 text-sm max-h-36 overflow-y-auto">
              {vehicles.items.map((v) => (
                <li key={v.id}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => {
                    setVehicleId(v.id)
                    setVehicleSearch(`${v.brand} ${v.model} ${v.year}`)
                    setSalePrice(String(v.asking_price))
                  }}
                >
                  {v.brand} {v.model} {v.year}
                  {v.plate && <span className="text-gray-400 ml-1">— {v.plate}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Select label="Tipo de operación" value={opType}
            onChange={(e) => setOpType(e.target.value)} options={OP_TYPES} />
          <Input label="Precio de venta (ARS) *" type="number" min={1}
            value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
          <Input label="Descuento (ARS)" type="number" min={0}
            value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>

        {needsFinancing && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cuotas" type="number" min={1}
              value={installments} onChange={(e) => setInstallments(e.target.value)} />
            <Input label="Valor de cuota (ARS)" type="number" min={1}
              value={installmentValue} onChange={(e) => setInstallmentValue(e.target.value)} />
            <Input label="TNA (%)" type="number" min={0}
              value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
            <Input label="Banco / entidad" value={financingBank}
              onChange={(e) => setFinancingBank(e.target.value)} />
          </div>
        )}

        {opType === 'plan_ahorro' && (
          <Input label="Nombre del plan de ahorro" value={savingsPlanName}
            onChange={(e) => setSavingsPlanName(e.target.value)} />
        )}

        {needsFinancing && vehicleId && (
          <div>
            <button type="button" className="text-sm text-brand-600 hover:underline"
              onClick={() => setShowCalc((v) => !v)}>
              {showCalc ? '▲ Ocultar calculadora' : '▼ Abrir calculadora de financiamiento'}
            </button>
            {showCalc && (
              <div className="mt-3">
                <FinancingCalculator
                  vehiclePrice={Number(salePrice) || selectedVehicle?.asking_price || 0}
                  onResult={(iv, inst, rate, bank) => {
                    setInstallmentValue(String(iv))
                    setInstallments(String(inst))
                    setInterestRate(String(rate))
                    setFinancingBank(bank)
                    setShowCalc(false)
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones</label>
          <textarea
            rows={2}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </form>
    </Modal>
  )
}
