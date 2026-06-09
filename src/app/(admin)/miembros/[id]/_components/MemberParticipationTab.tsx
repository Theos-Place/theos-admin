import Link from 'next/link'
import { Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { STUDY_CATALOG } from '@/data/study-catalog'
import { cn } from '@/lib/utils'

const LOAD_MORE = 10

const TYPE_BADGE: Record<string, string> = {
  Charla: 'bg-navy/10 text-navy',
  Campamento: 'bg-teal-soft/30 text-teal-deep',
  'Actividad Social': 'bg-coral-soft/20 text-coral',
  United: 'bg-navy-light/10 text-navy-light',
}

const ATTENDANCE_BADGE: Record<string, string> = {
  servidor: 'bg-coral-soft/20 text-coral',
  participante: 'bg-surface-low text-navy-light/70',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatAmount(n: number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(n)
}

function studyStageColor(stage: string): string {
  if (stage === 'niveles') return 'bg-navy/10 text-navy'
  if (stage === 'inicial') return 'bg-teal-soft/30 text-teal-deep'
  return 'bg-coral-soft/20 text-coral'
}

function SectionAccordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--outline-variant)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 bg-surface-card hover:bg-surface-low transition-colors"
      >
        <span
          className="text-sm font-medium text-navy"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}
        >
          {title}
        </span>
        {open ? (
          <ChevronUp size={16} strokeWidth={1.75} className="text-navy-light/50" />
        ) : (
          <ChevronDown size={16} strokeWidth={1.75} className="text-navy-light/50" />
        )}
      </button>
      {open && <div className="bg-surface-card">{children}</div>}
    </div>
  )
}

export type StudyRow = { code: string; name: string; startYear: number; startLabel: string; duration: string; status: string; groupId: string }
export type ServiceRow = { position: string; committee: string; from: string; to: string; status: string }
export type EventoRow = { name: string; type: string; date: string; attendance_type: string }
export type DonacionRow = { date: string; description: string; amount: number }

type SortableTableResult<T> = {
  sorted: T[]
  sortKey: keyof T | null
  sortDir: 'asc' | 'desc'
  toggleSort: (key: keyof T) => void
}

type OpenSections = {
  estudios: boolean
  servicio: boolean
  eventos: boolean
  donaciones: boolean
}

type Props = {
  openSections: OpenSections
  onToggleSection: (key: keyof OpenSections) => void
  estudiosTable: SortableTableResult<StudyRow>
  servicioTable: SortableTableResult<ServiceRow>
  eventosTable: SortableTableResult<EventoRow>
  donacionesTable: SortableTableResult<DonacionRow>
  visibleEstudios: number
  visibleServicio: number
  visibleEventos: number
  visibleDonaciones: number
  onLoadMoreEstudios: () => void
  onLoadMoreServicio: () => void
  onLoadMoreEventos: () => void
  onLoadMoreDonaciones: () => void
  hasFinanceRole: boolean
  revealDonations: boolean
  onToggleRevealDonations: () => void
  donationsCount: number
}

