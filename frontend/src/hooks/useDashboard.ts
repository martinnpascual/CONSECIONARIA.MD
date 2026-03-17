/**
 * hooks/useDashboard.ts — KPIs y Realtime del Dashboard
 *
 * Consulta directamente Supabase (sin backend) para máxima velocidad.
 * Suscripciones Realtime actualizan los contadores en tiempo real.
 */
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface DashboardKPIs {
  vehiculosDisponibles: number
  leadsActivos: number
  ventasMes: number
  otEnProceso: number
  cajaAbierta: boolean
}

export interface VentaSemanal {
  semana: number      // 1-5
  label: string       // 'Sem 1', etc.
  cantidad: number
  monto: number
}

export interface ActividadReciente {
  id: string
  tipo: 'venta' | 'ot' | 'consignacion'
  descripcion: string
  fecha: string
  estado: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function inicioMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

function finMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
}

function semanaDelMes(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00')
  return Math.ceil(d.getDate() / 7)
}

// ── KPIs ──────────────────────────────────────────────────────────────────

async function fetchKPIs(): Promise<DashboardKPIs> {
  const [
    { count: vehiculos },
    { count: leads },
    { count: ventas },
    { count: ots },
    { data: caja },
  ] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'disponible')
      .is('deleted_at', null),
    supabase
      .from('persons')
      .select('id', { count: 'exact', head: true })
      .in('lead_status', ['nuevo', 'contactado', 'interesado', 'en_negociacion'])
      .is('deleted_at', null),
    supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'cancelada')
      .gte('sale_date', inicioMes())
      .lte('sale_date', finMes())
      .is('deleted_at', null),
    supabase
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'en_proceso')
      .is('deleted_at', null),
    supabase
      .from('cash_registers')
      .select('id')
      .eq('status', 'abierta')
      .limit(1),
  ])

  return {
    vehiculosDisponibles: vehiculos ?? 0,
    leadsActivos:         leads    ?? 0,
    ventasMes:            ventas   ?? 0,
    otEnProceso:          ots      ?? 0,
    cajaAbierta:          (caja?.length ?? 0) > 0,
  }
}

// ── Ventas del mes agrupadas por semana ───────────────────────────────────

async function fetchVentasSemana(): Promise<VentaSemanal[]> {
  const { data } = await supabase
    .from('sales')
    .select('sale_date, final_price')
    .neq('status', 'cancelada')
    .gte('sale_date', inicioMes())
    .lte('sale_date', finMes())
    .is('deleted_at', null)

  const mapa: Record<number, { cantidad: number; monto: number }> = {
    1: { cantidad: 0, monto: 0 },
    2: { cantidad: 0, monto: 0 },
    3: { cantidad: 0, monto: 0 },
    4: { cantidad: 0, monto: 0 },
    5: { cantidad: 0, monto: 0 },
  }

  for (const venta of data ?? []) {
    const sem = semanaDelMes(venta.sale_date)
    if (mapa[sem]) {
      mapa[sem].cantidad++
      mapa[sem].monto += Number(venta.final_price ?? 0)
    }
  }

  return Object.entries(mapa).map(([sem, v]) => ({
    semana:   Number(sem),
    label:    `Sem ${sem}`,
    cantidad: v.cantidad,
    monto:    v.monto,
  }))
}

// ── Actividad reciente ────────────────────────────────────────────────────

async function fetchActividad(): Promise<ActividadReciente[]> {
  const [{ data: ventas }, { data: ots }] = await Promise.all([
    supabase
      .from('sales')
      .select('id, sale_number, status, created_at, persons!sales_client_id_fkey(first_name, last_name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('work_orders')
      .select('id, order_number, status, work_type, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const actividad: ActividadReciente[] = []

  for (const v of ventas ?? []) {
    const persona = (v as any).persons
    const nombre = persona ? `${persona.first_name} ${persona.last_name}` : 'Cliente'
    actividad.push({
      id:          v.id,
      tipo:        'venta',
      descripcion: `Venta ${v.sale_number} — ${nombre}`,
      fecha:       v.created_at,
      estado:      v.status,
    })
  }

  for (const ot of ots ?? []) {
    actividad.push({
      id:          ot.id,
      tipo:        'ot',
      descripcion: `OT ${ot.order_number} — ${ot.work_type}`,
      fecha:       ot.created_at,
      estado:      ot.status,
    })
  }

  // Ordenar por fecha desc y tomar los 8 más recientes
  return actividad
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 8)
}

// ── Hooks públicos ────────────────────────────────────────────────────────

export function useDashboardKPIs() {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: fetchKPIs,
    refetchInterval: 60_000, // fallback cada 60s
    staleTime: 30_000,
  })

  // Suscripciones Realtime
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
        qc.invalidateQueries({ queryKey: ['dashboard-ventas-semana'] })
        qc.invalidateQueries({ queryKey: ['dashboard-actividad'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
        qc.invalidateQueries({ queryKey: ['dashboard-actividad'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interactions' }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [qc])

  return query
}

export function useDashboardVentasSemana() {
  return useQuery({
    queryKey: ['dashboard-ventas-semana'],
    queryFn: fetchVentasSemana,
    staleTime: 60_000,
  })
}

export function useDashboardActividad() {
  return useQuery({
    queryKey: ['dashboard-actividad'],
    queryFn: fetchActividad,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
