'use client'

import { use } from 'react'
import Link from 'next/link'
import { useDirigentes } from '@/hooks/useDirigentes'
import { StudyTypeBadge } from '@/components/studies/StudyTypeBadge'
import { cn } from '@/lib/utils'
import { ChevronLeft, ExternalLink, Users } from 'lucide-react'
import type { DirigenteGrupo } from '@/lib/dirigentes'

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase()
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CR', { month: 'short', year: 'numeric' })
}

function GrupoRow({ g }: { g: DirigenteGrupo }) {
  return (
    <Link
      href={`/estudios/grupos/${g.group_id}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-low transition-colors"
    >
      <StudyTypeBadge code={g.plan_code} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-navy font-body truncate">{g.group_name}</p>
        <p className="text-[11px] text-navy-light/50 font-body">{fmtDate(g.date)}</p>
      </div>
      <span className="flex items-center gap-1 text-xs text-navy-light/50 font-body shrink-0">
        <Users size={12} /> {g.students_count}
      </span>
      <ExternalLink size={13} className="text-navy-light/30 shrink-0" />
    </Link>
  )
}

export default function DirigenteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { dirigentes, loading } = useDirigentes()
  const d = dirigentes.find(x => x.member_id === id)

  if (loading) {
    return (
      <div className="py-16 text-center font-body">
        <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
        <p className="text-sm text-navy-light/50">Cargando…</p>
      </div>
    )
  }

  if (!d) {
    return (
      <div className="space-y-4">
        <Link href="/estudios/dirigentes" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy font-body">
          <ChevronLeft size={16} /> Dirigentes
        </Link>
        <p className="text-navy-light/60 font-body">Dirigente no encontrado.</p>
      </div>
    )
  }

  const totalStudents = [...d.estudios_activos, ...d.estudios_completados].reduce((s, g) => s + g.students_count, 0)

  return (
    <div className="space-y-5">
      <Link href="/estudios/dirigentes" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body">
        <ChevronLeft size={16} /> Dirigentes
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-base font-display font-extrabold">
            {initials(d.member_name) || '—'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl text-navy font-display font-extrabold tracking-[-0.02em]">{d.member_name || 'Sin nombre'}</h1>
              <span className={cn(
                'rounded-full px-2.5 py-0.5 text-[11px] font-medium font-body',
                d.status === 'activo' ? 'bg-[rgba(61,185,122,0.12)] text-[#3DB97A]' : 'bg-surface-low text-navy-light/50',
              )}>
                {d.status === 'activo' ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <p className="text-sm text-navy-light/60 font-body mt-1">
              {d.total_grupos} grupos liderados · {d.total_activos} activos · {totalStudents} estudiantes en total
            </p>
            <Link href={`/miembros/${d.member_id}`} className="inline-flex items-center gap-1 text-xs text-coral hover:text-coral-deep transition-colors font-body mt-2">
              Ver perfil del miembro <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        {/* Estudios habilitados */}
        {d.estudios_habilitados.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-widest text-navy-light/40 font-display mb-1.5">Estudios que ha impartido</p>
            <div className="flex flex-wrap gap-1.5">
              {d.estudios_habilitados.map(code => <StudyTypeBadge key={code} code={code} size="sm" />)}
            </div>
          </div>
        )}
      </div>

      {/* Estudios activos */}
      <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5">
        <h2 className="text-sm text-navy font-display font-extrabold mb-3">Dando ahora ({d.estudios_activos.length})</h2>
        {d.estudios_activos.length > 0 ? (
          <div className="space-y-1">{d.estudios_activos.map(g => <GrupoRow key={g.group_id} g={g} />)}</div>
        ) : (
          <p className="text-sm text-navy-light/40 font-body">No tiene grupos activos.</p>
        )}
      </div>

      {/* Historial */}
      <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5">
        <h2 className="text-sm text-navy font-display font-extrabold mb-3">Historial de estudios ({d.estudios_completados.length})</h2>
        {d.estudios_completados.length > 0 ? (
          <div className="space-y-1">{d.estudios_completados.map(g => <GrupoRow key={g.group_id} g={g} />)}</div>
        ) : (
          <p className="text-sm text-navy-light/40 font-body">Sin estudios registrados.</p>
        )}
      </div>
    </div>
  )
}
