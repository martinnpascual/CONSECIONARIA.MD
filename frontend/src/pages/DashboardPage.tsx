import { Car, Users, ShoppingCart, Wrench, TrendingUp, Activity, Wifi } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  useDashboardKPIs,
  useDashboardVentasSemana,
  useDashboardActividad,
} from '@/hooks/useDashboard'

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtARS(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  cotizacion: { label: 'Cotización',  cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  reserva:    { label: 'Reserva',     cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  en_proceso: { label: 'En proceso',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  entregada:  { label: 'Entregada',   cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  cancelada:  { label: 'Cancelada',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  recibido:   { label: 'Recibido',    cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  listo:      { label: 'Listo',       cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  entregado:  { label: 'Entregado',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  cancelado:  { label: 'Cancelado',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}

// ── Bar chart CSS ─────────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; cantidad: number; monto: number }[] }) {
  const maxMonto = Math.max(...data.map(d => d.monto), 1)
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 h-28">
        {data.map((d) => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {d.cantidad > 0 ? d.cantidad : ''}
            </span>
            <div
              className="w-full rounded-t bg-brand-500 dark:bg-brand-400 transition-all duration-500 min-h-[4px]"
              style={{ height: `${(d.monto / maxMonto) * 88}px` }}
              title={fmtARS(d.monto)}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center">
            <span className="text-xs text-gray-400">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string
  value: number | undefined
  loading: boolean
  icon: React.ReactNode
  color: string
  sub?: string
  accent?: { label: string; cls: string }
}

function KPICard({ label, value, loading, icon, color, sub, accent }: KPICardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl flex-shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
        {loading ? (
          <Skeleton className="h-8 w-12 mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
            {value ?? 0}
          </p>
        )}
        {sub && !loading && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        {accent && !loading && <p className={`text-xs mt-0.5 font-medium ${accent.cls}`}>{accent.label}</p>}
      </div>
    </div>
  )
}

// ── DashboardPage ─────────────────────────────────────────────────────────

export function DashboardPage() {
  const { data: kpis, isLoading: kLoading } = useDashboardKPIs()
  const { data: ventas = [] }               = useDashboardVentasSemana()
  const { data: actividad = [] }            = useDashboardActividad()

  const totalVentasMes = ventas.reduce((s, v) => s + v.monto, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Resumen operativo de DM Cars</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
          <Wifi className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Tiempo real</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Vehículos disponibles"
          value={kpis?.vehiculosDisponibles}
          loading={kLoading}
          icon={<Car className="h-5 w-5" />}
          color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        />
        <KPICard
          label="Leads activos"
          value={kpis?.leadsActivos}
          loading={kLoading}
          icon={<Users className="h-5 w-5" />}
          color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
        />
        <KPICard
          label="Ventas del mes"
          value={kpis?.ventasMes}
          loading={kLoading}
          icon={<ShoppingCart className="h-5 w-5" />}
          color="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
          sub={totalVentasMes > 0 ? fmtARS(totalVentasMes) : undefined}
        />
        <KPICard
          label="OTs en proceso"
          value={kpis?.otEnProceso}
          loading={kLoading}
          icon={<Wrench className="h-5 w-5" />}
          color="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
          accent={
            kpis != null
              ? kpis.cajaAbierta
                ? { label: 'Caja abierta', cls: 'text-green-600 dark:text-green-400' }
                : { label: 'Caja cerrada', cls: 'text-gray-400' }
              : undefined
          }
        />
      </div>

      {/* Fila inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Gráfico ventas */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Ventas del mes</p>
            </div>
            {totalVentasMes > 0 && (
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                {fmtARS(totalVentasMes)}
              </span>
            )}
          </div>
          {ventas.some(v => v.cantidad > 0) ? (
            <BarChart data={ventas} />
          ) : (
            <div className="h-36 flex items-center justify-center text-sm text-gray-400">
              Sin ventas este mes
            </div>
          )}
        </div>

        {/* Actividad reciente */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Actividad reciente</p>
          </div>

          {actividad.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              Sin actividad reciente
            </div>
          ) : (
            <ul className="space-y-1">
              {actividad.map((item) => {
                const badge = ESTADO_BADGE[item.estado]
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                        item.tipo === 'venta'
                          ? 'bg-purple-100 dark:bg-purple-900/30'
                          : 'bg-orange-100 dark:bg-orange-900/30'
                      }`}>
                        {item.tipo === 'venta'
                          ? <ShoppingCart className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                          : <Wrench className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                        }
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {item.descripcion}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {badge && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 hidden sm:block">
                        {fmtDate(item.fecha)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
