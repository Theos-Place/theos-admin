import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Lock, ChevronDown, ChevronUp, CreditCard, Loader2, Check, GraduationCap } from 'lucide-react'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { StudyRequestActions } from '@/components/studies/StudyRequestActions'
import { FinanceRequestActions } from '@/components/finance/FinanceRequestActions'
import { Modal } from '@/components/shared/Modal'
import { cn } from '@/lib/utils'
import { formatDate, formatCRC } from '@/lib/format'
import type { MemberPaymentRow } from '@/lib/supabase/queries/payments'

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

function formatAmount(n: number | null) {
  // null = monto restringido (solo rol finanzas lo recibe del API).
  if (n == null) return '₡ •••,•••'
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(n)
}

function studyStageColor(stage: string): string {
  if (stage === 'niveles') return 'bg-navy/10 text-navy'
  if (stage === 'inicial') return 'bg-teal-soft/30 text-teal-deep'
  if (stage === 'campaña') return 'bg-purple-100 text-purple-700' // campañas = morado (consistente con StudyTypeBadge / plan)
  return 'bg-coral-soft/20 text-coral' // intermedia
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
    <div className="rounded-xl overflow-hidden border border-[var(--outline-variant)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 bg-surface-card hover:bg-surface-low transition-colors"
      >
        <span
          className="text-sm font-medium text-navy font-display font-extrabold"
        >
          {title}
        </span>
        {open ? (
          <ChevronUp size={16} strokeWidth={1.75} className="text-navy-light/60" />
        ) : (
          <ChevronDown size={16} strokeWidth={1.75} className="text-navy-light/60" />
        )}
      </button>
      {open && <div className="bg-surface-card">{children}</div>}
    </div>
  )
}

export type StudyRow = { code: string; name: string; startYear: number; startLabel: string; duration: string; status: string; groupId: string | null; enrollmentId: string; rawStatus: string; requiresPayment: boolean; paymentStatus: string | null; cost: number }
export type ServiceRow = { position: string; committee: string; from: string; to: string; status: string }
export type EventoRow = { name: string; type: string; date: string; attendance_type: string }
export type DonacionRow = { date: string; description: string; amount: number | null }
export type EventRegistrationRow = {
  registrationId: string; eventId: string; eventName: string; eventDate: string
  requiresPayment: boolean; cost: number
  paymentStatus: 'pending' | 'paid' | 'exempted' | 'expired'
  reviewStatus: string | null
}

type SortableTableResult<T> = {
  sorted: T[]
  sortKey: keyof T | null
  sortDir: 'asc' | 'desc'
  toggleSort: (key: keyof T) => void
}

type OpenSections = {
  estudios: boolean
  ledStudies: boolean
  servicio: boolean
  eventos: boolean
  eventRegistrations: boolean
  misBecas: boolean
  pagos: boolean
  donaciones: boolean
}

type Props = {
  memberId: string
  openSections: OpenSections
  onToggleSection: (key: keyof OpenSections) => void
  estudiosTable: SortableTableResult<StudyRow>
  servicioTable: SortableTableResult<ServiceRow>
  eventosTable: SortableTableResult<EventoRow>
  donacionesTable: SortableTableResult<DonacionRow>
  eventRegistrationTable: SortableTableResult<EventRegistrationRow>
  visibleEstudios: number
  visibleServicio: number
  visibleEventos: number
  visibleDonaciones: number
  visibleEventRegistrations: number
  onLoadMoreEstudios: () => void
  onLoadMoreServicio: () => void
  onLoadMoreEventos: () => void
  onLoadMoreDonaciones: () => void
  onLoadMoreEventRegistrations: () => void
  hasFinanceRole: boolean
  revealDonations: boolean
  onToggleRevealDonations: () => void
  donationsCount: number
  ledStudies?: Array<{ group_id: string; group_name: string; plan_code: string | null; plan_name: string | null; role: 'Dirigente' | 'Co-dirigente'; status: string; date: string | null }>
  onAddStudy?: () => void
}

