'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { STUDY_TYPES } from '@/data/mock-studies'
import { STUDY_CATALOG } from '@/data/study-catalog'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { CommitmentIcons } from '@/components/studies/CommitmentIcons'
import { ExpandableDescription } from '@/components/studies/ExpandableDescription'
import { ChevronRight, ArrowDown, Plus, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

const niveles    = STUDY_TYPES.filter(s => s.stage === 'niveles')
const inicial    = STUDY_TYPES.filter(s => s.stage === 'inicial')
const intermedia = STUDY_TYPES.filter(s => s.stage === 'intermedia')
const campana    = STUDY_TYPES.filter(s => s.stage === 'campaña')

function formatCost(cost: number) {
  if (cost === 0) return 'Gratis'
  return `₡${cost.toLocaleString('es-CR')}`
}

function getLevelColor(level: string): string {
  switch (level) {
    case 'Básico':     return 'rgba(112,189,194,.15)'
    case 'Intermedio': return 'rgba(22,20,64,.07)'
    case 'Avanzado':   return 'rgba(239,85,84,.1)'
    default:           return 'var(--surface-low)'
  }
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
      className={cn('inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide', styles[color])}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {children}
    </span>
  )
}

function StudyCardCompact({ study }: { study: typeof STUDY_TYPES[0] }) {
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
      <p className="text-xs text-navy leading-snug font-medium" style={{ fontFamily: 'var(--font-body)' }}>
        {study.name}
      </p>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
          {study.weeks} sem.
        </span>
        <span
          className={cn('text-[10px] font-medium', study.cost === 0 ? 'text-teal-deep/70' : 'text-navy-light/50')}
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {formatCost(study.cost)}
        </span>
      </div>
    </Link>
  )
}

