import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiPatch } from '@/lib/api'
import type { Sale, SaleListItem, PaginatedSales, SalePayment, FinancingResult } from '@/types'
import { useCallback, useState } from 'react'
import { debounce } from '@/lib/utils'

// ── Filtros ──────────────────────────────────────────────────────
export interface SaleFiltersState {
  search: string
  status: string
  operation_type: string
  date_from: string
  date_to: string
  page: number
  per_page: number
}

export const DEFAULT_SALE_FILTERS: SaleFiltersState = {
  search: '',
  status: '',
  operation_type: '',
  date_from: '',
  date_to: '',
  page: 1,
  per_page: 20,
}

// ── Hook: lista de ventas ─────────────────────────────────────────
export function useSales(filters: SaleFiltersState) {
  return useQuery({
    queryKey: ['sales', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search)         params.set('search',         filters.search)
      if (filters.status)         params.set('status',         filters.status)
      if (filters.operation_type) params.set('operation_type', filters.operation_type)
      if (filters.date_from)      params.set('date_from',      filters.date_from)
      if (filters.date_to)        params.set('date_to',        filters.date_to)
      params.set('page',     String(filters.page))
      params.set('per_page', String(filters.per_page))
      return apiGet<PaginatedSales>(`/sales?${params.toString()}`)
    },
    placeholderData: (prev) => prev,
  })
}

// ── Hook: una venta ───────────────────────────────────────────────
export function useSale(id: string | null) {
  return useQuery({
    queryKey: ['sale', id],
    queryFn: () => apiGet<Sale>(`/sales/${id}`),
    enabled: !!id,
  })
}

// ── Mutations ─────────────────────────────────────────────────────
export function useCreateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiPost<Sale>('/sales', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  })
}

export function useUpdateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiPut<Sale>(`/sales/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['sale', vars.id] })
    },
  })
}

export function useChangeSaleStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id, ...data
    }: { id: string; status: string; cancellation_reason?: string; delivery_date?: string }) =>
      apiPatch<Sale>(`/sales/${id}/status`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['sale', vars.id] })
    },
  })
}

export function useAddPayment(saleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiPost<SalePayment>(`/sales/${saleId}/payments`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['sale', saleId] })
    },
  })
}

export function useCalculateFinancing() {
  return useMutation({
    mutationFn: (data: {
      vehicle_price: number
      down_payment: number
      trade_in_value: number
      annual_rate: number
      installments: number
    }) => apiPost<FinancingResult>('/sales/financing/calculate', data),
  })
}

// ── Estado de filtros con debounce ────────────────────────────────
export function useSaleFilters(initial = DEFAULT_SALE_FILTERS) {
  const [filters, setFilters] = useState<SaleFiltersState>(initial)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateSearch = useCallback(
    debounce((...args: unknown[]) => {
      const val = args[0] as string
      setFilters((f) => ({ ...f, search: val, page: 1 }))
    }, 300),
    []
  )

  function setFilter<K extends keyof SaleFiltersState>(key: K, value: SaleFiltersState[K]) {
    if (key === 'search') {
      updateSearch(value as string)
    } else {
      setFilters((f) => ({ ...f, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }))
    }
  }

  return { filters, setFilter }
}

// Re-export SaleListItem so it's importable from here
export type { SaleListItem }
