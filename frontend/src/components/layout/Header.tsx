import { Menu, Sun, Moon, Bell } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard':      'Dashboard',
  '/stock':          'Stock de Vehículos',
  '/crm':            'CRM / Leads',
  '/ventas':         'Ventas',
  '/usados':         'Toma de Usados',
  '/taller':         'Taller',
  '/caja':           'Caja',
  '/consignaciones': 'Consignaciones',
  '/documentos':     'Documentos',
  '/configuracion':  'Configuración',
}

interface HeaderProps {
  collapsed: boolean
  onToggle: () => void
  darkMode: boolean
  onToggleDark: () => void
}

export function Header({ collapsed, onToggle, darkMode, onToggleDark }: HeaderProps) {
  const { pathname } = useLocation()
  const { profile } = useAuthStore()

  // Match the deepest segment first
  const label =
    Object.entries(ROUTE_LABELS)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) => pathname.startsWith(path))?.[1] ?? 'DM Cars'

  const initials = profile?.full_name
    ? profile.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?'

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-16 bg-white dark:bg-gray-900',
        'border-b border-gray-200 dark:border-gray-800',
        'flex items-center justify-between px-4 z-30',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'left-16' : 'left-60'
      )}
    >
      {/* Left: hamburger (mobile) + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{label}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
            DM Cars — Concesionaria
          </p>
        </div>
      </div>

      {/* Right: dark mode toggle + notifications + avatar */}
      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={onToggleDark}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications (placeholder) */}
        <button
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-white text-xs font-bold select-none">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-gray-800 dark:text-gray-100 leading-tight">
              {profile?.full_name ?? '—'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
              {profile?.role ?? '—'}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
