import { useState, useCallback } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { Plus, LayoutGrid, List, Search } from 'lucide-react'
import type { DropResult } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { LeadKanban } from '@/components/crm/LeadKanban'
import { LeadFormModal } from '@/components/crm/LeadFormModal'
import { PersonFormModal } from '@/components/crm/PersonFormModal'
import { PersonDetailPage } from './PersonDetailPage'
import { useLeadKanban, useMoveLead } from '@/hooks/useLeads'
import { usePersons, DEFAULT_PERSON_FILTERS } from '@/hooks/usePersons'
import { debounce, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Lead } from '@/types'

// ── Vista Kanban ──────────────────────────────────────────────────
function KanbanView() {
  const [search,  setSearch]  = useState('')
  const [dSearch, setDSearch] = useState('')
  const { data: board, isLoading } = useLeadKanban({ search: dSearch })
  const moveLead = useMoveLead()
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateSearch = useCallback(
    debounce((v: string) => setDSearch(v), 300), []
  )

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    if (result.source.droppableId === result.destination.droppableId) return
    try {
      await moveLead.mutateAsync({ id: result.draggableId, status: result.destination.droppableId as any })
    } catch {
      toast.error('Error al mover el lead')
    }
  }

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto">
        {[1,2,3,4,5,6].map((i) => (
          <div key={i} className="w-64 shrink-0 space-y-2">
            <Skeleton className="h-8 rounded-lg" />
            {[1,2].map((j) => <Skeleton key={j} className="h-24 rounded-lg" />)}
          </div>
        ))}
      </div>
    )
  }

  const totalLeads = board ? Object.values(board).flat().length : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-64">
            <Input
              placeholder="Buscar lead..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); updateSearch(e.target.value) }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">{totalLeads} leads</span>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setNewLeadOpen(true)}>
          Nuevo lead
        </Button>
      </div>

      {board && (
        <LeadKanban board={board} onDragEnd={handleDragEnd} onLeadClick={setEditingLead} />
      )}

      <LeadFormModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
      <LeadFormModal lead={editingLead} open={!!editingLead} onClose={() => setEditingLead(null)} />
    </div>
  )
}

// ── Vista Lista de Personas ────────────────────────────────────────
function PersonsView() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(DEFAULT_PERSON_FILTERS)
  const [search,  setSearch]  = useState('')
  const { data, isLoading }   = usePersons(filters)
  const [newPersonOpen, setNewPersonOpen] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateSearch = useCallback(
    debounce((v: string) => setFilters((f) => ({ ...f, search: v, page: 1 })), 300), []
  )

  const persons = data?.data ?? []

  const TYPE_LABEL: Record<string, string> = {
    cliente: 'Cliente', prospecto: 'Prospecto', proveedor: 'Proveedor', otro: 'Otro',
  }
  const TYPE_VARIANT: Record<string, 'green' | 'blue' | 'purple' | 'gray'> = {
    cliente: 'green', prospecto: 'blue', proveedor: 'purple', otro: 'gray',
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-72">
          <Input
            placeholder="Buscar persona..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); updateSearch(e.target.value) }}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setNewPersonOpen(true)}>
          Nueva persona
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="p-4 flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : persons.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-600">
            Sin personas registradas
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {persons.map((p) => (
              <div
                key={p.id}
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={() => navigate(`/crm/personas/${p.id}`)}
              >
                <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-brand-700 dark:text-brand-300">
                    {p.first_name[0]}{p.last_name?.[0] ?? ''}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    {[p.phone, p.email].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={TYPE_VARIANT[p.person_type] ?? 'gray'}>
                    {TYPE_LABEL[p.person_type] ?? p.person_type}
                  </Badge>
                  <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                    {formatDate(p.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PersonFormModal open={newPersonOpen} onClose={() => setNewPersonOpen(false)} />
    </div>
  )
}

// ── CRMPage principal ──────────────────────────────────────────────
export function CRMPage() {
  const [view, setView] = useState<'kanban' | 'personas'>('kanban')

  return (
    <Routes>
      <Route
        index
        element={
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">CRM</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Pipeline de leads y gestión de clientes
                </p>
              </div>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                {(['kanban', 'personas'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      view === v
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {v === 'kanban' ? <LayoutGrid className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                    {v === 'kanban' ? 'Kanban' : 'Personas'}
                  </button>
                ))}
              </div>
            </div>

            {view === 'kanban' ? <KanbanView /> : <PersonsView />}
          </div>
        }
      />
      <Route path="personas/:id" element={<PersonDetailPage />} />
    </Routes>
  )
}
