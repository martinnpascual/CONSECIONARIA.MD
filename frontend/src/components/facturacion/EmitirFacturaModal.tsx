/**
 * EmitirFacturaModal — Modal para emitir factura electrónica ARCA (S-15)
 *
 * Flujo:
 * 1. Usuario elige tipo: A (RI), B (CF) o C (Monotributo)
 * 2. Si A → requiere CUIT del receptor
 * 3. Confirma → llama al backend → MrBot → ARCA → CAE
 * 4. Muestra CAE + número de comprobante + QR
 */
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  useEmitirFactura,
  type Invoice,
  type InvoiceType,
  type IvaCondicion,
  type EmitirFacturaRequest,
} from '@/hooks/useInvoices'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n)
}

const TIPO_LABEL: Record<InvoiceType, string> = {
  A: 'Factura A — Responsable Inscripto',
  B: 'Factura B — Consumidor Final',
  C: 'Factura C — Monotributista',
}

const IVA_COND_DEFAULT: Record<InvoiceType, IvaCondicion> = {
  A: 'Responsable Inscripto',
  B: 'Consumidor Final',
  C: 'Monotributo',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  referenceType: 'sale' | 'work_order'
  referenceId: string
  clientName?: string
  clientCuit?: string
  totalAmount: number
}

export function EmitirFacturaModal({
  isOpen,
  onClose,
  referenceType,
  referenceId,
  clientName = '',
  clientCuit = '',
  totalAmount,
}: Props) {
  const emitir = useEmitirFactura()

  const [tipoFactura, setTipoFactura] = useState<InvoiceType>('B')
  const [receptorName, setReceptorName] = useState(clientName)
  const [receptorCuit, setReceptorCuit] = useState(clientCuit)
  const [emitida, setEmitida] = useState<Invoice | null>(null)

  // Montos calculados según tipo
  const netAmount = tipoFactura === 'A' ? Math.round(totalAmount / 1.21 * 100) / 100 : totalAmount
  const ivaAmount = tipoFactura === 'A' ? Math.round((totalAmount - netAmount) * 100) / 100 : 0

  async function handleEmitir(e: React.FormEvent) {
    e.preventDefault()
    if (tipoFactura === 'A' && !receptorCuit) {
      toast.error('La Factura A requiere el CUIT del receptor')
      return
    }
    const req: EmitirFacturaRequest = {
      reference_type: referenceType,
      reference_id: referenceId,
      invoice_type: tipoFactura,
      receptor_name: receptorName || undefined,
      receptor_cuit: receptorCuit || undefined,
      receptor_iva_cond: IVA_COND_DEFAULT[tipoFactura],
      total_amount: totalAmount,
    }
    try {
      const result = await emitir.mutateAsync(req)
      setEmitida(result)
      toast.success(`Factura ${tipoFactura} emitida — CAE: ${result.cae}`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Error al emitir la factura'
      toast.error(msg)
    }
  }

  function handleClose() {
    setEmitida(null)
    setTipoFactura('B')
    setReceptorName(clientName)
    setReceptorCuit(clientCuit)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Emitir factura electrónica"
      size="sm"
    >
      {/* ── Estado: éxito ── */}
      {emitida ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <div>
              <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
                Factura {emitida.invoice_type} emitida
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Comprobante N° {emitida.invoice_number}
              </p>
            </div>
          </div>

          {/* CAE */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">CAE</span>
              <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                {emitida.cae}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vto. CAE</span>
              <span className="text-gray-700 dark:text-gray-300">
                {emitida.cae_expiry_date
                  ? new Date(emitida.cae_expiry_date + 'T12:00').toLocaleDateString('es-AR')
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total facturado</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {fmtARS(emitida.total_amount)}
              </span>
            </div>
          </div>

          {/* QR */}
          {emitida.qr_url && (
            <div className="flex justify-center">
              <img
                src={emitida.qr_url}
                alt="QR AFIP"
                className="w-32 h-32 border border-gray-200 dark:border-gray-700 rounded-lg"
              />
            </div>
          )}

          <Button className="w-full" onClick={handleClose}>
            Cerrar
          </Button>
        </div>
      ) : (
        /* ── Formulario ── */
        <form onSubmit={handleEmitir} className="space-y-4">
          {/* Tipo de factura */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tipo de comprobante <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['A', 'B', 'C'] as InvoiceType[]).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setTipoFactura(tipo)}
                  className={`py-2.5 rounded-lg border-2 text-sm font-bold transition-colors ${
                    tipoFactura === tipo
                      ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-500'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {tipo}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">{TIPO_LABEL[tipoFactura]}</p>
          </div>

          {/* Receptor */}
          <Input
            label="Nombre del receptor"
            value={receptorName}
            onChange={(e) => setReceptorName(e.target.value)}
            placeholder="Consumidor Final"
          />

          {/* CUIT — obligatorio para Factura A */}
          <Input
            label={`CUIT del receptor${tipoFactura === 'A' ? ' *' : ''}`}
            value={receptorCuit}
            onChange={(e) => setReceptorCuit(e.target.value)}
            placeholder="20-12345678-9"
            required={tipoFactura === 'A'}
            helperText={tipoFactura === 'A' ? 'Requerido para Factura A' : 'Opcional para B y C'}
          />

          {/* Resumen de montos */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Importe neto</span>
              <span>{fmtARS(netAmount)}</span>
            </div>
            {tipoFactura === 'A' && (
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>IVA 21%</span>
                <span>{fmtARS(ivaAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-1.5">
              <span>Total</span>
              <span>{fmtARS(totalAmount)}</span>
            </div>
          </div>

          {/* Advertencia modo testing */}
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              La factura se emite en <strong>modo testing</strong> (ARCA Homologación) hasta configurar las credenciales de producción.
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              leftIcon={<FileText className="h-4 w-4" />}
              isLoading={emitir.isPending}
            >
              Emitir factura
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
