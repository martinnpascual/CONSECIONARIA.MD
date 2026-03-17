import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { DollarSign, Lock, Unlock, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useOpenCashRegister, useCloseCashRegister } from '@/hooks/useCaja'
import type { CashRegister, CashSummary } from '@/types'

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

// ── Panel cuando NO hay caja abierta ─────────────────────────────
interface OpenPanelProps {
  onOpened: () => void
}

export function OpenCashPanel({ onOpened }: OpenPanelProps) {
  const [showModal, setShowModal] = useState(false)
  const [openingARS, setOpeningARS] = useState('0')
  const [openingUSD, setOpeningUSD] = useState('0')
  const [usdRate, setUsdRate]       = useState('1250')
  const [notes, setNotes]           = useState('')

  const openCaja = useOpenCashRegister()

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault()
    if (!usdRate || Number(usdRate) <= 0) { toast.error('Ingresá el tipo de cambio USD'); return }
    try {
      await openCaja.mutateAsync({
        opening_balance_ars: Number(openingARS),
        opening_balance_usd: Number(openingUSD),
        usd_rate: Number(usdRate),
        notes: notes || undefined,
      })
      toast.success('Caja abierta correctamente')
      setShowModal(false)
      onOpened()
    } catch {
      toast.error('Error al abrir la caja')
    }
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800">
          <Lock className="h-10 w-10 text-gray-400" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">No hay caja abierta hoy</p>
          <p className="text-sm text-gray-500 mt-1">Abrí la caja para registrar movimientos</p>
        </div>
        <Button leftIcon={<Unlock className="h-4 w-4" />} onClick={() => setShowModal(true)}>
          Abrir caja
        </Button>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Abrir caja del día" size="sm">
        <form onSubmit={handleOpen} className="space-y-4">
          <Input
            label="Saldo inicial ARS"
            type="number" min="0" step="0.01"
            value={openingARS}
            onChange={(e) => setOpeningARS(e.target.value)}
            placeholder="0"
          />
          <Input
            label="Saldo inicial USD"
            type="number" min="0" step="0.01"
            value={openingUSD}
            onChange={(e) => setOpeningUSD(e.target.value)}
            placeholder="0"
          />
          <Input
            label="Tipo de cambio USD (1 USD = ? ARS)"
            type="number" min="1" step="0.01"
            required
            value={usdRate}
            onChange={(e) => setUsdRate(e.target.value)}
            placeholder="1250"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Observaciones
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100"
              placeholder="Opcional..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" isLoading={openCaja.isPending} leftIcon={<Unlock className="h-4 w-4" />}>
              Abrir caja
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Panel de resumen de caja abierta ─────────────────────────────
interface SummaryPanelProps {
  register: CashRegister
  summary: CashSummary | undefined
  onClosed: () => void
}

export function CashSummaryPanel({ register, summary, onClosed }: SummaryPanelProps) {
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeNotes, setCloseNotes]         = useState('')
  const closeCaja = useCloseCashRegister(register.id)

  const balanceARS = summary
    ? summary.opening_balance_ars + summary.total_income_ars - summary.total_expense_ars
    : register.opening_balance_ars
  const balanceUSD = summary
    ? summary.opening_balance_usd + summary.total_income_usd - summary.total_expense_usd
    : register.opening_balance_usd

  async function handleClose(e: React.FormEvent) {
    e.preventDefault()
    try {
      await closeCaja.mutateAsync({ notes: closeNotes || undefined })
      toast.success('Caja cerrada correctamente')
      setShowCloseModal(false)
      onClosed()
    } catch {
      toast.error('Error al cerrar la caja')
    }
  }

  return (
    <>
      {/* Header de caja */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              Caja del {new Date(register.open_date + 'T12:00:00').toLocaleDateString('es-AR', {
                weekday: 'long', day: 'numeric', month: 'long'
              })}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
                Abierta
              </span>
              {register.usd_rate && (
                <span className="text-xs text-gray-500">
                  TC: {fmtARS(register.usd_rate)}/USD
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="outline" size="sm"
          leftIcon={<Lock className="h-4 w-4" />}
          onClick={() => setShowCloseModal(true)}
        >
          Cerrar caja
        </Button>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Balance ARS */}
        <div className="col-span-2 lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Balance ARS</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{fmtARS(balanceARS)}</p>
          <p className="text-xs text-gray-400 mt-1">Inicial: {fmtARS(register.opening_balance_ars)}</p>
        </div>

        {/* Balance USD */}
        <div className="col-span-2 lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Balance USD</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{fmtUSD(balanceUSD)}</p>
          <p className="text-xs text-gray-400 mt-1">Inicial: {fmtUSD(register.opening_balance_usd)}</p>
        </div>

        {/* Ingresos del día */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-green-600" />
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">Ingresos</p>
          </div>
          <p className="text-lg font-bold text-green-700 dark:text-green-300">
            {fmtARS(summary?.total_income_ars ?? 0)}
          </p>
          {(summary?.total_income_usd ?? 0) > 0 && (
            <p className="text-xs text-green-600 mt-0.5">{fmtUSD(summary!.total_income_usd)}</p>
          )}
        </div>

        {/* Egresos del día */}
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="h-3.5 w-3.5 text-red-600" />
            <p className="text-xs text-red-700 dark:text-red-400 font-medium">Egresos</p>
          </div>
          <p className="text-lg font-bold text-red-700 dark:text-red-300">
            {fmtARS(summary?.total_expense_ars ?? 0)}
          </p>
          {(summary?.total_expense_usd ?? 0) > 0 && (
            <p className="text-xs text-red-600 mt-0.5">{fmtUSD(summary!.total_expense_usd)}</p>
          )}
        </div>
      </div>

      {/* Modal de cierre */}
      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Cerrar caja" size="sm">
        <form onSubmit={handleClose} className="space-y-4">
          {/* Resumen antes de cerrar */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Balance final ARS</span>
              <span className="font-bold">{fmtARS(balanceARS)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Balance final USD</span>
              <span className="font-bold">{fmtUSD(balanceUSD)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total ingresos ARS</span>
              <span className="text-green-600 font-medium">{fmtARS(summary?.total_income_ars ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total egresos ARS</span>
              <span className="text-red-600 font-medium">{fmtARS(summary?.total_expense_ars ?? 0)}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Observaciones al cierre
            </label>
            <textarea
              rows={2}
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100"
              placeholder="Opcional..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => setShowCloseModal(false)}>Cancelar</Button>
            <Button type="submit" variant="danger" isLoading={closeCaja.isPending} leftIcon={<Lock className="h-4 w-4" />}>
              Confirmar cierre
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