export function MemberParticipationTab({
  openSections,
  onToggleSection,
  estudiosTable,
  servicioTable,
  eventosTable,
  donacionesTable,
  visibleEstudios,
  visibleServicio,
  visibleEventos,
  visibleDonaciones,
  onLoadMoreEstudios,
  onLoadMoreServicio,
  onLoadMoreEventos,
  onLoadMoreDonaciones,
  hasFinanceRole,
  revealDonations,
  onToggleRevealDonations,
  donationsCount,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Historial de estudios */}
      <SectionAccordion
        title="Historial de estudios"
        open={openSections.estudios}
        onToggle={() => onToggleSection('estudios')}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                {([['name', 'Estudio'], ['startYear', 'Inicio'], ['duration', 'Duración'], ['status', 'Estado']] as [keyof StudyRow, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => estudiosTable.toggleSort(key)}
                    className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/40 cursor-pointer hover:text-navy transition-colors select-none"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {label}{' '}
                    <span className="opacity-50">
                      {estudiosTable.sortKey === key ? (estudiosTable.sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {estudiosTable.sorted.slice(0, visibleEstudios).map((row, i) => {
                const entry = STUDY_CATALOG.find(s => s.code === row.code)
                return (
                  <tr
                    key={row.code}
                    style={i < Math.min(visibleEstudios, estudiosTable.sorted.length) - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                    className="hover:bg-surface-low transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn('rounded px-1.5 py-0.5 text-[10px]', entry ? studyStageColor(entry.stage) : 'bg-surface-low text-navy-light/50')}
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {row.code}
                        </span>
                        <span className="text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-navy-light/50 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
                      {row.startLabel}
                    </td>
                    <td className="px-4 py-2.5 text-navy-light/50 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
                      {row.duration}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn('rounded-full px-2.5 py-0.5 text-xs', (row.status === 'Completado' || row.status === 'Aprobado') ? 'bg-teal-soft/30 text-teal-deep' : 'bg-coral-soft/20 text-coral')}
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/estudios/grupos/${row.groupId}`}
                        className="inline-flex items-center gap-1 text-xs text-coral hover:text-coral-deep transition-colors whitespace-nowrap"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        Ver grupo →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {visibleEstudios < estudiosTable.sorted.length && (
          <div className="px-4 py-3" style={{ borderTop: '1px solid var(--outline-variant)' }}>
            <button
              onClick={onLoadMoreEstudios}
              className="text-xs text-navy-light/50 hover:text-coral transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Cargar {LOAD_MORE} más (quedan {estudiosTable.sorted.length - visibleEstudios})
            </button>
          </div>
        )}
      </SectionAccordion>

      {/* Historial de servicio */}
      <SectionAccordion
        title="Historial de servicio"
        open={openSections.servicio}
        onToggle={() => onToggleSection('servicio')}
      >
        {servicioTable.sorted.length === 0 ? (
          <p className="px-4 py-6 text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
            Sin historial de servicio
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                    {([['position', 'Puesto'], ['committee', 'Comité'], ['from', 'Desde'], ['to', 'Hasta'], ['status', 'Estado']] as [keyof ServiceRow, string][]).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => servicioTable.toggleSort(key)}
                        className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/40 cursor-pointer hover:text-navy transition-colors select-none"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {label}{' '}
                        <span className="opacity-50">
                          {servicioTable.sortKey === key ? (servicioTable.sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {servicioTable.sorted.slice(0, visibleServicio).map((row, i) => (
                    <tr
                      key={i}
                      className="hover:bg-surface-low transition-colors"
                      style={i < Math.min(visibleServicio, servicioTable.sorted.length) - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                    >
                      <td className="px-4 py-2.5 text-navy" style={{ fontFamily: 'var(--font-body)' }}>{row.position}</td>
                      <td className="px-4 py-2.5 text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>{row.committee}</td>
                      <td className="px-4 py-2.5 text-navy-light/50 text-xs" style={{ fontFamily: 'var(--font-body)' }}>{formatDate(row.from)}</td>
                      <td className="px-4 py-2.5 text-navy-light/50 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
                        {row.to ? formatDate(row.to) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn('rounded-full px-2.5 py-0.5 text-xs', row.status === 'activo' ? 'bg-teal-soft/30 text-teal-deep' : 'bg-surface-low text-navy-light/50')}
                          style={{ fontFamily: 'var(--font-body)' }}
                        >
                          {row.status === 'activo' ? 'Activo' : 'Finalizado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleServicio < servicioTable.sorted.length && (
              <div className="px-4 py-3" style={{ borderTop: '1px solid var(--outline-variant)' }}>
                <button
                  onClick={onLoadMoreServicio}
                  className="text-xs text-navy-light/50 hover:text-coral transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Cargar {LOAD_MORE} más (quedan {servicioTable.sorted.length - visibleServicio})
                </button>
              </div>
            )}
          </>
        )}
      </SectionAccordion>

      {/* Asistencia a eventos */}
      <SectionAccordion
        title="Asistencia a eventos"
        open={openSections.eventos}
        onToggle={() => onToggleSection('eventos')}
      >
        {eventosTable.sorted.length === 0 ? (
          <p className="px-4 py-6 text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
            Sin registros de asistencia
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                    {([['name', 'Evento'], ['type', 'Tipo'], ['date', 'Fecha'], ['attendance_type', 'Asistencia']] as [keyof EventoRow, string][]).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => eventosTable.toggleSort(key)}
                        className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/40 cursor-pointer hover:text-navy transition-colors select-none"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {label}{' '}
                        <span className="opacity-50">
                          {eventosTable.sortKey === key ? (eventosTable.sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {eventosTable.sorted.slice(0, visibleEventos).map((row, i) => (
                    <tr
                      key={i}
                      className="hover:bg-surface-low transition-colors"
                      style={i < Math.min(visibleEventos, eventosTable.sorted.length) - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                    >
                      <td className="px-4 py-2.5 text-navy" style={{ fontFamily: 'var(--font-body)' }}>{row.name}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn('rounded-full px-2 py-0.5 text-[10px]', TYPE_BADGE[row.type] ?? 'bg-surface-low text-navy-light/50')}
                          style={{ fontFamily: 'var(--font-body)' }}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-navy-light/50 text-xs whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>
                        {formatDate(row.date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn('rounded-full px-2 py-0.5 text-[10px]', ATTENDANCE_BADGE[row.attendance_type] ?? 'bg-surface-low text-navy-light/50')}
                          style={{ fontFamily: 'var(--font-body)' }}
                        >
                          {row.attendance_type === 'servidor' ? 'Servidor' : 'Participante'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleEventos < eventosTable.sorted.length && (
              <div className="px-4 py-3" style={{ borderTop: '1px solid var(--outline-variant)' }}>
                <button
                  onClick={onLoadMoreEventos}
                  className="text-xs text-navy-light/50 hover:text-coral transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Cargar {LOAD_MORE} más (quedan {eventosTable.sorted.length - visibleEventos})
                </button>
              </div>
            )}
          </>
        )}
      </SectionAccordion>

      {/* Donaciones */}
      <SectionAccordion
        title="Donaciones"
        open={openSections.donaciones}
        onToggle={() => onToggleSection('donaciones')}
      >
        {hasFinanceRole ? (
          <div>
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--outline-variant)' }}
            >
              <p className="text-xs text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
                {donationsCount} registros
              </p>
              <button
                type="button"
                onClick={onToggleRevealDonations}
                className="rounded-lg border px-3 py-1 text-xs text-navy-light hover:bg-surface-low transition-colors"
                style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
              >
                {revealDonations ? 'Ocultar montos' : 'Mostrar montos'}
              </button>
            </div>
            {donacionesTable.sorted.length === 0 ? (
              <p className="px-4 py-6 text-sm text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                Sin registros de donaciones
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                        {([['date', 'Fecha'], ['description', 'Descripción'], ['amount', 'Monto']] as [keyof DonacionRow, string][]).map(([key, label]) => (
                          <th
                            key={key}
                            onClick={() => donacionesTable.toggleSort(key)}
                            className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/40 cursor-pointer hover:text-navy transition-colors select-none"
                            style={{ fontFamily: 'var(--font-display)' }}
                          >
                            {label}{' '}
                            <span className="opacity-50">
                              {donacionesTable.sortKey === key ? (donacionesTable.sortDir === 'asc' ? '↑' : '↓') : '↕'}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {donacionesTable.sorted.slice(0, visibleDonaciones).map((row, i) => (
                        <tr
                          key={i}
                          className="hover:bg-surface-low transition-colors"
                          style={i < Math.min(visibleDonaciones, donacionesTable.sorted.length) - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                        >
                          <td className="px-4 py-2.5 text-navy-light/50 text-xs whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>
                            {formatDate(row.date)}
                          </td>
                          <td className="px-4 py-2.5 text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>
                            {row.description}
                          </td>
                          <td
                            className="px-4 py-2.5 text-right tabular-nums"
                            style={{ fontFamily: revealDonations ? 'var(--font-mono)' : 'var(--font-body)', fontSize: '13px' }}
                          >
                            {revealDonations ? (
                              <span className="text-navy">{formatAmount(row.amount)}</span>
                            ) : (
                              <span className="text-navy-light/30 tracking-widest">••••••</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleDonaciones < donacionesTable.sorted.length && (
                  <div className="px-4 py-3" style={{ borderTop: '1px solid var(--outline-variant)' }}>
                    <button
                      onClick={onLoadMoreDonaciones}
                      className="text-xs text-navy-light/50 hover:text-coral transition-colors"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      Cargar {LOAD_MORE} más (quedan {donacionesTable.sorted.length - visibleDonaciones})
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-6">
            <Lock size={16} className="text-navy-light/30" strokeWidth={1.75} />
            <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
              No tenés permisos para ver esta información.
            </p>
          </div>
        )}
      </SectionAccordion>
    </div>
  )
}