export function MemberParticipationTab({
  memberId,
  openSections,
  onToggleSection,
  estudiosTable,
  servicioTable,
  eventosTable,
  donacionesTable,
  eventRegistrationTable,
  visibleEstudios,
  visibleServicio,
  visibleEventos,
  visibleDonaciones,
  visibleEventRegistrations,
  onLoadMoreEstudios,
  onLoadMoreServicio,
  onLoadMoreEventos,
  onLoadMoreDonaciones,
  onLoadMoreEventRegistrations,
  hasFinanceRole,
  revealDonations,
  onToggleRevealDonations,
  donationsCount,
  ledStudies = [],
  onAddStudy,
}: Props) {
  const { studyTypes } = useStudyPlans()
  return (
    <div className="space-y-3">
      {/* Solicitudes de estudios y finanzas — disponibles para cualquier rol.
          (Invitar a estudio y excepción de matrícula viven en el tab Administrativo.) */}
      <div className="flex gap-2 flex-wrap">
        <StudyRequestActions memberId={memberId} />
        <FinanceRequestActions memberId={memberId} />
      </div>

      {/* Historial de estudios */}
      <SectionAccordion
        title="Historial de estudios"
        open={openSections.estudios}
        onToggle={() => onToggleSection('estudios')}
      >
        {onAddStudy && (
          <div className="flex justify-end px-4 pt-3">
            <button
              type="button"
              onClick={onAddStudy}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-xs text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              + Agregar estudio
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--outline-variant)]">
                {([['name', 'Estudio'], ['startYear', 'Inicio'], ['status', 'Estado']] as [keyof StudyRow, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => estudiosTable.toggleSort(key)}
                    className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/60 cursor-pointer hover:text-navy transition-colors select-none font-display"
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
                const entry = studyTypes.find(s => s.code === row.code)
                return (
                  <tr
                    key={row.code}
                    style={i < Math.min(visibleEstudios, estudiosTable.sorted.length) - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                    className="hover:bg-surface-low transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn('rounded px-1.5 py-0.5 text-[10px] font-mono', entry ? studyStageColor(entry.stage) : 'bg-surface-low text-navy-light/60')}
                        >
                          {row.code}
                        </span>
                        <span className="text-navy-light/70 font-body">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-navy-light/60 text-xs font-body">
                      {row.startLabel}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn('rounded-full px-2.5 py-0.5 text-xs font-body', (row.status === 'Completado' || row.status === 'Aprobado') ? 'bg-teal-soft/30 text-teal-deep' : 'bg-coral-soft/20 text-coral')}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {(row.rawStatus === 'enrolled' || row.rawStatus === 'pendiente_de_pago') && row.requiresPayment && (
                          row.paymentStatus === 'en_revision' ? (
                            <span className="rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-[11px] font-semibold font-display">Pago en revisión</span>
                          ) : row.paymentStatus === 'aprobado' ? (
                            <span className="rounded-full bg-teal-soft/30 text-teal-deep px-2.5 py-0.5 text-[11px] font-semibold font-display">Pagado</span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              {row.cost > 0 && (
                                <span className="text-[11px] text-navy-light/70 font-body whitespace-nowrap">
                                  Pendiente: {formatCRC(row.cost)}
                                </span>
                              )}
                              <PayMatriculaButton
                                enrollmentId={row.enrollmentId}
                                retry={row.paymentStatus === 'rechazado'}
                              />
                            </span>
                          )
                        )}
                        {row.groupId ? (
                          <Link
                            href={`/estudios/grupos/${row.groupId}`}
                            className="inline-flex items-center gap-1 text-xs text-coral hover:text-coral-deep transition-colors whitespace-nowrap font-body"
                          >
                            Ver grupo →
                          </Link>
                        ) : (
                          <span className="text-xs text-navy-light/60 whitespace-nowrap font-body">Sin grupo</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {visibleEstudios < estudiosTable.sorted.length && (
          <div className="px-4 py-3 border-t border-[var(--outline-variant)]">
            <button
              onClick={onLoadMoreEstudios}
              className="text-xs text-navy-light/60 hover:text-coral transition-colors font-body"
            >
              Cargar {LOAD_MORE} más (quedan {estudiosTable.sorted.length - visibleEstudios})
            </button>
          </div>
        )}
      </SectionAccordion>

      {/* Estudios dados como dirigente (D10) — acordeón, debajo del historial de estudios */}
      {ledStudies.length > 0 && (
        <SectionAccordion
          title={`Estudios dados como dirigente (${ledStudies.length})`}
          open={openSections.ledStudies}
          onToggle={() => onToggleSection('ledStudies')}
        >
          <div className="divide-y divide-[var(--outline-variant)]">
            {ledStudies.map(g => (
              <div key={g.group_id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-navy truncate font-body">{g.plan_name ?? g.plan_code ?? g.group_name}</p>
                  <p className="text-[11px] text-navy-light/60 font-body">
                    {g.role}{g.date ? ` · ${formatDate(g.date)}` : ''}
                  </p>
                </div>
                <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium shrink-0 font-display',
                  g.status === 'finalizado' ? 'bg-surface-low text-navy-light/60' : 'bg-teal-soft/30 text-teal-deep')}>
                  {g.status === 'finalizado' ? 'Finalizado' : g.status === 'en_curso' ? 'En curso' : 'En matrícula'}
                </span>
              </div>
            ))}
          </div>
        </SectionAccordion>
      )}

      {/* Historial de servicio */}
      <SectionAccordion
        title="Historial de servicio"
        open={openSections.servicio}
        onToggle={() => onToggleSection('servicio')}
      >
        {servicioTable.sorted.length === 0 ? (
          <p className="px-4 py-6 text-sm text-navy-light/60 font-body">
            Sin historial de servicio
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]">
                    {([['position', 'Puesto'], ['committee', 'Comité'], ['from', 'Desde'], ['to', 'Hasta'], ['status', 'Estado']] as [keyof ServiceRow, string][]).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => servicioTable.toggleSort(key)}
                        className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/60 cursor-pointer hover:text-navy transition-colors select-none font-display"
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
                      <td className="px-4 py-2.5 text-navy font-body">{row.position}</td>
                      <td className="px-4 py-2.5 text-navy-light/70 font-body">{row.committee}</td>
                      <td className="px-4 py-2.5 text-navy-light/60 text-xs font-body">{formatDate(row.from)}</td>
                      <td className="px-4 py-2.5 text-navy-light/60 text-xs font-body">
                        {row.to ? formatDate(row.to) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn('rounded-full px-2.5 py-0.5 text-xs font-body', row.status === 'activo' ? 'bg-teal-soft/30 text-teal-deep' : 'bg-surface-low text-navy-light/60')}
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
              <div className="px-4 py-3 border-t border-[var(--outline-variant)]">
                <button
                  onClick={onLoadMoreServicio}
                  className="text-xs text-navy-light/60 hover:text-coral transition-colors font-body"
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
          <p className="px-4 py-6 text-sm text-navy-light/60 font-body">
            Sin registros de asistencia
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]">
                    {([['name', 'Evento'], ['type', 'Tipo'], ['date', 'Fecha'], ['attendance_type', 'Asistencia']] as [keyof EventoRow, string][]).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => eventosTable.toggleSort(key)}
                        className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/60 cursor-pointer hover:text-navy transition-colors select-none font-display"
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
                      <td className="px-4 py-2.5 text-navy font-body">{row.name}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn('rounded-full px-2 py-0.5 text-[10px] font-body', TYPE_BADGE[row.type] ?? 'bg-surface-low text-navy-light/60')}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-navy-light/60 text-xs whitespace-nowrap font-body">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn('rounded-full px-2 py-0.5 text-[10px] font-body', ATTENDANCE_BADGE[row.attendance_type] ?? 'bg-surface-low text-navy-light/60')}
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
              <div className="px-4 py-3 border-t border-[var(--outline-variant)]">
                <button
                  onClick={onLoadMoreEventos}
                  className="text-xs text-navy-light/60 hover:text-coral transition-colors font-body"
                >
                  Cargar {LOAD_MORE} más (quedan {eventosTable.sorted.length - visibleEventos})
                </button>
              </div>
            )}
          </>
        )}
      </SectionAccordion>

      {/* Mis inscripciones a eventos (con pago) */}
      <SectionAccordion
        title="Mis inscripciones a eventos"
        open={openSections.eventRegistrations}
        onToggle={() => onToggleSection('eventRegistrations')}
      >
        {eventRegistrationTable.sorted.length === 0 ? (
          <p className="px-4 py-4 text-sm text-navy-light/60 font-body">Sin inscripciones a eventos.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]">
                    {([['eventName', 'Evento'], ['eventDate', 'Fecha']] as [keyof EventRegistrationRow, string][]).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => eventRegistrationTable.toggleSort(key)}
                        className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/60 cursor-pointer hover:text-navy transition-colors select-none font-display"
                      >
                        {label}{' '}
                        <span className="opacity-50">
                          {eventRegistrationTable.sortKey === key ? (eventRegistrationTable.sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {eventRegistrationTable.sorted.slice(0, visibleEventRegistrations).map((row, i) => (
                    <tr
                      key={row.registrationId}
                      style={i < Math.min(visibleEventRegistrations, eventRegistrationTable.sorted.length) - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                      className="hover:bg-surface-low transition-colors"
                    >
                      <td className="px-4 py-2.5 text-navy-light/70 font-body">{row.eventName}</td>
                      <td className="px-4 py-2.5 text-navy-light/60 text-xs font-body">{formatDate(row.eventDate)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {row.requiresPayment && (
                            row.paymentStatus === 'paid' ? (
                              <span className="rounded-full bg-teal-soft/30 text-teal-deep px-2.5 py-0.5 text-[11px] font-semibold font-display">Pagado</span>
                            ) : row.paymentStatus === 'exempted' ? (
                              <span className="rounded-full bg-teal-soft/30 text-teal-deep px-2.5 py-0.5 text-[11px] font-semibold font-display">Exento</span>
                            ) : row.paymentStatus === 'expired' ? (
                              <span className="rounded-full bg-coral-soft/20 text-coral px-2.5 py-0.5 text-[11px] font-semibold font-display">Reserva vencida</span>
                            ) : row.reviewStatus === 'en_revision' ? (
                              <span className="rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-[11px] font-semibold font-display">Pago en revisión</span>
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                {row.cost > 0 && (
                                  <span className="text-[11px] text-navy-light/70 font-body whitespace-nowrap">
                                    Pendiente: {formatCRC(row.cost)}
                                  </span>
                                )}
                                <PayEventRegistrationButton
                                  registrationId={row.registrationId}
                                  retry={row.reviewStatus === 'rechazado'}
                                />
                              </span>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleEventRegistrations < eventRegistrationTable.sorted.length && (
              <div className="px-4 py-3 border-t border-[var(--outline-variant)]">
                <button
                  onClick={onLoadMoreEventRegistrations}
                  className="text-xs text-navy-light/60 hover:text-coral transition-colors font-body"
                >
                  Cargar {LOAD_MORE} más (quedan {eventRegistrationTable.sorted.length - visibleEventRegistrations})
                </button>
              </div>
            )}
          </>
        )}
      </SectionAccordion>

      {/* Mis becas (solicitudes de beca: solicitada/aprobada/rechazada) */}
      <SectionAccordion
        title="Mis becas"
        open={openSections.misBecas}
        onToggle={() => onToggleSection('misBecas')}
      >
        <MemberScholarshipRequests memberId={memberId} />
      </SectionAccordion>

      {/* Pagos y cobros (matrícula, eventos, prematrimonial): pendientes con
          botón para pagar (subir comprobante), en revisión, y cerrados. */}
      <SectionAccordion
        title="Pagos y cobros"
        open={openSections.pagos}
        onToggle={() => onToggleSection('pagos')}
      >
        <MemberPayments memberId={memberId} />
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
              className="flex items-center justify-between px-4 py-3 border-b border-[var(--outline-variant)]"
            >
              <p className="text-xs text-navy-light/60 font-body">
                {donationsCount} registros
              </p>
              <button
                type="button"
                onClick={onToggleRevealDonations}
                className="rounded-lg border border-[var(--outline-variant)] px-3 py-1 text-xs text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                {revealDonations ? 'Ocultar montos' : 'Mostrar montos'}
              </button>
            </div>
            {donacionesTable.sorted.length === 0 ? (
              <p className="px-4 py-6 text-sm text-navy-light/60 font-body">
                Sin registros de donaciones
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--outline-variant)]">
                        {([['date', 'Fecha'], ['description', 'Descripción'], ['amount', 'Monto']] as [keyof DonacionRow, string][]).map(([key, label]) => (
                          <th
                            key={key}
                            onClick={() => donacionesTable.toggleSort(key)}
                            className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-navy-light/60 cursor-pointer hover:text-navy transition-colors select-none font-display"
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
                          <td className="px-4 py-2.5 text-navy-light/60 text-xs whitespace-nowrap font-body">
                            {formatDate(row.date)}
                          </td>
                          <td className="px-4 py-2.5 text-navy-light/70 font-body">
                            {row.description}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right tabular-nums text-[13px] ${revealDonations ? 'font-mono' : 'font-body'}`}
                          >
                            {row.amount === 0 ? (
                              // Histórico importado sin monto: el período va en la descripción.
                              <span className="text-navy-light/60">—</span>
                            ) : revealDonations ? (
                              <span className="text-navy">{formatAmount(row.amount)}</span>
                            ) : (
                              <span className="text-navy-light/60 tracking-widest">••••••</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleDonaciones < donacionesTable.sorted.length && (
                  <div className="px-4 py-3 border-t border-[var(--outline-variant)]">
                    <button
                      onClick={onLoadMoreDonaciones}
                      className="text-xs text-navy-light/60 hover:text-coral transition-colors font-body"
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
            <Lock size={16} className="text-navy-light/60" strokeWidth={1.75} />
            <p className="text-sm text-navy-light/60 font-body">
              No tenés permisos para ver esta información.
            </p>
          </div>
        )}
      </SectionAccordion>
    </div>
  )
}

// ── Botón de pago de matrícula por comprobante ───────────────────────────────
function PayMatriculaButton({ enrollmentId, retry }: { enrollmentId: string; retry: boolean }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy || !file) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('enrollment_id', enrollmentId)
      fd.append('reference', reference.trim())
      const res = await fetch('/api/payments', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el comprobante.')
      setDone(true); setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-[11px] font-semibold font-display">
        <Check size={11} /> Comprobante enviado
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-coral/40 text-coral px-2.5 py-1 text-[11px] hover:bg-coral/5 transition-colors whitespace-nowrap font-body"
      >
        <CreditCard size={12} /> {retry ? 'Reintentar pago' : 'Pagar matrícula'}
      </button>
      {open && (
        <Modal onClose={() => !busy && setOpen(false)} titleId="pay-title" width={420}>
          <div className="p-6 space-y-4">
            <h3 id="pay-title" className="text-base font-bold text-navy font-display">Pagar matrícula</h3>
            <p className="text-[13px] text-navy-light/70 font-body">
              Subí el comprobante (screenshot del SINPE o transferencia) y el número de referencia. Un revisor lo verificará.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Comprobante (imagen)</label>
              <input
                type="file"
                accept="image/*"
                aria-label="Comprobante de pago"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-[13px] text-navy-light/80 font-body file:mr-3 file:rounded-full file:border-0 file:bg-surface-low file:px-3 file:py-1.5 file:text-[12px] file:text-navy"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pay-ref" className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Número de referencia</label>
              <input
                id="pay-ref"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Ej. 2026070212345"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
            </div>
            {error && <p className="text-[12px] text-coral font-body">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={submit}
                disabled={busy || !file}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-coral hover:bg-coral-deep', (busy || !file) && 'opacity-50 cursor-not-allowed')}
              >
                {busy ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar comprobante'}
              </button>
              <button onClick={() => setOpen(false)} disabled={busy} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Botón de pago de inscripción a evento por comprobante (clon de PayMatriculaButton) ──
function PayEventRegistrationButton({ registrationId, retry }: { registrationId: string; retry: boolean }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy || !file) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('reference', reference.trim())
      const res = await fetch(`/api/event-registrations/${registrationId}/comprobante`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el comprobante.')
      setDone(true); setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-[11px] font-semibold font-display">
        <Check size={11} /> Comprobante enviado
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-coral/40 text-coral px-2.5 py-1 text-[11px] hover:bg-coral/5 transition-colors whitespace-nowrap font-body"
      >
        <CreditCard size={12} /> {retry ? 'Reintentar pago' : 'Pagar inscripción'}
      </button>
      {open && (
        <Modal onClose={() => !busy && setOpen(false)} titleId="pay-event-title" width={420}>
          <div className="p-6 space-y-4">
            <h3 id="pay-event-title" className="text-base font-bold text-navy font-display">Pagar inscripción</h3>
            <p className="text-[13px] text-navy-light/70 font-body">
              Subí el comprobante (screenshot del SINPE o transferencia) y el número de referencia. Un revisor lo verificará.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Comprobante (imagen)</label>
              <input
                type="file"
                accept="image/*"
                aria-label="Comprobante de pago"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-[13px] text-navy-light/80 font-body file:mr-3 file:rounded-full file:border-0 file:bg-surface-low file:px-3 file:py-1.5 file:text-[12px] file:text-navy"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pay-event-ref" className="text-[10px] tracking-widest uppercase text-navy-light/60 font-display">Número de referencia</label>
              <input
                id="pay-event-ref"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Ej. 2026070212345"
                className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
            </div>
            {error && <p className="text-[12px] text-coral font-body">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={submit}
                disabled={busy || !file}
                className={cn('flex-1 rounded-full px-4 py-2.5 text-sm text-white transition-colors font-body inline-flex items-center justify-center gap-2 bg-coral hover:bg-coral-deep', (busy || !file) && 'opacity-50 cursor-not-allowed')}
              >
                {busy ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar comprobante'}
              </button>
              <button onClick={() => setOpen(false)} disabled={busy} className="rounded-full border border-[var(--outline-variant)] px-4 py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── "Mis becas": solicitudes de beca del miembro (solicitada/aprobada/rechazada) ──
type ScholarshipRequestRow = {
  id: string
  entity_name: string | null
  status: 'open' | 'in_review' | 'resolved' | 'rejected'
  reason: string
  review_notes: string | null
  created_at: string
}

const REQUEST_STATUS_LABEL: Record<string, string> = {
  open: 'Solicitada', in_review: 'En revisión', resolved: 'Aprobada', rejected: 'Rechazada',
}
const REQUEST_STATUS_BADGE: Record<string, string> = {
  open: 'bg-amber-50 text-amber-700', in_review: 'bg-amber-50 text-amber-700',
  resolved: 'bg-teal-soft/30 text-teal-deep', rejected: 'bg-coral-soft/20 text-coral',
}

function MemberScholarshipRequests({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<ScholarshipRequestRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/finance/requests?type=scholarship&member_id=${memberId}`)
      .then(r => (r.ok ? r.json() : []))
      .then((d: ScholarshipRequestRow[]) => { if (alive) setRows(Array.isArray(d) ? d : []) })
      .catch(() => { if (alive) setRows([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [memberId])

  if (loading) {
    return <p className="px-4 py-6 text-center text-sm text-navy-light/60 font-body inline-flex items-center gap-2 justify-center w-full"><Loader2 size={15} className="animate-spin" /> Cargando…</p>
  }
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-navy-light/60 font-body flex items-center gap-2">
        <GraduationCap size={14} /> Sin solicitudes de beca.
      </p>
    )
  }
  return (
    <div className="divide-y divide-[var(--outline-variant)]">
      {rows.map(r => (
        <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-navy font-body">{r.entity_name ?? '—'}</p>
            <p className="text-[12px] text-navy-light/60 font-body">{formatDate(r.created_at)}</p>
            {r.status === 'rejected' && r.review_notes && (
              <p className="text-[12px] text-coral font-body mt-1">Motivo: {r.review_notes}</p>
            )}
          </div>
          <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-display shrink-0', REQUEST_STATUS_BADGE[r.status])}>
            {REQUEST_STATUS_LABEL[r.status]}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Estado visual de un pago del miembro. */
function paymentBadge(p: MemberPaymentRow): { label: string; cls: string } {
  if (p.queue_status === 'en_revision') return { label: 'En revisión', cls: 'bg-amber-50 text-amber-700' }
  if (p.queue_status === 'pendiente') return { label: 'Pendiente', cls: 'bg-coral/10 text-coral' }
  if (p.status === 'paid') return { label: 'Pagado', cls: 'bg-teal-soft/30 text-teal-deep' }
  if (p.status === 'refunded' || p.status === 'partial_refund') return { label: 'Devuelto', cls: 'bg-navy/5 text-navy-light/70' }
  return { label: 'Cancelado', cls: 'bg-surface-low text-navy-light/60' }
}

/** Sección "Pagos y cobros": lista los pagos del miembro (fetch propio). Los
 *  pendientes de matrícula/evento muestran botón para pagar (subir comprobante).
 *  Lo ve el propio miembro o el staff de finanzas (gate en el endpoint). */
function MemberPayments({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<MemberPaymentRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/members/${memberId}/payments`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: MemberPaymentRow[]) => { if (alive) setRows(d) })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [memberId])

  if (error) return <p className="px-4 py-3 text-[13px] text-coral font-body">No se pudieron cargar los pagos.</p>
  if (!rows) return <p className="px-4 py-6 text-center text-[13px] text-navy-light/50 font-body">Cargando…</p>
  if (rows.length === 0) return <p className="px-4 py-6 text-center text-[13px] text-navy-light/50 font-body">Sin pagos ni cobros registrados.</p>

  return (
    <div className="divide-y divide-[var(--outline-variant)]">
      {rows.map(p => {
        const badge = paymentBadge(p)
        const canPay = p.queue_status === 'pendiente'
        return (
          <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13px] text-navy font-body truncate">{p.description}</p>
              <p className="text-[11px] text-navy-light/60 font-body">
                {formatCRC(p.amount)} · {formatDate(p.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-display', badge.cls)}>{badge.label}</span>
              {canPay && p.enrollment_id && <PayMatriculaButton enrollmentId={p.enrollment_id} retry={false} />}
              {canPay && !p.enrollment_id && p.event_registration_id && <PayEventRegistrationButton registrationId={p.event_registration_id} retry={false} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}
