import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'

export interface PDFDocument {
  id: string
  doc_type: string
  reference_type: string
  reference_id: string | null
  public_url: string
  filename: string
  file_size_bytes: number | null
  created_at: string
}

const DOC_TYPE_LABEL: Record<string, string> = {
  cotizacion:             'Cotización',
  boleto_compraventa:     'Boleto de compraventa',
  recibo_sena:            'Recibo de seña',
  acta_entrega:           'Acta de entrega',
  orden_trabajo:          'Orden de trabajo',
  contrato_consignacion:  'Contrato de consignación',
}

export function docTypeLabel(docType: string) {
  return DOC_TYPE_LABEL[docType] ?? docType
}

export function useDocuments(referenceType: string, referenceId: string | null) {
  return useQuery({
    queryKey: ['documents', referenceType, referenceId],
    queryFn: () => apiGet<PDFDocument[]>(`/pdfs/${referenceType}/${referenceId}`),
    enabled: !!referenceId,
  })
}

export function useGeneratePDF() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      doc_type: string
      reference_id: string
      extra_context?: Record<string, unknown>
    }) => apiPost<PDFDocument>('/pdfs/generate', data),
    onSuccess: (_data, variables) => {
      // Refrescar lista de documentos para esa entidad
      const refType = variables.doc_type === 'orden_trabajo'
        ? 'work_order'
        : variables.doc_type === 'contrato_consignacion'
          ? 'consignment'
          : 'sale'
      qc.invalidateQueries({ queryKey: ['documents', refType, variables.reference_id] })
    },
  })
}
