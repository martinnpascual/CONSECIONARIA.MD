import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut } from '@/lib/api'

export interface TradeIn {
  id: string
  sale_id: string
  brand: string
  model: string
  version: string | null
  year: number
  color: string | null
  plate: string | null
  chassis_number: string | null
  mileage: number | null
  fuel_type: string
  transmission: string
  general_condition: 'excelente' | 'bueno' | 'regular' | 'para_reparar'
  mechanical_notes: string | null
  cosmetic_notes: string | null
  market_reference: number | null
  offered_value: number
  accepted: boolean
  stock_vehicle_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  sales?: { sale_number: string; sale_date: string }
}

export interface TradeInCreate {
  sale_id: string
  brand: string
  model: string
  version?: string
  year: number
  color?: string
  plate?: string
  chassis_number?: string
  mileage?: number
  fuel_type?: string
  transmission?: string
  general_condition?: string
  mechanical_notes?: string
  cosmetic_notes?: string
  market_reference?: number
  offered_value: number
  notes?: string
}

export const CONDITION_LABELS: Record<TradeIn['general_condition'], string> = {
  excelente:    'Excelente',
  bueno:        'Bueno',
  regular:      'Regular',
  para_reparar: 'Para reparar',
}

export const CONDITION_COLORS: Record<TradeIn['general_condition'], string> = {
  excelente:    'bg-green-100 text-green-700',
  bueno:        'bg-blue-100 text-blue-700',
  regular:      'bg-amber-100 text-amber-700',
  para_reparar: 'bg-red-100 text-red-700',
}

// ── Listar trade-ins (puede filtrar por sale_id) ──
export function useTradeIns(saleId?: string | null) {
  return useQuery<TradeIn[]>({
    queryKey: ['trade-ins', saleId ?? 'all'],
    queryFn: () => apiGet('/trade-ins', saleId ? { sale_id: saleId } : undefined),
    retry: false,
  })
}

// ── Detalle de un trade-in ──
export function useTradeIn(id: string | null) {
  return useQuery<TradeIn>({
    queryKey: ['trade-in', id],
    queryFn: () => apiGet(`/trade-ins/${id}`),
    enabled: !!id,
    retry: false,
  })
}

// ── Crear trade-in ──
export function useCreateTradeIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: TradeInCreate) => apiPost('/trade-ins', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trade-ins'] })
      queryClient.invalidateQueries({ queryKey: ['sale', variables.sale_id] })
    },
  })
}

// ── Actualizar trade-in ──
export function useUpdateTradeIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<TradeInCreate>) =>
      apiPut(`/trade-ins/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trade-ins'] }),
  })
}

// ── Aceptar trade-in (ingresa al stock) ──
export function useAcceptTradeIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPost(`/trade-ins/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-ins'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}
