import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCalculateFinancing } from '@/hooks/useSales'
import { formatARS } from '@/lib/utils'

interface Props {
  vehiclePrice: number
  onResult?: (installmentValue: number, installments: number, rate: number, bank: string) => void
}

export function FinancingCalculator({ vehiclePrice, onResult }: Props) {
  const [downPayment, setDownPayment] = useState(0)
  const [tradeInValue, setTradeInValue] = useState(0)
  const [annualRate, setAnnualRate] = useState(60)
  const [installments, setInstallments] = useState(24)
  const [bank, setBank] = useState('')

  const calc = useCalculateFinancing()

  function calculate() {
    calc.mutate({
      vehicle_price: vehiclePrice,
      down_payment: downPayment,
      trade_in_value: tradeInValue,
      annual_rate: annualRate,
      installments,
    })
  }

  function applyResult() {
    if (!calc.data || !onResult) return
    onResult(Number(calc.data.installment_value), installments, annualRate, bank)
  }

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950 p-4 space-y-4">
      <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300 font-medium text-sm">
        <Calculator className="h-4 w-4" />
        Calculadora de financiamiento
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Entrega inicial (ARS)"
          type="number"
          min={0}
          value={downPayment || ''}
          onChange={(e) => setDownPayment(Number(e.target.value))}
        />
        <Input
          label="Valor toma de usado (ARS)"
          type="number"
          min={0}
          value={tradeInValue || ''}
          onChange={(e) => setTradeInValue(Number(e.target.value))}
        />
        <Input
          label="TNA (%)"
          type="number"
          min={1}
          max={200}
          value={annualRate}
          onChange={(e) => setAnnualRate(Number(e.target.value))}
        />
        <Input
          label="Cuotas"
          type="number"
          min={1}
          max={120}
          value={installments}
          onChange={(e) => setInstallments(Number(e.target.value))}
        />
        <div className="col-span-2">
          <Input
            label="Banco / entidad financiera"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder="Ej: Banco Nación"
          />
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={calculate} isLoading={calc.isPending}>
        Calcular
      </Button>

      {calc.data && (
        <div className="rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Monto a financiar</span>
            <span className="font-medium">{formatARS(Number(calc.data.financed_amount))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Valor de cuota</span>
            <span className="font-semibold text-brand-700 dark:text-brand-300 text-base">
              {formatARS(Number(calc.data.installment_value))}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total a pagar</span>
            <span className="font-medium">{formatARS(Number(calc.data.total_to_pay))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Interés total</span>
            <span className="text-red-600">{formatARS(Number(calc.data.total_interest))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">CFT</span>
            <span>{Number(calc.data.cft).toFixed(2)}%</span>
          </div>

          {onResult && (
            <Button variant="primary" size="sm" className="w-full mt-2" onClick={applyResult}>
              Aplicar a la venta
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
