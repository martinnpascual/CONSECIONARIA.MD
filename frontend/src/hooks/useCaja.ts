import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import type {
  CashRegister, CashMovement, CashSummary, PaginatedMovements
} from '@/types'
import { useState } from 'react'

// ── Caja activa ───────────────────────────────────────────────────
export function useActiveCashRegister() {
  return useQuery({
    queryKey: ['cash-register', 'active'],
    queryFn: () => apiGet<CashRegister | null>('/cash/registers/current'),
    retry: false,
  })
}

export function useCashSummary(cashRegisterId: string | undefined) {
  return useQuery({
    queryKey: ['cash-summary', cashRegisterId],
    queryFn: () => apiGet<CashSummary>(`/cash/registers/${cashRegisterId}/summary`),
    enabled: !!cashRegisterId,
    refetchInterval: 30_000, // refrescar cada 30s
  })
}

// ── Historial de cajas ────────────────────────────────────────────
export function useCashRegisters() {
  return useQuery({
    queryKey: ['cash-registers'],
    queryFn: () => apiGet<CashRegister[]>('/cash/registers'),
  })
}

// ── Movimientos ───────────────────────────────────────────────────
export interface MovementsFilters {
  cash_register_id?: string
  movement_type?: string
  category?: string
  page: number
  per_page: number
}

export function useCashMovements(filters: MovementsFilters) {
  return useQuery({
    queryKey: ['cash-movements', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.cash_register_id) params.set('cash_register_id', filters.cash_register_id)
      if (filters.movement_type)    params.set('movement_type',    filters.movement_type)
      if (filters.category)         params.set('category',         filters.category)
      params.set('page',     String(filters.page))
      params.set('per_page', String(filters.per_page))
      return apiGet<PaginatedMovements>(`/cash/movements?${params.toString()}`)
    },
    enabled: !!filters.cash_register_id,
    placeholderData: (prev) => prev,
  })
}

// ── Mutations ─────────────────────────────────────────────────────
export function useOpenCashRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      opening_balance_ars: number
      opening_balance_usd: number
      usd_rate: number
      notes?: string
    }) => apiPost<CashRegister>('/cash/registers/open', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-register'] })
      qc.invalidateQueries({ queryKey: ['cash-registers'] })
    },
  })
}

export function useCloseCashRegister(cashRegisterId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { notes?: string }) =>
      apiPost<CashRegister>(`/cash/registers/${cashRegisterId}/close`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-register'] })
      qc.invalidateQueries({ queryKey: ['cash-registers'] })
      qc.invalidateQueries({ queryKey: ['cash-summary'] })
    },
  })
}

export function useAddMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiPost<CashMovement>('/cash/movements', data),
    onSuccess: (_data, variables: any) => {
      qc.invalidateQueries({ queryKey: ['cash-movements'] })
      qc.invalidateQueries({ queryKey: ['cash-summary'] })
    },
  })
}

// ── Estado de filtros de movimientos ─────────────────────────────
export function useMovementsFilters(cashRegisterId: string | undefined) {
  const [filters, setFilters] = useState<MovementsFilters>({
    cash_register_id: cashRegisterId,
    movement_type: '',
    category: '',
    page: 1,
    per_page: 25,
  })

  function setFilter<K extends keyof MovementsFilters>(key: K, value: MovementsFilters[K]) {
    setFilters(f => ({ ...f, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }))
  }

  return { filters: { ...filters, cash_register_id: cashRegisterId }, setFilter }
}
