import { NavLink, useLocation } from 'react-router-dom'
import {
  Car, Users, ShoppingCart, Wrench, Wallet,
  Handshake, FileText, LayoutDashboard, Settings,
  ChevronLeft, ChevronRight, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore, useRole } from '@/store/authStore'
import type { UserRole } from '@/store/authStore'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',       roles: ['admin', 'vendedor', 'cajero', 'mecanico'] },
  { to: '/stock',         icon: Car,             label: 'Stock',           roles: ['admin', 'vendedor'] },
  { to: '/crm',           icon: Users,           label: 'CRM / Leads',     roles: ['admin', 'vendedor'] },
  { to: '/ventas',        icon: ShoppingCart,    label: 'Ventas',          roles: ['admin', 'vendedor', 'cajero'] },
  { to: '/usados',        icon: Car,             label: 'Usados',          roles: ['admin', 'vendedor'] },
  { to: '/taller',        icon: Wrench,          label: 'Taller',          roles: ['admin', 'mecanico', 'vendedor'] },
  { to: '/caja',          icon: Wallet,          label: 'Caja',            roles: ['admin', 'cajero'] },
  { to: '/consignaciones',icon: Handshake,       label: 'Consignaciones',  roles: ['admin', 'vendedor'] },
  { to: '/documentos',    icon: FileText,        label: 'Documentos',      roles: ['admin', 'vendedor', 'cajero'] },
  { to: '/configuracion', icon: Settings,        label: 'Configuración',   roles: ['admin'] },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const role = useRole()
  const { signOut, profile } = useAuthStore()
  const location = useLocation()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !role || item.roles.includes(role)
  )

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-brand-900 text-white flex flex-col',
        'transition-all duration-300 ease-in-out z-40',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-brand-800',
        collapsed ? 'justify-center' : 'gap-3'
      )}>
        <div className="flex-shrink-0 w-8 h-8 bg-white rounded-lg flex items-center justify-center">
          <Car className="h-5 w-5 text-brand-800" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-white text-sm leading-tight">DM Cars</p>
            <p className="text-brand-300 text-xs truncate">Concesionaria</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                'transition-colors group',
                isActive
                  ? 'bg-brand-700 text-white'
                  : 'text-brand-200 hover:bg-brand-800 hover:text-white'
              )}
            >
              <Icon className={cn('flex-shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Usuario + cerrar sesión */}
      <div className="border-t border-brand-800 p-3 space-y-2">
        {!collapsed && profile && (
          <div className="px-2 py-1">
            <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
            <p className="text-xs text-brand-300 capitalize">{profile.role}</p>
          </div>
        )}
        <button
          onClick={() => signOut()}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
            'text-brand-300 hover:bg-brand-800 hover:text-white transition-colors'
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && 'Cerrar sesión'}
        </button>
      </div>

      {/* Toggle collapse */}
      <button
        onClick={onToggle}
        className={cn(
          'absolute -right-3 top-20 w-6 h-6 rounded-full',
          'bg-brand-700 border-2 border-brand-900',
          'flex items-center justify-center text-white',
          'hover:bg-brand-600 transition-colors z-50'
        )}
      >
        {collapsed
          ? <ChevronRight className="h-3 w-3" />
          : <ChevronLeft className="h-3 w-3" />
        }
      </button>
    </aside>
  )
}
