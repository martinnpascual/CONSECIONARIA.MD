import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { LeadCard } from './LeadCard'
import { Badge } from '@/components/ui/Badge'
import type { Lead } from '@/types'
import type { KanbanBoard, LeadStatus } from '@/hooks/useLeads'
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from '@/hooks/useLeads'

// Colores por columna
const COLUMN_STYLES: Record<LeadStatus, { header: string; dot: string; count: string }> = {
  nuevo:           { header: 'border-t-gray-400',   dot: 'bg-gray-400',   count: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  contactado:      { header: 'border-t-blue-400',   dot: 'bg-blue-400',   count: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' },
  interesado:      { header: 'border-t-yellow-400', dot: 'bg-yellow-400', count: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  en_negociacion:  { header: 'border-t-orange-400', dot: 'bg-orange-400', count: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  cerrado_ganado:  { header: 'border-t-green-400',  dot: 'bg-green-400',  count: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  cerrado_perdido: { header: 'border-t-red-400',    dot: 'bg-red-400',    count: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300' },
}

interface LeadKanbanProps {
  board: KanbanBoard
  onDragEnd: (result: DropResult) => void
  onLeadClick: (lead: Lead) => void
}

export function LeadKanban({ board, onDragEnd, onLeadClick }: LeadKanbanProps) {
  // Columnas activas: excluir cerradas de la vista principal si están vacías
  const visibleCols = LEAD_STATUSES

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-220px)]">
        {visibleCols.map((status) => {
          const leads = board[status]
          const styles = COLUMN_STYLES[status]

          return (
            <div
              key={status}
              className={`flex-shrink-0 w-64 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-t-4 ${styles.header} border border-gray-200 dark:border-gray-700 flex flex-col`}
            >
              {/* Header columna */}
              <div className="px-3 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {LEAD_STATUS_LABELS[status]}
                  </span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles.count}`}>
                  {leads.length}
                </span>
              </div>

              {/* Droppable area */}
              <Droppable droppableId={status}>
                {(dropProvided, snapshot) => (
                  <div
                    ref={dropProvided.innerRef}
                    {...dropProvided.droppableProps}
                    className={`flex-1 p-2 space-y-2 overflow-y-auto transition-colors ${
                      snapshot.isDraggingOver
                        ? 'bg-brand-50 dark:bg-brand-900/10 rounded-b-xl'
                        : ''
                    }`}
                  >
                    {leads.map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(dragProvided) => (
                          <LeadCard
                            lead={lead}
                            provided={dragProvided}
                            onClick={onLeadClick}
                          />
                        )}
                      </Draggable>
                    ))}
                    {dropProvided.placeholder}

                    {leads.length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-center text-xs text-gray-300 dark:text-gray-600 pt-6">
                        Sin leads
                      </p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
