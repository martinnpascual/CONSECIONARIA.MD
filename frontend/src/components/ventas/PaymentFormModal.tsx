import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAddPayment } from '@/hooks/useSales'

const PAYMENT_TYPES = [
  { value: 'seña',          label: 'Seña' },
  { value: 'pago_parcial',  label: 'Pago parcial' },
  { value: 'pago_final',    label: 'Pago final' },
  { value: 'financiamiento', label: 'Financiamiento' },
  { value: 'plan_ahorro',   label: 'Plan ahorro' },
  { value: 'otro',          label: 'Otro' },
]

const PAYMENT_METHODS = [
  { value: 'efectivo',        label: 'Efectivo' },
  { value: 'transferencia',   label: 'Transferencia' },
  { value: 'cheque',          label: 'Cheque' },
  { value: 'tarjeta_credito', label: 'Tarjeta crédito' },
  { value: 'tarjeta_debito',  label: 'Tarjeta débito' },
  { value: 'deposito',        label: 'Depósito' },
]

const CURRENCIES = [
  { value: 'ARS', label: 'ARS (Pesos)' },
  { value: 'USD', label: 'USD (Dólares)' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
  saleId: string
  balanceDue: number
}

export function PaymentFormModal({ isOpen, onClose, saleId, balanceDue }: Props) {
  const [paymentType, setPaymentType] = useState('pago_parcial')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('ARS')
  const [usdRate, setUsdRate] = useState('')
  const [method, setMethod] = useState('efectivo')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const addPayment = useAddPayment(saleId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      toast.error('El monto debe ser mayor a 0')
      return
    }
    try {
      await addPayment.mutateAsync({
        payment_type: paymentType,
        amount: Number(amount),
        currency,
        usd_rate: currency === 'USD' && usdRate ? Number(usdRate) : undefined,
        payment_method: method,
        payment_date: paymentDate,
        reference: reference || undefined,
        notes: notes || undefined,
      })
      toast.success('Pago registrado')
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Error al registrar el pago')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar pago" size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={addPayment.isPending}>Registrar</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {balanceDue > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Saldo pendiente: <span className="font-semibold text-red-600">
              {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(balanceDue)}
            </span>
          </p>
        )}

        <Select label="Tipo de pago" value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)} options={PAYMENT_TYPES} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Monto *" type="number" min={0.01} step="0.01"
            value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <Select label="Moneda" value={currency}
            onChange={(e) => setCurrency(e.target.value)} options={CURRENCIES} />
        </div>

        {currency === 'USD' && (
          <Input label="Tipo de cambio (ARS/USD)" type="number" min={1}
            value={usdRate} onChange={(e) => setUsdRate(e.target.value)} />
        )}

        <Select label="Método de pago" value={method}
          onChange={(e) => setMethod(e.target.value)} options={PAYMENT_METHODS} />

        <Input label="Fecha" type="date" value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)} />

        <Input label="Referencia / Nro. comprobante" value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Opcional" />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </form>
    </Modal>
  )
}