function StudyCardFull({ study }: { study: typeof STUDY_TYPES[0] }) {
  const router = useRouter()
  const cat = STUDY_CATALOG.find(s => s.code === study.code)

  return (
    <div
      className="rounded-xl bg-surface-low flex flex-col gap-0"
      style={{ padding: '14px 16px' }}
      onClick={() => router.push(`/estudios/plan/${study.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && router.push(`/estudios/plan/${study.id}`)}
    >
      {/* Header: código + nombre + semanas */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <span
            style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--brand-coral)', textTransform: 'uppercase' }}
            className="font-display"
          >
            {study.code}
          </span>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand-navy)', marginTop: 2, fontFamily: 'var(--font-display)' }}>
            {study.name}
          </div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--fg-muted)', whiteSpace: 'nowrap', marginLeft: 8, fontFamily: 'var(--font-body)' }}>
          {study.weeks} sem.
        </span>
      </div>

      {/* Mentor */}
      {cat?.mentor && (
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 6, fontFamily: 'var(--font-body)' }}>
          Mentor: <strong>{cat.mentor}</strong>
        </div>
      )}

      {/* Descripción expandible */}
      <ExpandableDescription text={cat?.description} maxLength={120} />

      {/* Compromisos */}
      {(study.req_donor || study.req_server || study.req_attendee) && (
        <div className="mt-2">
          <CommitmentIcons donor={study.req_donor} server={study.req_server} charlas={study.req_attendee} size={12} />
        </div>
      )}

      {/* Nivel */}
      {cat?.level && (
        <div style={{ marginTop: 8 }}>
          <span
            style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 999,
              background: getLevelColor(cat.level), fontWeight: 600,
              fontFamily: 'var(--font-display)',
            }}
          >
            {cat.level}
          </span>
        </div>
      )}

      {/* Botón editar */}
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={e => { e.stopPropagation(); router.push(`/estudios/plan/${study.code}/editar`) }}
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] text-navy-light hover:bg-surface-card hover:text-navy transition-colors"
          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
        >
          <Pencil size={11} /> Editar
        </button>
      </div>
    </div>
  )
}

function StageDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-1.5 text-navy-light/40">
        <ArrowDown size={13} strokeWidth={1.5} />
        <span className="text-[11px]" style={{ fontFamily: 'var(--font-body)' }}>{label}</span>
      </div>
      <div className="flex-1 h-px" style={{ background: 'var(--outline-variant)' }} />
    </div>
  )
}

export default function PlanDeEstudiosPage() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-2xl text-navy"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Plan de Estudios Bíblicos
          </h1>
          <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            Ruta de crecimiento espiritual de Theos Place
          </p>
        </div>
        <Link
          href="/estudios/plan/nuevo"
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <Plus size={14} strokeWidth={1.75} />
          Nuevo tipo
        </Link>
      </div>

      {/* ── Plan visual ── */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>

        {/* Stage header strip */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <StageLabel color="navy">Niveles</StageLabel>
          <ChevronRight size={13} className="text-navy/25" strokeWidth={1.5} />
          <StageLabel color="teal">Etapa Inicial</StageLabel>
          <ChevronRight size={13} className="text-navy/25" strokeWidth={1.5} />
          <StageLabel color="coral">Etapa Intermedia</StageLabel>
          <ChevronRight size={13} className="text-navy/25" strokeWidth={1.5} />
          <StageLabel color="purple">Campañas</StageLabel>
          <span className="ml-auto text-[11px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
            Plan de estudios bíblicos
          </span>
        </div>

        {/* ── Niveles (cadena horizontal, compact) ── */}
        <div className="mb-1">
          <p className="text-[10px] tracking-widest uppercase text-navy-light/35 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
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
          <p className="text-[10px] tracking-widest uppercase text-navy-light/35 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            Etapa Inicial — ₡15,000 · Requiere ser donador
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {inicial.map(s => <StudyCardFull key={s.id} study={s} />)}
          </div>
        </div>

        <StageDivider label="Al completar al menos un Inicial se habilita la Etapa Intermedia" />

        {/* ── Etapa Intermedia ── */}
        <div className="mb-1">
          <p className="text-[10px] tracking-widest uppercase text-navy-light/35 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            Etapa Intermedia — ₡20,000 · Requiere donador + servidor + charlas
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {intermedia.map(s => <StudyCardFull key={s.id} study={s} />)}
          </div>
        </div>

        <StageDivider label="Campañas — abiertas a toda la iglesia, sin prerrequisito" />

        {/* ── Campañas ── */}
        <div>
          <p className="text-[10px] tracking-widest uppercase text-navy-light/35 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            Campañas — ₡25,000 · Sin prerrequisito
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {campana.map(s => <StudyCardFull key={s.id} study={s} />)}
          </div>
        </div>
      </div>

      {/* ── Tabla administrativa ── */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--outline-variant)' }}
        >
          <div>
            <h2 className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
              Todos los tipos de estudio
            </h2>
            <p className="text-xs text-navy-light/50 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
              {STUDY_TYPES.length} estudios en total
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                {['Código', 'Nombre', 'Etapa', 'Semanas', 'Costo', 'Instructor', 'Prerrequisito', 'Compromisos', ''].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] tracking-widest uppercase text-navy-light/40 whitespace-nowrap"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STUDY_TYPES.map((s, i) => (
                <tr
                  key={s.id}
                  className="hover:bg-surface-low transition-colors group"
                  style={i < STUDY_TYPES.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                >
                  <td className="px-4 py-3">
                    <StudyTypeBadge code={s.code} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                    {s.stage === 'niveles' ? 'Niveles' : s.stage === 'inicial' ? 'Inicial' : s.stage === 'campaña' ? 'Campaña' : 'Intermedia'}
                  </td>
                  <td className="px-4 py-3 text-sm text-navy-light/70 tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {s.weeks}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>
                    <span className={s.cost === 0 ? 'text-teal-deep/80' : 'text-navy-light/70'}>
                      {formatCost(s.cost)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                    {STUDY_CATALOG.find(c => c.code === s.code)?.mentor ?? (
                      <span className="text-navy-light/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.prerequisite
                      ? <StudyTypeBadge code={s.prerequisite} size="sm" />
                      : <span className="text-xs text-navy-light/30" style={{ fontFamily: 'var(--font-body)' }}>—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <CommitmentIcons donor={s.req_donor} server={s.req_server} charlas={s.req_attendee} size={13} />
                  </td>
                  <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/estudios/plan/${s.id}`}
                      className="rounded-lg px-2.5 py-1 text-[11px] text-navy-light border hover:bg-surface-low transition-colors"
                      style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
