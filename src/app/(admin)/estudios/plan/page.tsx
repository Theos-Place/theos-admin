'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { StudyType } from '@/types/study'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { useAuth } from '@/hooks/useAuth'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { Tabs } from '@/components/shared/Tabs'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { CommitmentIcons } from '@/components/studies/CommitmentIcons'
import { ExpandableDescription } from '@/components/studies/ExpandableDescription'
import { ChevronRight, ArrowDown, Plus, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatCost(cost: number) {
  if (cost === 0) return 'Gratis'
  return `₡${cost.toLocaleString('es-CR')}`
}

function StageLabel({ children, color }: { children: React.ReactNode; color: 'navy' | 'teal' | 'coral' | 'purple' }) {
  const styles = {
    navy:   'bg-navy/10 text-navy',
    teal:   'bg-teal-soft/30 text-teal-deep',
    coral:  'bg-coral/10 text-coral',
    purple: 'bg-purple-100 text-purple-700',
  }
  return (
    <span
      className={cn('inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide', styles[color], 'font-display')}
    >
      {children}
    </span>
  )
}

function StudyCardCompact({ study }: { study: StudyType }) {
  const borderColor = study.stage === 'niveles'
    ? 'border-l-navy/40'
    : study.stage === 'inicial'
    ? 'border-l-teal-deep/40'
    : study.stage === 'campaña'
    ? 'border-l-purple-400'
    : 'border-l-coral/40'

  return (
    <Link
      href={`/estudios/plan/${study.id}`}
      className={cn(
        'group flex flex-col gap-1 rounded-xl border-l-2 bg-surface-low px-3 py-2.5 transition-all hover:bg-surface-card hover:shadow-sm min-w-[110px]',
        borderColor,
      )}
    >
      <StudyTypeBadge code={study.code} size="sm" />
      <p className="text-xs text-navy leading-snug font-medium font-body">
        {study.name}
      </p>
      <div className="mt-0.5">
        <span className="text-[10px] text-navy-light/60 font-body">
          {study.weeks} sem.
        </span>
      </div>
    </Link>
  )
}

function StudyCardFull({ study, mentor, canManage }: { study: StudyType; mentor: string | null; canManage: boolean }) {
  const router = useRouter()
  // Color del código según su etapa (consistente con StudyTypeBadge).
  const codeColor = study.stage === 'niveles'
    ? 'var(--brand-navy)'
    : study.stage === 'inicial'
    ? '#0f766e'
    : study.stage === 'campaña'
    ? '#7e22ce'
    : 'var(--brand-coral)'

  // Solo los roles de estudios pueden entrar al detalle (listado de grupos).
  // Para el resto la card se ve igual pero no es clickeable (currículo público).
  const open = canManage ? () => router.push(`/estudios/plan/${study.id}`) : undefined

  return (
    <div
      className={cn('rounded-xl flex flex-col gap-0 py-[14px] px-4', open && 'cursor-pointer')}
      style={{ background: study.is_archived ? 'rgba(120,120,130,0.10)' : 'var(--surface-low)', opacity: study.is_archived ? 0.7 : 1, filter: study.is_archived ? 'grayscale(0.8)' : 'none' }}
      onClick={open}
      role={open ? 'button' : undefined}
      tabIndex={open ? 0 : undefined}
      onKeyDown={open ? e => { if (e.key === 'Enter') open() } : undefined}
    >
      {/* Header: código + nombre + semanas */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              style={{ color: codeColor }}
              className="font-display text-[10px] font-bold tracking-[.08em] uppercase"
            >
              {study.code}
            </span>
            {study.is_archived && (
              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase font-display bg-[rgba(120,120,130,0.18)] text-[#6b7280]">
                Desactivado
              </span>
            )}
          </div>
          <div className="font-bold text-[14px] text-navy-light mt-0.5 font-display">
            {study.name}
          </div>
        </div>
        <span className="text-[11px] text-[var(--fg-muted)] whitespace-nowrap ml-2 font-body">
          {study.weeks} sem.
        </span>
      </div>

      {/* Dirigente encargado — solo para roles de coordinación/administración */}
      {canManage && mentor && (
        <div className="text-[11px] text-[var(--fg-muted)] mb-1.5 font-body">
          Dirigente encargado: <strong>{mentor}</strong>
        </div>
      )}

      {/* Descripción expandible */}
      <ExpandableDescription text={study.description ?? undefined} maxLength={120} />

      {/* Compromisos */}
      {(study.req_donor || study.req_server || study.req_attendee) && (
        <div className="mt-2">
          <CommitmentIcons donor={study.req_donor} server={study.req_server} charlas={study.req_attendee} size={12} />
        </div>
      )}

      {/* Etapa del estudio (no la dificultad: confundía mostrando "Intermedio"/
          "Avanzado" sobre estudios de etapa inicial/intermedia). */}
      {(() => {
        const STAGE_TAG: Record<string, { label: string; cls: string }> = {
          niveles:    { label: 'Niveles',    cls: 'bg-navy/8 text-navy-light' },
          inicial:    { label: 'Inicial',    cls: 'bg-teal-soft/30 text-teal-deep' },
          intermedia: { label: 'Intermedia', cls: 'bg-coral/10 text-coral' },
          'campaña':  { label: 'Abiertas a todo público', cls: 'bg-[rgba(155,127,212,0.15)] text-[#7c5cc4]' },
        }
        const t = STAGE_TAG[study.stage]
        return t ? (
          <div className="mt-2">
            <span className={cn('text-[10px] py-0.5 px-2 rounded-full font-semibold font-display', t.cls)}>{t.label}</span>
          </div>
        ) : null
      })()}

      {/* Botón editar — solo administración */}
      {canManage && (
        <div className="mt-2.5 flex justify-end">
          <button
            onClick={e => { e.stopPropagation(); router.push(`/estudios/plan/${study.code}/editar`) }}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] text-navy-light hover:bg-surface-card hover:text-navy transition-colors border-[var(--outline-variant)] font-body"
          >
            <Pencil size={11} /> Editar
          </button>
        </div>
      )}
    </div>
  )
}

function StageDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-1.5 text-navy-light/60">
        <ArrowDown size={13} strokeWidth={1.5} />
        <span className="text-[11px] font-body">{label}</span>
      </div>
      <div className="flex-1 h-px bg-[var(--outline-variant)]" />
    </div>
  )
}

