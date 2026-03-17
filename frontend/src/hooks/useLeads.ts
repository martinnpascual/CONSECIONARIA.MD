import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api'
import type { Lead, Paginated } from '@/types'

// ── Tipos locales ──────────────────────────────────────────────────
export type LeadStatus =
  | 'nuevo'
  | 'contactado'
  | 'interesado'
  | 'en_negociacion'
  | 'cerrado_ganado'
  | 'cerrado_perdido'

export const LEAD_STATUSES: LeadStatus[] = [
  'nuevo',
  'contactado',
  'interesado',
  'en_negociacion',
  'cerrado_ganado',
  'cerrado_perdido',
]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nuevo:           'Nuevo',
  contactado:      'Contactado',
  interesado:      'Interesado',
  en_negociacion:  'En negociación',
  cerrado_ganado:  'Ganado',
  cerrado_perdido: 'Perdido',
}

// ── Filtros ────────────────────────────────────────────────────────
export interface LeadFilters {
  search: string
  status: string
  assigned_to: string
  page: number
  per_page: number
}

export const DEFAULT_LEAD_FILTERS: LeadFilters = {
  search: '', status: '', assigned_to: '', page: 1, per_page: 50,
}

// ── Kanban: leads agrupados por status ────────────────────────────
export type KanbanBoard = Record<LeadStatus, Lead[]>

function groupByStatus(leads: Lead[]): KanbanBoard {
  const board: KanbanBoard = {
    nuevo: [], contactado: [], interesado: [],
    en_negociacion: [], cerrado_ganado: [], cerrado_perdido: [],
  }
  for (const lead of leads) {
    const col = lead.status as LeadStatus
    if (col in board) board[col].push(lead)
  }
  return board
}

// ── Hooks ──────────────────────────────────────────────────────────
export function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: () => {
      const p = new URLSearchParams()
      if (filters.search)      p.set('search',      filters.search)
      if (filters.status)      p.set('status',      filters.status)
      if (filters.assigned_to) p.set('assigned_to', filters.assigned_to)
      p.set('page',     String(filters.page))
      p.set('per_page', String(filters.per_page))
      return apiGet<Paginated<Lead>>(`/leads?${p.toString()}`)
    },
  })
}

export function useLeadKanban(filters: Omit<LeadFilters, 'status' | 'page' | 'per_page'>) {
  return useQuery({
    queryKey: ['leads-kanban', filters],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (filters.search)      p.set('search',      filters.search)
      if (filters.assigned_to) p.set('assigned_to', filters.assigned_to)
      p.set('per_page', '200') // carga todo para el Kanban
      const res = await apiGet<Paginated<Lead>>(`/leads?${p.toString()}`)
      return groupByStatus(res.data)
    },
    staleTime: 30_000,
  })
}

export function useLead(id: string | null) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => apiGet<Lead>(`/leads/${id}`),
    enabled: !!id,
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Lead>) => apiPost<Lead>('/leads', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['leads-kanban'] })
    },
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Lead> & { id: string }) =>
      apiPut<Lead>(`/leads/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['leads-kanban'] })
      qc.invalidateQueries({ queryKey: ['lead', vars.id] })
    },
  })
}

export function useMoveLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      apiPatch<Lead>(`/leads/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['leads-kanban'] })
    },
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/leads/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['leads-kanban'] })
    },
  })
}
