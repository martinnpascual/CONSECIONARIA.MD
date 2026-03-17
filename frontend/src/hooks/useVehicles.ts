import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import type { Vehicle, Paginated } from '@/types'
import { debounce } from '@/lib/utils'
import { useCallback, useState } from 'react'

// ── Filtros ──────────────────────────────────────────────────────
export interface VehicleFiltersState {
  search: string
  status: string
  vehicle_type: string
  brand: string
  year_from: string
  year_to: string
  page: number
  per_page: number
}

export const DEFAULT_FILTERS: VehicleFiltersState = {
  search: '',
  status: '',
  vehicle_type: '',
  brand: '',
  year_from: '',
  year_to: '',
  page: 1,
  per_page: 12,
}

// ── Hook: lista de vehículos ──────────────────────────────────────
export function useVehicles(filters: VehicleFiltersState) {
  return useQuery({
    queryKey: ['vehicles', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search)       params.set('search',       filters.search)
      if (filters.status)       params.set('status',       filters.status)
      if (filters.vehicle_type) params.set('vehicle_type', filters.vehicle_type)
      if (filters.brand)        params.set('brand',        filters.brand)
      if (filters.year_from)    params.set('year_from',    filters.year_from)
      if (filters.year_to)      params.set('year_to',      filters.year_to)
      params.set('page',     String(filters.page))
      params.set('per_page', String(filters.per_page))
      return apiGet<Paginated<Vehicle>>(`/vehicles?${params.toString()}`)
    },
    placeholderData: (prev) => prev,
  })
}

// ── Hook: un vehículo ─────────────────────────────────────────────
export function useVehicle(id: string | null) {
  return useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => apiGet<Vehicle>(`/vehicles/${id}`),
    enabled: !!id,
  })
}

// ── Mutations ─────────────────────────────────────────────────────
export function useCreateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Vehicle>) => apiPost<Vehicle>('/vehicles', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}

export function useUpdateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Vehicle> & { id: string }) =>
      apiPut<Vehicle>(`/vehicles/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      qc.invalidateQueries({ queryKey: ['vehicle', vars.id] })
    },
  })
}

export function useDeleteVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/vehicles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}

// ── Hook: debounced search state ──────────────────────────────────
export function useDebouncedFilters(initial = DEFAULT_FILTERS) {
  const [filters, setFilters] = useState<VehicleFiltersState>(initial)
  const [debouncedSearch, setDebouncedSearch] = useState(initial.search)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateSearch = useCallback(
    debounce((val: string) => {
      setDebouncedSearch(val)
      setFilters((f) => ({ ...f, search: val, page: 1 }))
    }, 300),
    []
  )

  function setFilter<K extends keyof VehicleFiltersState>(key: K, value: VehicleFiltersState[K]) {
    if (key === 'search') {
      setDebouncedSearch(value as string)
      updateSearch(value as string)
    } else {
      setFilters((f) => ({ ...f, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }))
    }
  }

  return { filters, debouncedSearch, setFilter }
}
