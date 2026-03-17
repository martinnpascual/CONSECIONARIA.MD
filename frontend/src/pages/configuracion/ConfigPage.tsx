import { useState } from 'react'
import { Settings, Users, Building2, Plus, Pencil, ToggleLeft, ToggleRight, Eye, EyeOff } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useIsAdmin } from '@/store/authStore'
import { useBusinessConfig, useUpdateBusinessConfig } from '@/hooks/useConfig'
import { useUsers, useCreateUser, useUpdateUser, ROLE_LABELS } from '@/hooks/useUsers'
import type { UserProfile } from '@/hooks/useUsers'

type Tab = 'concesionaria' | 'usuarios'

// ── Badges de rol ──────────────────────────────────────────────────
const ROLE_COLORS: Record<UserProfile['role'], string> = {
  admin:    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  vendedor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  cajero:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  mecanico: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}

// ── Modal para crear/editar usuario ───────────────────────────────
interface UserModalProps {
  user?: UserProfile
  onClose: () => void
}

function UserModal({ user, onClose }: UserModalProps) {
  const isEdit = !!user
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()

  const [email, setEmail]       = useState(user?.email ?? '')
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [role, setRole]         = useState<UserProfile['role']>(user?.role ?? 'vendedor')
  const [phone, setPhone]       = useState(user?.phone ?? '')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (isEdit) {
        await updateUser.mutateAsync({ id: user.id, role })
        toast.success('Usuario actualizado')
      } else {
        if (!password || password.length < 8) {
          toast.error('La contraseña debe tener al menos 8 caracteres')
          return
        }
        await createUser.mutateAsync({ email, full_name: fullName, role, phone: phone || undefined, password })
        toast.success('Usuario creado correctamente')
      }
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(msg)
    }
  }

  const roleOptions = [
    { value: 'admin',    label: 'Administrador' },
    { value: 'vendedor', label: 'Vendedor' },
    { value: 'cajero',   label: 'Cajero' },
    { value: 'mecanico', label: 'Mecánico' },
  ]

  const isPending = createUser.isPending || updateUser.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isEdit && (
            <>
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendedor@dmcars.com"
              />
              <Input
                label="Nombre completo"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan García"
              />
              <div className="relative">
                <Input
                  label="Contraseña"
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Input
                label="Teléfono (opcional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+54 9 11 1234-5678"
              />
            </>
          )}

          <Select
            label="Rol"
            value={role}
            onChange={(e) => setRole(e.target.value as UserProfile['role'])}
            options={roleOptions}
          />

          {isEdit && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Solo se puede modificar el rol. Para cambiar email o contraseña, usar el panel de Supabase.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" isLoading={isPending}>
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tab Usuarios ──────────────────────────────────────────────────
function TabUsuarios() {
  const { data: users, isLoading } = useUsers()
  const updateUser = useUpdateUser()
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser]   = useState<UserProfile | undefined>()

  function openCreate() { setEditUser(undefined); setShowModal(true) }
  function openEdit(u: UserProfile) { setEditUser(u); setShowModal(true) }

  async function toggleActive(u: UserProfile) {
    try {
      await updateUser.mutateAsync({ id: u.id, is_active: !u.is_active })
      toast.success(u.is_active ? 'Usuario desactivado' : 'Usuario activado')
    } catch {
      toast.error('Error al cambiar el estado')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {users ? `${users.length} usuario${users.length !== 1 ? 's' : ''}` : ''}
        </p>
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Nuevo usuario
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && users && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
          {users.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Sin usuarios registrados</p>
          ) : users.map(u => (
            <div key={u.id} className={`flex items-center gap-4 px-4 py-3 ${!u.is_active ? 'opacity-50' : ''}`}>
              {/* Avatar */}
              <div className="h-9 w-9 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                  {(u.full_name ?? u.email)[0].toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {u.full_name ?? '—'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
              </div>

              {/* Rol badge */}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_COLORS[u.role]}`}>
                {ROLE_LABELS[u.role]}
              </span>

              {/* Acciones */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => openEdit(u)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Editar rol"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => toggleActive(u)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                  title={u.is_active ? 'Desactivar' : 'Activar'}
                >
                  {u.is_active
                    ? <ToggleRight className="h-4 w-4 text-green-500" />
                    : <ToggleLeft className="h-4 w-4" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !users && (
        <div className="text-center py-12 text-gray-400 text-sm">
          <p>No se pudo conectar al servidor</p>
          <p className="text-xs mt-1">El backend debe estar en línea para gestionar usuarios</p>
        </div>
      )}

      {showModal && (
        <UserModal user={editUser} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}

// ── Tab Concesionaria ─────────────────────────────────────────────
function TabConcesionaria() {
  const { data: config, isLoading } = useBusinessConfig()
  const updateConfig = useUpdateBusinessConfig()
  const [editing, setEditing] = useState(false)

  // Form state — inicializado cuando config carga
  const [form, setForm] = useState<Record<string, string | number>>({})

  function startEdit() {
    if (!config) return
    setForm({
      name:             config.name,
      legal_name:       config.legal_name,
      cuit:             config.cuit,
      iva_condition:    config.iva_condition,
      address:          config.address ?? '',
      city:             config.city ?? '',
      province:         config.province ?? '',
      postal_code:      config.postal_code ?? '',
      phone:            config.phone ?? '',
      email:            config.email ?? '',
      website:          config.website ?? '',
      afip_punto_venta: config.afip_punto_venta,
      stock_alert_days: config.stock_alert_days,
      commission_pct:   config.commission_pct,
      reservation_days: config.reservation_days,
      usd_rate:         config.usd_rate ?? '',
    })
    setEditing(true)
  }

  function set(key: string, value: string | number) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    try {
      await updateConfig.mutateAsync({
        name:             String(form.name),
        legal_name:       String(form.legal_name),
        cuit:             String(form.cuit),
        iva_condition:    form.iva_condition as 'responsable_inscripto' | 'monotributo' | 'exento',
        address:          String(form.address) || null,
        city:             String(form.city) || null,
        province:         String(form.province) || null,
        postal_code:      String(form.postal_code) || null,
        phone:            String(form.phone) || null,
        email:            String(form.email) || null,
        website:          String(form.website) || null,
        afip_punto_venta: Number(form.afip_punto_venta),
        stock_alert_days: Number(form.stock_alert_days),
        commission_pct:   Number(form.commission_pct),
        reservation_days: Number(form.reservation_days),
        usd_rate:         form.usd_rate !== '' ? Number(form.usd_rate) : null,
      })
      toast.success('Configuración guardada')
      setEditing(false)
    } catch {
      toast.error('Error al guardar la configuración')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!config) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        <p>No se pudo conectar al servidor</p>
        <p className="text-xs mt-1">El backend debe estar en línea para ver la configuración</p>
      </div>
    )
  }

  const ivaOptions = [
    { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
    { value: 'monotributo',           label: 'Monotributista' },
    { value: 'exento',                label: 'Exento' },
  ]

  if (!editing) {
    // Vista de solo lectura
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={startEdit}>
            Editar configuración
          </Button>
        </div>

        <Section title="Datos de la empresa">
          <Row label="Nombre comercial"  value={config.name} />
          <Row label="Razón social"      value={config.legal_name} />
          <Row label="CUIT"              value={config.cuit} />
          <Row label="Condición IVA"     value={ivaOptions.find(o => o.value === config.iva_condition)?.label ?? config.iva_condition} />
        </Section>

        <Section title="Contacto y ubicación">
          <Row label="Dirección"   value={config.address ?? '—'} />
          <Row label="Ciudad"      value={config.city ?? '—'} />
          <Row label="Provincia"   value={config.province ?? '—'} />
          <Row label="Código postal" value={config.postal_code ?? '—'} />
          <Row label="Teléfono"    value={config.phone ?? '—'} />
          <Row label="Email"       value={config.email ?? '—'} />
          <Row label="Sitio web"   value={config.website ?? '—'} />
        </Section>

        <Section title="Parámetros operativos">
          <Row label="Punto de venta AFIP"   value={String(config.afip_punto_venta)} />
          <Row label="Días alerta de stock"  value={`${config.stock_alert_days} días`} />
          <Row label="Comisión base vendedor" value={`${config.commission_pct}%`} />
          <Row label="Días máx. de reserva" value={`${config.reservation_days} días`} />
          {config.usd_rate && (
            <Row
              label="Tipo de cambio USD"
              value={`$ ${Number(config.usd_rate).toLocaleString('es-AR')}`}
            />
          )}
        </Section>
      </div>
    )
  }

  // Formulario de edición
  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Section title="Datos de la empresa">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre comercial" required value={String(form.name)} onChange={e => set('name', e.target.value)} />
          <Input label="Razón social" required value={String(form.legal_name)} onChange={e => set('legal_name', e.target.value)} />
          <Input label="CUIT" required value={String(form.cuit)} onChange={e => set('cuit', e.target.value)} placeholder="30-12345678-9" />
          <Select
            label="Condición IVA"
            value={String(form.iva_condition)}
            onChange={e => set('iva_condition', e.target.value)}
            options={ivaOptions}
          />
        </div>
      </Section>

      <Section title="Contacto y ubicación">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input label="Dirección" value={String(form.address)} onChange={e => set('address', e.target.value)} placeholder="Av. Ejemplo 1234" />
          </div>
          <Input label="Ciudad" value={String(form.city)} onChange={e => set('city', e.target.value)} />
          <Input label="Provincia" value={String(form.province)} onChange={e => set('province', e.target.value)} />
          <Input label="Código postal" value={String(form.postal_code)} onChange={e => set('postal_code', e.target.value)} />
          <Input label="Teléfono" value={String(form.phone)} onChange={e => set('phone', e.target.value)} />
          <Input label="Email" type="email" value={String(form.email)} onChange={e => set('email', e.target.value)} />
          <Input label="Sitio web" value={String(form.website)} onChange={e => set('website', e.target.value)} placeholder="https://dmcars.com.ar" />
        </div>
      </Section>

      <Section title="Parámetros operativos">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Punto de venta AFIP"
            type="number" min="1" max="9999"
            value={String(form.afip_punto_venta)}
            onChange={e => set('afip_punto_venta', e.target.value)}
          />
          <Input
            label="Días alerta de stock"
            type="number" min="1"
            value={String(form.stock_alert_days)}
            onChange={e => set('stock_alert_days', e.target.value)}
          />
          <Input
            label="Comisión base vendedor (%)"
            type="number" min="0" max="100" step="0.01"
            value={String(form.commission_pct)}
            onChange={e => set('commission_pct', e.target.value)}
          />
          <Input
            label="Días máx. de reserva"
            type="number" min="1"
            value={String(form.reservation_days)}
            onChange={e => set('reservation_days', e.target.value)}
          />
          <Input
            label="Tipo de cambio USD (ARS)"
            type="number" min="0" step="0.01"
            value={String(form.usd_rate)}
            onChange={e => set('usd_rate', e.target.value)}
            placeholder="Ej: 1050"
          />
        </div>
      </Section>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" isLoading={updateConfig.isPending}>
          Guardar configuración
        </Button>
      </div>
    </form>
  )
}

// ── Helpers de layout ─────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h3>
      <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 space-y-2">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export function ConfigPage() {
  const isAdmin = useIsAdmin()
  const [tab, setTab] = useState<Tab>('concesionaria')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'concesionaria', label: 'Concesionaria', icon: <Building2 className="h-4 w-4" /> },
    { id: 'usuarios',      label: 'Usuarios',      icon: <Users className="h-4 w-4" /> },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-brand-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Administración del sistema DM Cars</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium rounded-lg px-4 py-2 transition-colors
              ${tab === t.id
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {!isAdmin ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
          <Settings className="h-10 w-10" />
          <p className="text-sm font-medium">Acceso restringido</p>
          <p className="text-xs">Solo los administradores pueden acceder a la configuración</p>
        </div>
      ) : (
        <div>
          {tab === 'concesionaria' && <TabConcesionaria />}
          {tab === 'usuarios'      && <TabUsuarios />}
        </div>
      )}
    </div>
  )
}
