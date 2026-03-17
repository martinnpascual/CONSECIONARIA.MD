import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api'
import type { WorkOrder, WorkOrderListItem, PaginatedWorkOrders, WorkOrderItem } from '@/types'
import { useCallback, useState } from 'react'
import { debounce } from '@/lib/utils'

// ── Filtros ──────────────────────────────────────────────────────
export interface TallerFiltersState {
  search: string
  status: string
  work_type: string
  date_from: string
  date_to: string
  page: number
  per_page: number
}

export const DEFAULT_TALLER_FILTERS: TallerFiltersState = {
  search: '',
  status: '',
  work_type: '',
  date_from: '',
  date_to: '',
  page: 1,
  per_page: 20,
}

// ── Hook: filtros con debounce ────────────────────────────────────
export function useTallerFilters() {
  const [filters, setFilters] = useState<TallerFiltersState>(DEFAULT_TALLER_FILTERS)
  const [searchInput, setSearchInput] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((val: string) => {
      setFilters(f => ({ ...f, search: val, page: 1 }))
    }, 300),
    []
  )

  function handleFilter<K extends keyof TallerFiltersState>(key: K, value: TallerFiltersState[K]) {
    if (key === 'search') {
      setSearchInput(value as string)
      debouncedSearch(value as string)
    } else {
      setFilters(f => ({ ...f, [key]: value, page: key !== 'page' ? 1 : value }))
    }
  }

  return { filters, searchInput, handleFilter }
}

// ── Hook: lista de OTs ────────────────────────────────────────────
export function useWorkOrders(filters: TallerFiltersState) {
  return useQuery({
    queryKey: ['work-orders', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search)    params.set('search',    filters.search)
      if (filters.status)    params.set('status',    filters.status)
      if (filters.work_type) params.set('work_type', filters.work_type)
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to)   params.set('date_to',   filters.date_to)
      params.set('page',     String(filters.page))
      params.set('per_page', String(filters.per_page))
      return apiGet<PaginatedWorkOrders>(`/work-orders?${params.toString()}`)
    },
    placeholderData: (prev) => prev,
  })
}

// ── Hook: una OT ──────────────────────────────────────────────────
export function useWorkOrder(id: string | null) {
  return useQuery({
    queryKey: ['work-order', id],
    queryFn: () => apiGet<WorkOrder>(`/work-orders/${id}`),
    enabled: !!id,
  })
}

// ── Mutations ─────────────────────────────────────────────────────
export function useCreateWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiPost<WorkOrder>('/work-orders', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-orders'] }) },
  })
}

export function useUpdateWorkOrder(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) => apiPut<WorkOrder>(`/work-orders/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      qc.invalidateQueries({ queryKey: ['work-order', id] })
    },
  })
}

export function useChangeWorkOrderStatus(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { status: string; observations?: string }) =>
      apiPatch<WorkOrder>(`/work-orders/${id}/status`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      qc.invalidateQueries({ queryKey: ['work-order', id] })
    },
  })
}

// ── Ítems de OT ───────────────────────────────────────────────────
export function useAddWorkOrderItem(workOrderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: object) =>
      apiPost<WorkOrderItem>(`/work-orders/${workOrderId}/items`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-order', workOrderId] })
      qc.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })
}

export function useDeleteWorkOrderItem(workOrderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) =>
      apiDelete(`/work-orders/${workOrderId}/items/${itemId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-order', workOrderId] })
      qc.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })
}