type PlanTab = 'curricula' | 'detalles'

export default function PlanDeEstudiosPage() {
  const { studyTypes } = useStudyPlans()
  const [tab, setTab] = useState<PlanTab>('curricula')
  // Coordinadores de estudios/dirigentes, dirección y admin (scope 'all' excluye
  // al rol dirigente, que tiene edit solo sobre lo propio).
  const { hasRole } = useAuth()
  // Acceso de gestión = roles de estudios (detalle de grupos, crear/editar).
  const canManage = hasRole(...STUDY_ADMIN_ROLES)
  // Dirigente referente (mentor_id) resuelto a nombre por la query de planes.
  const mentorName = (s: StudyType) => s.mentor_name ?? null
  // Archivados (descontinuados) al final de su categoría.
  const archLast = (a: { is_archived: boolean }, b: { is_archived: boolean }) => Number(a.is_archived) - Number(b.is_archived)
  // Orden manual dentro de cada etapa: HEAD van primero (en ese orden), TAIL al
  // final (antes de los descontinuados), el resto alfabético.
  const HEAD: Record<string, string[]> = { inicial: ['SCJ', 'BUS'], intermedia: ['DIS1', 'DIS2', 'DIS3'] }
  const TAIL: Record<string, string[]> = { intermedia: ['CDEB', 'CDC'] }
  // CTBD debe ir justo debajo de DIS3 en el listado por código.
  const sortKey = (code: string) => (code === 'CTBD' ? 'DIS3~' : code)
  const withinStage = (stage: string) => (a: StudyType, b: StudyType) => {
    const al = archLast(a, b); if (al) return al
    const head = HEAD[stage] ?? [], tail = TAIL[stage] ?? []
    const grp = (c: string) => (head.includes(c) ? 0 : tail.includes(c) ? 2 : 1)
    const ga = grp(a.code), gb = grp(b.code)
    if (ga !== gb) return ga - gb
    if (ga === 0) return head.indexOf(a.code) - head.indexOf(b.code)
    if (ga === 2) return tail.indexOf(a.code) - tail.indexOf(b.code)
    return sortKey(a.code).localeCompare(sortKey(b.code))
  }
  // Solo se ocultan las charlas NO curriculares (ej. BUS "¿Adónde va este bus?").
  // Los estudios reales desactivados sí son curriculares → se muestran marcados
  // como inactivos (is_archived: gris + badge "Desactivado", ordenados al final).
  const curricular = useMemo(() => studyTypes.filter(s => s.is_curricular !== false), [studyTypes])
  const byStage = (stage: string) => [...curricular.filter(s => s.stage === stage)].sort(withinStage(stage))
  const niveles    = useMemo(() => byStage('niveles'), [curricular])
  const inicial    = useMemo(() => byStage('inicial'), [curricular])
  const intermedia = useMemo(() => byStage('intermedia'), [curricular])
  const campana    = useMemo(() => byStage('campaña'), [curricular])
  // Listado final ordenado por etapa.
  const STAGE_RANK: Record<string, number> = { niveles: 0, inicial: 1, intermedia: 2, 'campaña': 3 }
  // CDEB y CDC ("cómo dar...") van al final de toda la lista, justo antes de los
  // descontinuados (que siempre quedan de últimos).
  const isInvTail = (code: string) => (code === 'CDEB' || code === 'CDC' ? 1 : 0)
  const sortedStudyTypes = useMemo(
    () => [...curricular].sort((a, b) =>
      archLast(a, b)
      || isInvTail(a.code) - isInvTail(b.code)
      || (STAGE_RANK[a.stage] ?? 99) - (STAGE_RANK[b.stage] ?? 99)
      || withinStage(a.stage)(a, b),
    ),
    [curricular],
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]"
          >
            Plan de Estudios Bíblicos
          </h1>
          <p className="mt-1 text-sm text-navy-light/60 font-body">
            Ruta de crecimiento espiritual de Theos Place
          </p>
        </div>
        {canManage && (
          <Link
            href="/estudios/plan/nuevo"
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
          >
            <Plus size={14} strokeWidth={1.75} />
            Nuevo tipo
          </Link>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { key: 'curricula', label: 'Currículo' },
          { key: 'detalles', label: 'Detalles de cada estudio' },
        ]}
        active={tab}
        onChange={k => setTab(k as PlanTab)}
      />

      {/* ── Tab 1 · Currícula: tabla con todos los tipos de estudio ── */}
      {tab === 'curricula' && (
      <div
        className="overflow-hidden rounded-2xl bg-surface-card shadow-[var(--shadow-md)]"
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-[var(--outline-variant)]"
        >
          <div>
            <h2 className="text-sm font-semibold text-navy font-display">
              Todos los tipos de estudio
            </h2>
            <p className="text-xs text-navy-light/60 mt-0.5 font-body">
              {curricular.length} estudios en total
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)]">
                {['Código', 'Nombre', 'Etapa', 'Semanas', 'Costo', ...(canManage ? ['Dirigente encargado'] : []), 'Prerrequisito', 'Compromisos', ''].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/60 whitespace-nowrap font-display"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedStudyTypes.map((s, i) => (
                <tr
                  key={s.id}
                  className="hover:bg-surface-low transition-colors group"
                  style={{ ...(i < sortedStudyTypes.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}), ...(s.is_archived ? { opacity: 0.55 } : {}) }}
                >
                  <td className="px-4 py-3">
                    <StudyTypeBadge code={s.code} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-sm text-navy font-body">
                    {s.name}
                    {s.is_archived && (
                      <span className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase align-middle font-display bg-[rgba(120,120,130,0.18)] text-[#6b7280]">
                        Desactivado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy-light/60 font-body">
                    {s.stage === 'niveles' ? 'Niveles' : s.stage === 'inicial' ? 'Inicial' : s.stage === 'campaña' ? 'Campaña' : 'Intermedia'}
                  </td>
                  <td className="px-4 py-3 text-sm text-navy-light/70 tabular-nums font-mono text-[12px]">
                    {s.weeks}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap font-body">
                    <span className={s.cost === 0 ? 'text-teal-deep/80' : 'text-navy-light/70'}>
                      {formatCost(s.cost)}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-[12px] text-navy-light/60 font-body">
                      {mentorName(s) ?? (
                        <span className="text-navy-light/60">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {s.prerequisite
                      ? <StudyTypeBadge code={s.prerequisite} size="sm" />
                      : <span className="text-xs text-navy-light/60 font-body">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <CommitmentIcons donor={s.req_donor} server={s.req_server} charlas={s.req_attendee} size={13} />
                  </td>
                  <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    {canManage && (
                      <Link
                        href={`/estudios/plan/${s.id}`}
                        className="rounded-lg px-2.5 py-1 text-[11px] text-navy-light border hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body"
                      >
                        Ver
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ── Tab 2 · Detalles de cada estudio: detalle por etapa ── */}
      {tab === 'detalles' && (
      <div className="rounded-2xl p-4 sm:p-6 bg-surface-card shadow-[var(--shadow-md)]">

        {/* Stage header strip */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <StageLabel color="navy">Niveles</StageLabel>
          <ChevronRight size={13} className="text-navy/25" strokeWidth={1.5} />
          <StageLabel color="teal">Etapa Inicial</StageLabel>
          <ChevronRight size={13} className="text-navy/25" strokeWidth={1.5} />
          <StageLabel color="coral">Etapa Intermedia</StageLabel>
          <ChevronRight size={13} className="text-navy/25" strokeWidth={1.5} />
          <StageLabel color="purple">Campañas</StageLabel>
          <span className="ml-auto text-[11px] text-navy-light/60 font-body">
            Plan de estudios bíblicos
          </span>
        </div>

        {/* ── Niveles (cadena horizontal, compact) ── */}
        <div className="mb-1">
          <p className="text-[10px] tracking-widest uppercase text-navy-light/35 mb-3 font-display">
            Fundamentos — sin costo, sin requisitos
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {niveles.map((s, i) => (
              <Fragment key={s.id}>
                <StudyCardCompact study={s} />
                {i < niveles.length - 1 && (
                  <ChevronRight size={14} className="text-navy/25 shrink-0" strokeWidth={1.5} />
                )}
              </Fragment>
            ))}
          </div>
        </div>

        <StageDivider label="Al completar N4 se habilita la Etapa Inicial" />

        {/* ── Etapa Inicial ── */}
        <div className="mb-1">
          <p className="text-[10px] tracking-widest uppercase text-navy-light/35 mb-3 font-display">
            Etapa Inicial · Requiere asistir a charlas
          </p>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {inicial.map(s => <StudyCardFull key={s.id} study={s} mentor={mentorName(s)} canManage={canManage} />)}
          </div>
        </div>

        <StageDivider label="Al completar al menos un Inicial se habilita la Etapa Intermedia" />

        {/* ── Etapa Intermedia ── */}
        <div className="mb-1">
          <p className="text-[10px] tracking-widest uppercase text-navy-light/35 mb-3 font-display">
            Etapa Intermedia · Requiere donador + servidor + charlas
          </p>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {intermedia.map(s => <StudyCardFull key={s.id} study={s} mentor={mentorName(s)} canManage={canManage} />)}
          </div>
        </div>

        <StageDivider label="Abiertas a todo público" />

        {/* ── Campañas ── */}
        <div>
          <p className="text-[10px] tracking-widest uppercase text-navy-light/35 mb-3 font-display">
            Campañas
          </p>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {campana.map(s => <StudyCardFull key={s.id} study={s} mentor={mentorName(s)} canManage={canManage} />)}
          </div>
        </div>
      </div>
      )}

    </div>
  )
}
