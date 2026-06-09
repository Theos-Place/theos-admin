import { MapPin, BookOpen, Users, Check } from 'lucide-react'
import { STUDY_CATALOG, STUDY_STAGES } from '@/data/study-catalog'
import { sedeLabel } from '@/lib/sedes'
import { cn } from '@/lib/utils'
import type { mockMembers } from '@/data/mock-members'

type Member = (typeof mockMembers)[number]

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

function studyStageColor(stage: string): string {
  if (stage === 'niveles') return 'bg-navy/10 text-navy'
  if (stage === 'inicial') return 'bg-teal-soft/30 text-teal-deep'
  return 'bg-coral-soft/20 text-coral'
}

type Props = {
  member: Member
  currentStudyEntry: (typeof STUDY_CATALOG)[number] | null | undefined
  currentWeek: number
  activeService: Member['service_history'][number] | undefined
  lastStudyEntry: (typeof STUDY_CATALOG)[number] | null | undefined
}

export function MemberSummaryTab({
  member,
  currentStudyEntry,
  currentWeek,
  activeService,
  lastStudyEntry,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={14} className="text-coral" strokeWidth={1.75} />
            <span
              className="text-[10px] uppercase tracking-wider text-navy-light/50 font-display"
            >
              Sede
            </span>
          </div>
          <p className="text-sm font-medium text-navy font-body">
            {sedeLabel(member.sede)}
          </p>
        </div>

        <div
          className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={14} className="text-teal-deep" strokeWidth={1.75} />
            <span
              className="text-[10px] uppercase tracking-wider text-navy-light/50 font-display"
            >
              Nivel actual
            </span>
          </div>
          <p className="text-sm font-medium text-navy font-body">
            {currentStudyEntry
              ? currentStudyEntry.name
              : lastStudyEntry
              ? lastStudyEntry.name
              : 'Sin estudios'}
          </p>
        </div>

        <div
          className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-navy" strokeWidth={1.75} />
            <span
              className="text-[10px] uppercase tracking-wider text-navy-light/50 font-display"
            >
              Servicio
            </span>
          </div>
          <p className="text-sm font-medium text-navy font-body">
            {activeService ? activeService.committee : 'Ninguno'}
          </p>
        </div>
      </div>

      {/* Study progress */}
      {currentStudyEntry && (
        <div
          className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p
                className="text-sm font-medium text-navy font-display font-extrabold"
              >
                {currentStudyEntry.name}
              </p>
              <p className="text-xs text-navy-light/50 mt-0.5 font-body">
                {currentWeek > 0 ? `Semana ${currentWeek} de ${currentStudyEntry.weeks}` : 'En curso'}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-body',
                studyStageColor(currentStudyEntry.stage)
              )}
            >
              {STUDY_STAGES[currentStudyEntry.stage as keyof typeof STUDY_STAGES].label}
            </span>
          </div>
          {currentWeek > 0 && (
            <div className="h-2 w-full rounded-full bg-surface-low overflow-hidden">
              <div
                className="h-full rounded-full bg-coral transition-all"
                style={{ width: `${Math.min(100, (currentWeek / currentStudyEntry.weeks) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Completed studies */}
      {member.completed_studies.length > 0 && (
        <div
          className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]"
        >
          <h3
            className="text-sm font-medium text-navy mb-3 font-display font-extrabold"
          >
            Estudios completados
          </h3>
          <div className="space-y-2">
            {member.completed_studies.slice(-5).map(code => {
              const entry = STUDY_CATALOG.find(s => s.code === code)
              return (
                <div key={code} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'rounded-lg px-2 py-0.5 text-[10px] font-medium font-mono',
                      entry ? studyStageColor(entry.stage) : 'bg-surface-low text-navy-light/50'
                    )}
                  >
                    {code}
                  </span>
                  <span className="flex-1 text-sm text-navy-light/70 font-body">
                    {entry ? entry.name : code}
                  </span>
                  <Check size={13} className="text-teal-deep" strokeWidth={2.5} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent attendance */}
      {member.attendance_history.length > 0 && (
        <div
          className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]"
        >
          <h3
            className="text-sm font-medium text-navy mb-3 font-display font-extrabold"
          >
            Asistencia reciente
          </h3>
          <div className="space-y-2">
            {member.attendance_history.slice(0, 5).map((ev, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-navy truncate font-body">
                    {ev.name}
                  </p>
                  <p className="text-xs text-navy-light/50 font-body">
                    {formatDate(ev.date)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-body',
                      TYPE_BADGE[ev.type] ?? 'bg-surface-low text-navy-light/50'
                    )}
                  >
                    {ev.type}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-body',
                      ATTENDANCE_BADGE[ev.attendance_type] ?? 'bg-surface-low text-navy-light/50'
                    )}
                  >
                    {ev.attendance_type === 'servidor' ? 'Servidor' : 'Participante'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
