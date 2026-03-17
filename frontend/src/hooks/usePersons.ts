import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import type { Person, Interaction, Paginated } from '@/types'

// ── Filtros ────────────────────────────────────────────────────────
export interface PersonFilters {
  search: string
  person_type: string
  page: number
  per_page: number
}

export const DEFAULT_PERSON_FILTERS: PersonFilters = {
  search: '', person_type: '', page: 1, per_page: 20,
}

// ── Hooks: personas ───────────────────────────────────────────────
export function usePersons(filters: PersonFilters) {
  return useQuery({
    queryKey: ['persons', filters],
    queryFn: () => {
      const p = new URLSearchParams()
      if (filters.search)      p.set('search',      filters.search)
      if (filters.person_type) p.set('person_type', filters.person_type)
      p.set('page',     String(filters.page))
      p.set('per_page', String(filters.per_page))
      return apiGet<Paginated<Person>>(`/persons?${p.toString()}`)
    },
    placeholderData: (prev) => prev,
  })
}

export function usePerson(id: string | null) {
  return useQuery({
    queryKey: ['person', id],
    queryFn: () => apiGet<Person>(`/persons/${id}`),
    enabled: !!id,
  })
}

export function useCreatePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Person>) => apiPost<Person>('/persons', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  })
}

export function useUpdatePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Person> & { id: string }) =>
      apiPut<Person>(`/persons/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['persons'] })
      qc.invalidateQueries({ queryKey: ['person', vars.id] })
    },
  })
}

export function useDeletePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/persons/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  })
}

// ── Hooks: interacciones ──────────────────────────────────────────
export function useInteractions(personId: string | null) {
  return useQuery({
    queryKey: ['interactions', personId],
    queryFn: () => apiGet<Interaction[]>(`/persons/${personId}/interactions`),
    enabled: !!personId,
  })
}

export function useCreateInteraction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ personId, ...data }: Partial<Interaction> & { personId: string }) =>
      apiPost<Interaction>(`/persons/${personId}/interactions`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['interactions', vars.personId] })
      qc.invalidateQueries({ queryKey: ['person', vars.personId] })
    },
  })
}
