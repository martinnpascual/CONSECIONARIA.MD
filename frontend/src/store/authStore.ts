/**
 * store/authStore.ts — Estado global de autenticación
 *
 * Usa Zustand + Supabase Auth.
 * El rol del usuario se lee de user_profiles vía la API.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type UserRole = 'admin' | 'vendedor' | 'cajero' | 'mecanico'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url?: string
  is_active: boolean
}

interface AuthState {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  // Acciones
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      isLoading: true,
      isAuthenticated: false,

      initialize: async () => {
        set({ isLoading: true })
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            set({ user: session.user, isAuthenticated: true })
            await get().refreshProfile()
          }
        } finally {
          set({ isLoading: false })
        }

        // Escuchar cambios de sesión
        supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            set({ user: session.user, isAuthenticated: true })
            await get().refreshProfile()
          } else {
            set({ user: null, profile: null, isAuthenticated: false })
          }
        })
      },

      signIn: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },

      signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, profile: null, isAuthenticated: false })
      },

      refreshProfile: async () => {
        try {
          // Importar dinámicamente para evitar circular deps
          const { apiGet } = await import('@/lib/api')
          const profile = await apiGet<UserProfile>('/auth/me')
          set({ profile })
        } catch (err: any) {
          // Solo limpiar sesión en errores de autorización, no en errores de red
          if (err?.response?.status === 401 || err?.response?.status === 403) {
            set({ user: null, profile: null, isAuthenticated: false })
          }
          // Si el backend no está disponible, mantener la sesión activa
        }
      },
    }),
    {
      name: 'dm-cars-auth',
      partialize: (state) => ({ profile: state.profile }),
    }
  )
)

// Selector helpers
export const useIsAdmin = () => useAuthStore((s) => s.profile?.role === 'admin')
export const useRole = () => useAuthStore((s) => s.profile?.role)
export const useProfile = () => useAuthStore((s) => s.profile)
