import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiPatch } from '@/lib/api'
import type { Consignment, ConsignmentListItem, PaginatedConsignments } from '@/types'
import { useCallback, useState } from 'react'
import { debounce } from '@/lib/utils'

// ── Filtros ───────────────────────────────────────────────────────
export interface ConsignFiltersState {
  search: string
  status: string
  page: number
  per_page: number
}

export const DEFAULT_CONSIGN_FILTERS: ConsignFiltersState = {
  search: '',
  status: '',
  page: 1,
  per_page: 20,
}

export function useConsignFilters() {
  const [filters, setFilters] = useState<ConsignFiltersState>(DEFAULT_CONSIGN_FILTERS)
  const [searchInput, setSearchInput] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((val: string) => {
      setFilters(f => ({ ...f, search: val, page: 1 }))
    }, 300),
    []
  )

  function handleFilter<K extends keyof ConsignFiltersState>(key: K, value: ConsignFiltersState[K]) {
    if (key === 'search') {
      setSearchInput(value as string)
      debouncedSearch(value as string)
    } else {
      setFilters(f => ({ ...f, [key]: value, page: key !== 'page' ? 1 : (value as number) }))
    }
  }

  return { filters, searchInput, handleFilter }
}

// ── Queries ───────────────────────────────────────────────────────
export function useConsignaciones(filters: ConsignFiltersState) {
  return useQuery({
    queryKey: ['consignments', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.status) params.set('status', filters.status)
      params.set('page',     String(filters.page))
      params.set('per_page', String(filters.per_page))
      return apiGet<PaginatedConsignments>(`/consignments?${params.toString()}`)
    },
    placeholderData: (prev) => prev,
  })
}

export function useConsignacion(id: string | null) {
  return useQuery({
    queryKey: ['consignment', id],
    queryFn: () => apiGet<Consignment>(`/consignments/${id}`),
    enabled: !!id,
  })
}

// ── Mutations ─────────────────────────────────────────────────────
export function useCreateConsignacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiPost<Consignment>('/consignments', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['consignments'] }) },
  })
}

export function useUpdateConsignacion(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiPut<Consignment>(`/consignments/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consignments'] })
      qc.invalidateQueries({ queryKey: ['consignment', id] })
    },
  })
}

export function useChangeConsignStatus(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { status: string; sale_price?: number }) =>
      apiPatch<Consignment>(`/consignments/${id}/status`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consignments'] })
      qc.invalidateQueries({ queryKey: ['consignment', id] })
    },
  })
}

export function useMarkSettlementPaid(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiPatch<Consignment>(`/consignments/${id}/settlement-paid`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consignments'] })
      qc.invalidateQueries({ queryKey: ['consignment', id] })
    },
  })
}
