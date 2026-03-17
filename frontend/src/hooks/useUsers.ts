import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut } from '@/lib/api'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'vendedor' | 'cajero' | 'mecanico'
  phone: string | null
  avatar_url: string | null
  is_active: boolean
}

export interface CreateUserData {
  email: string
  password: string
  full_name: string
  role: UserProfile['role']
  phone?: string
}

export interface UpdateUserData {
  role?: UserProfile['role']
  is_active?: boolean
}

const ROLE_LABELS: Record<UserProfile['role'], string> = {
  admin:    'Administrador',
  vendedor: 'Vendedor',
  cajero:   'Cajero',
  mecanico: 'Mecánico',
}

export { ROLE_LABELS }

// ── Listar usuarios (admin only) ──
export function useUsers() {
  return useQuery<UserProfile[]>({
    queryKey: ['users'],
    queryFn: () => apiGet('/auth/users'),
    staleTime: 60_000,
  })
}

// ── Crear usuario ──
export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUserData) => apiPost('/auth/users', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}

// ── Actualizar rol/estado ──
export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateUserData) =>
      apiPut(`/auth/users/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}
