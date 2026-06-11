import { MapPin, BookOpen, Users, Star } from 'lucide-react'
import { STUDY_CATALOG, STUDY_STAGES } from '@/data/study-catalog'
import { sedeLabel } from '@/lib/sedes'
import { cn } from '@/lib/utils'
import type { Member } from '@/types/member'

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
  if (stage === 'campaña') return 'bg-purple-100 text-purple-700'
  return 'bg-coral-soft/20 text-coral'
}

/** Etapa (del catálogo) de un estudio por código. */
function stageOf(code: string): string {
  return STUDY_CATALOG.find(s => s.code === code)?.stage ?? 'intermedia'
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
  // Estudios actualmente en curso (inscripciones con status 'enrolled') más
  // los grupos activos que la persona dirige (con tag Dirigente).
  const enrolledStudies = (member.study_history ?? []).filter(s => s.status === 'enrolled')
  const ledGroups = member.led_groups ?? []
  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              Estudios en curso
            </span>
          </div>
          {enrolledStudies.length > 0 || ledGroups.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {enrolledStudies.map(s => (
                <span key={s.code + (s.date ?? '')} className={cn('rounded-full px-2.5 py-0.5 text-xs font-body', studyStageColor(stageOf(s.code)))}>
                  {s.name || s.code}
                </span>
              ))}
              {ledGroups.map(g => (
                <span
                  key={g.group_id}
                  className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-body', g.plan_code ? studyStageColor(stageOf(g.plan_code)) : 'bg-navy/10 text-navy')}
                  title={g.group_name}
                >
                  <Star size={10} strokeWidth={2} aria-hidden />
                  {g.plan_name ?? g.plan_code ?? g.group_name}
                  <span className="text-[10px] opacity-70">· Dirigente</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium text-navy-light/60 font-body">Sin estudios activos</p>
          )}
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
                style={{ width: `${currentStudyEntry.weeks > 0 ? Math.min(100, (currentWeek / currentStudyEntry.weeks) * 100) : 0}%` }}
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
          <div className="flex flex-wrap gap-1.5">
            {member.completed_studies.map((code, i) => {
              const entry = STUDY_CATALOG.find(s => s.code === code || s.name === code)
              return (
                <span
                  key={code + i}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-body',
                    entry ? studyStageColor(entry.stage) : 'bg-surface-low text-navy-light/50'
                  )}
                >
                  {entry ? entry.name : code}
                </span>
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
