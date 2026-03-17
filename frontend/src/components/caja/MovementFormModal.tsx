import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAddMovement } from '@/hooks/useCaja'

const CATEGORY_OPTIONS_INGRESO = [
  { value: 'cobro_venta',    label: 'Cobro de venta' },
  { value: 'cobro_servicio', label: 'Cobro de servicio' },
  { value: 'seña',           label: 'Seña' },
  { value: 'otro',           label: 'Otro ingreso' },
]

const CATEGORY_OPTIONS_EGRESO = [
  { value: 'devolucion',              label: 'Devolución al cliente' },
  { value: 'gasto_operativo',         label: 'Gasto operativo' },
  { value: 'gasto_publicidad',        label: 'Publicidad' },
  { value: 'comision',                label: 'Comisión a vendedor' },
  { value: 'liquidacion_consignacion',label: 'Liquidación consignación' },
  { value: 'otro',                    label: 'Otro egreso' },
]

const PAYMENT_METHOD_OPTIONS = [
  { value: 'efectivo',       label: 'Efectivo' },
  { value: 'transferencia',  label: 'Transferencia bancaria' },
  { value: 'cheque',         label: 'Cheque' },
  { value: 'tarjeta_credito',label: 'Tarjeta de crédito' },
  { value: 'tarjeta_debito', label: 'Tarjeta de débito' },
  { value: 'deposito',       label: 'Depósito bancario' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
  cashRegisterId: string
  usdRate?: number
  defaultType?: 'ingreso' | 'egreso'
}

export function MovementFormModal({ isOpen, onClose, cashRegisterId, usdRate, defaultType = 'ingreso' }: Props) {
  const [movType, setMovType]         = useState<'ingreso' | 'egreso'>(defaultType)
  const [category, setCategory]       = useState('cobro_venta')
  const [description, setDescription] = useState('')
  const [amount, setAmount]           = useState('')
  const [currency, setCurrency]       = useState<'ARS' | 'USD'>('ARS')
  const [rate, setRate]               = useState(usdRate?.toString() ?? '1250')
  const [payMethod, setPayMethod]     = useState('efectivo')
  const [reference, setReference]     = useState('')
  const [notes, setNotes]             = useState('')
  const [movDate, setMovDate]         = useState(new Date().toISOString().split('T')[0])

  const addMovement = useAddMovement()

  function resetForm() {
    setMovType(defaultType); setCategory('cobro_venta'); setDescription('')
    setAmount(''); setCurrency('ARS'); setRate(usdRate?.toString() ?? '1250')
    setPayMethod('efectivo'); setReference(''); setNotes('')
    setMovDate(new Date().toISOString().split('T')[0])
  }

  // Actualizar categoría por defecto al cambiar tipo
  function handleTypeChange(t: 'ingreso' | 'egreso') {
    setMovType(t)
    setCategory(t === 'ingreso' ? 'cobro_venta' : 'gasto_operativo')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) { toast.error('El monto debe ser mayor a cero'); return }
    if (!description.trim()) { toast.error('Ingresá una descripción'); return }

    try {
      await addMovement.mutateAsync({
        cash_register_id: cashRegisterId,
        movement_type:    movType,
        category,
        description,
        amount:           Number(amount),
        currency,
        usd_rate:         currency === 'USD' ? Number(rate) : undefined,
        payment_method:   payMethod,
        movement_date:    movDate,
        reference:        reference || undefined,
        notes:            notes || undefined,
      })
      toast.success(`${movType === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado`)
      resetForm()
      onClose()
    } catch {
      toast.error('Error al registrar el movimiento')
    }
  }

  const categoryOptions = movType === 'ingreso' ? CATEGORY_OPTIONS_INGRESO : CATEGORY_OPTIONS_EGRESO

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { resetForm(); onClose() }}
      title="Nuevo movimiento de caja"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Tipo: ingreso / egreso */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleTypeChange('ingreso')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors
              ${movType === 'ingreso'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
              }`}
          >
            <TrendingUp className="h-4 w-4" />
            Ingreso
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('egreso')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors
              ${movType === 'egreso'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
              }`}
          >
            <TrendingDown className="h-4 w-4" />
            Egreso
          </button>
        </div>

        {/* Categoría */}
        <Select
          label="Categoría"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={categoryOptions}
        />

        {/* Descripción */}
        <Input
          label="Descripción"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: Cobro cuota de Roberto López"
        />

        {/* Monto + moneda */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Monto"
            type="number" min="0.01" step="0.01" required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
          <Select
            label="Moneda"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as 'ARS' | 'USD')}
            options={[
              { value: 'ARS', label: 'ARS — Pesos' },
              { value: 'USD', label: 'USD — Dólares' },
            ]}
          />
        </div>

        {/* Tipo de cambio — solo si USD */}
        {currency === 'USD' && (
          <Input
            label="Tipo de cambio (1 USD = ? ARS)"
            type="number" min="1" step="0.01" required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        )}

        {/* Método de pago */}
        <Select
          label="Método de pago"
          required
          value={payMethod}
          onChange={(e) => setPayMethod(e.target.value)}
          options={PAYMENT_METHOD_OPTIONS}
        />

        {/* Fecha y referencia */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Fecha"
            type="date"
            required
            value={movDate}
            onChange={(e) => setMovDate(e.target.value)}
          />
          <Input
            label="N° referencia"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Nro. transferencia, cheque..."
          />
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notas
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={() => { resetForm(); onClose() }}>
            Cancelar
          </Button>
          <Button
            type="submit"
            isLoading={addMovement.isPending}
            variant={movType === 'egreso' ? 'danger' : 'primary'}
          >
            Registrar {movType}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
