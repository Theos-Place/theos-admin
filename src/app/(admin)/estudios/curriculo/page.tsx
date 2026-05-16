'use client'

import Link from 'next/link'
import { Fragment } from 'react'
import { STUDY_TYPES } from '@/data/mock-studies'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { CommitmentIcons } from '@/components/studies/CommitmentIcons'
import { ChevronRight, ArrowDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const niveles    = STUDY_TYPES.filter(s => s.stage === 'niveles')
const inicial    = STUDY_TYPES.filter(s => s.stage === 'inicial')
const intermedia = STUDY_TYPES.filter(s => s.stage === 'intermedia')
const campana    = STUDY_TYPES.filter(s => s.stage === 'campaña')

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
      className={cn('inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide', styles[color])}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {children}
    </span>
  )
}

function StudyCard({ study, compact = false }: { study: typeof STUDY_TYPES[0]; compact?: boolean }) {
  const borderColor = study.stage === 'niveles'
    ? 'border-l-navy/40'
    : study.stage === 'inicial'
    ? 'border-l-teal-deep/40'
    : study.stage === 'campaña'
    ? 'border-l-purple-400'
    : 'border-l-coral/40'

  return (
    <Link
      href={`/estudios/curriculo/${study.id}`}
      className={cn(
        'group flex flex-col gap-1 rounded-xl border-l-2 bg-surface-low px-3 py-2.5 transition-all hover:bg-surface-card hover:shadow-sm',
        borderColor,
        compact ? 'min-w-[110px]' : 'min-w-[130px]',
      )}
    >
      <StudyTypeBadge code={study.code} size="sm" />
      <p
        className="text-xs text-navy leading-snug group-hover:text-navy font-medium"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {study.name}
      </p>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
          {study.weeks} sem.
        </span>
        <span
          className={cn(
            'text-[10px] font-medium',
            study.cost === 0 ? 'text-teal-deep/70' : 'text-navy-light/50',
          )}
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {formatCost(study.cost)}
        </span>
      </div>
    </Link>
  )
}

function StageDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-1.5 text-navy-light/40">
        <ArrowDown size={13} strokeWidth={1.5} />
        <span className="text-[11px]" style={{ fontFamily: 'var(--font-body)' }}>{label}</span>
      </div>
      <div className="flex-1 h-px bg-outline-variant" style={{ background: 'var(--outline-variant)' }} />
    </div>
  )
}

export default function CurriculoPage() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-2xl text-navy"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Currículo
          </h1>
          <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            {STUDY_TYPES.length} tipos de estudio en 4 etapas
          </p>
        </div>
        <Link
          href="/estudios/curriculo/nuevo"
          className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <Plus size={14} strokeWidth={1.75} />
          Nuevo tipo
        </Link>
      </div>

      {/* ── Plan de estudios ── */}
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

        {/* ── Niveles (horizontal chain) ── */}
        <div className="mb-1">
          <p
            className="text-[10px] tracking-widest uppercase text-navy-light/35 mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Fundamentos — sin costo, sin requisitos
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {niveles.map((s, i) => (
              <Fragment key={s.id}>
                <StudyCard study={s} compact />
                {i < niveles.length - 1 && (
                  <ChevronRight size={14} className="text-navy/25 shrink-0" strokeWidth={1.5} />
                )}
              </Fragment>
            ))}
          </div>
        </div>

        <StageDivider label="Al completar N4 se habilita la Etapa Inicial" />

        {/* ── Etapa Inicial (grid) ── */}
        <div className="mb-1">
          <p
            className="text-[10px] tracking-widest uppercase text-navy-light/35 mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Etapa Inicial — ₡15,000 · Requiere ser donador
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {inicial.map(s => (
              <StudyCard key={s.id} study={s} />
            ))}
          </div>
        </div>

        <StageDivider label="Al completar al menos un Inicial se habilita la Etapa Intermedia" />

        {/* ── Etapa Intermedia (grid) ── */}
        <div className="mb-1">
          <p
            className="text-[10px] tracking-widest uppercase text-navy-light/35 mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Etapa Intermedia — ₡20,000 · Requiere donador + servidor + charlas
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {intermedia.map(s => (
              <StudyCard key={s.id} study={s} />
            ))}
          </div>
        </div>

        <StageDivider label="Campañas — abiertas a toda la iglesia, sin prerrequisito" />

        {/* ── Campañas (grid) ── */}
        <div>
          <p
            className="text-[10px] tracking-widest uppercase text-navy-light/35 mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Campañas — ₡25,000 · Sin prerrequisito
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {campana.map(s => (
              <StudyCard key={s.id} study={s} />
            ))}
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
            <h2
              className="text-sm font-semibold text-navy"
              style={{ fontFamily: 'var(--font-display)' }}
            >
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
                {['Código', 'Nombre', 'Etapa', 'Semanas', 'Costo', 'Prerrequisito', 'Compromisos', ''].map(h => (
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
                  <td
                    className="px-4 py-3 text-sm text-navy"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {s.name}
                  </td>
                  <td
                    className="px-4 py-3 text-xs text-navy-light/60"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {s.stage === 'niveles' ? 'Niveles' : s.stage === 'inicial' ? 'Inicial' : 'Intermedia'}
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-navy-light/70 tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  >
                    {s.weeks}
                  </td>
                  <td
                    className="px-4 py-3 text-sm whitespace-nowrap"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    <span className={s.cost === 0 ? 'text-teal-deep/80' : 'text-navy-light/70'}>
                      {formatCost(s.cost)}
                    </span>
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
                      href={`/estudios/curriculo/${s.id}`}
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
