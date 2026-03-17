import { useState } from 'react'
import { FileText, Download, ExternalLink } from 'lucide-react'
import { Select } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { docTypeLabel } from '@/hooks/usePDFs'
import type { PDFDocument } from '@/hooks/usePDFs'

const DOC_TYPE_OPTIONS = [
  { value: 'cotizacion',            label: 'Cotización' },
  { value: 'boleto_compraventa',    label: 'Boleto de compraventa' },
  { value: 'recibo_sena',           label: 'Recibo de seña' },
  { value: 'acta_entrega',          label: 'Acta de entrega' },
  { value: 'orden_trabajo',         label: 'Orden de trabajo' },
  { value: 'contrato_consignacion', label: 'Contrato de consignación' },
]

const REF_TYPE_OPTIONS = [
  { value: 'sale',        label: 'Ventas' },
  { value: 'work_order',  label: 'Taller' },
  { value: 'consignment', label: 'Consignaciones' },
]

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtSize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentosPage() {
  const [docTypeFilter, setDocTypeFilter] = useState('')
  const [refTypeFilter, setRefTypeFilter] = useState('')

  // Los docs se generan desde otros módulos; esta página es el historial.
  const allDocs: PDFDocument[] = []
  const isLoading = false

  const filtered = allDocs.filter((d) => {
    if (docTypeFilter && d.doc_type !== docTypeFilter) return false
    if (refTypeFilter && d.reference_type !== refTypeFilter) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-brand-700 dark:text-brand-300" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Documentos</h1>
          <p className="text-sm text-gray-500">PDFs generados por el sistema</p>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm">
        <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Generación de documentos PDF</p>
        <p className="text-blue-600 dark:text-blue-400">
          Los PDFs se generan desde cada módulo usando el botón{' '}
          <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">📄 PDF</span>{' '}
          en el detalle de una venta, orden de trabajo o consignación.
        </p>
        <ul className="mt-2 space-y-0.5 text-blue-600 dark:text-blue-400">
          <li>• <strong>Ventas:</strong> cotización, boleto de compraventa, recibo de seña, acta de entrega</li>
          <li>• <strong>Taller:</strong> orden de trabajo</li>
          <li>• <strong>Consignaciones:</strong> contrato de consignación</li>
        </ul>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-52">
          <Select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            options={DOC_TYPE_OPTIONS}
            placeholder="Tipo de documento"
          />
        </div>
        <div className="w-44">
          <Select
            value={refTypeFilter}
            onChange={(e) => setRefTypeFilter(e.target.value)}
            options={REF_TYPE_OPTIONS}
            placeholder="Módulo"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Tipo</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Módulo</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Archivo</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Tamaño</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Generado</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                ))}
              </tr>
            ))}

            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <FileText className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No hay documentos generados aún</p>
                    <p className="text-xs">
                      Generá un PDF desde el detalle de una venta, OT o consignación
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && filtered.map((doc) => (
              <tr
                key={doc.id}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {docTypeLabel(doc.doc_type)}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {doc.reference_type === 'work_order' ? 'Taller' :
                   doc.reference_type === 'sale' ? 'Venta' : 'Consignación'}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                  {doc.filename}
                </td>
                <td className="px-4 py-3 text-center text-gray-500 text-xs">
                  {fmtSize(doc.file_size_bytes)}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {fmtDate(doc.created_at)}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <a
                      href={doc.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver
                    </a>
                    <a
                      href={doc.public_url}
                      download={doc.filename}
                      className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
