'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { ChevronLeft, Loader2, Users, FileText, Video, MapPin } from 'lucide-react'
import type { CierreDetalle, CierreParticipante } from '@/lib/supabase/queries/studies'
import type { ResultadoCierre } from '@/lib/studies/close-result-read'

const RESULTADO_LABEL: Record<ResultadoCierre, string> = {
  aprobado: 'Aprobó',
  reprobado: 'Reprobó',
  retirado: 'Se retiró',
  sin_evaluar: 'Sin evaluar',
  otro: 'Sin cerrar',
}

const RESULTADO_BADGE: Record<ResultadoCierre, string> = {
  aprobado: 'bg-teal-deep/10 text-teal-deep',
  reprobado: 'bg-coral/10 text-coral-deep',
  retirado: 'bg-navy/10 text-navy',
  sin_evaluar: 'bg-amber-500/10 text-amber-700',
  otro: 'bg-navy/5 text-navy-light',
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return '—'
  return new Date(y, m - 1, d).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function Conteo({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)] min-w-0">
      <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">{label}</p>
      <p className={cn('mt-2 text-3xl font-bold font-display tabular-nums', color)}>{value}</p>
    </div>
  )
}

function Fila({ p, idx }: { p: CierreParticipante; idx: number }) {
  return (
    <tr className={cn('transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}>
      <td className="px-4 py-3 text-sm text-navy font-body min-w-0">
        <Link href={`/miembros/${p.member_id}`} className="hover:text-teal-deep transition-colors">{p.nombre}</Link>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold font-display', RESULTADO_BADGE[p.resultado])}>
          {RESULTADO_LABEL[p.resultado]}
        </span>
      </td>
      <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body tabular-nums whitespace-nowrap">
        {p.nota != null ? p.nota : ''}
      </td>
      <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">
        {p.motivo ? <span className="italic">“{p.motivo}”</span> : ''}
      </td>
    </tr>
  )
}

export default function ResumenCierrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [d, setD] = useState<CierreDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/studies/groups/${id}/close-detail`)
      .then(async r => {
        const body = await r.json().catch(() => null)
        if (!r.ok) throw new Error(body?.error ?? 'No se pudo cargar el cierre.')
        return body as CierreDetalle
      })
      .then(setD)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <PageContainer width="work" className="space-y-6">
      <Link
        href={`/estudios/grupos/${id}`}
        className="inline-flex items-center gap-1 text-[13px] text-navy-light/80 hover:text-navy transition-colors font-body"
      >
        <ChevronLeft size={14} aria-hidden /> Volver al grupo
      </Link>

      {loading ? (
        <p className="py-10 text-center text-sm text-navy-light/80 font-body inline-flex items-center gap-2 justify-center w-full">
          <Loader2 size={15} className="animate-spin" aria-hidden /> Cargando…
        </p>
      ) : error || !d ? (
        <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-6">
          <p className="text-sm text-coral-deep font-body">{error ?? 'Ese grupo no existe.'}</p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em] min-w-0">
              {d.grupo.name ?? 'Grupo sin nombre'}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-navy-light/80 font-body">
              {d.grupo.nivel && <span>{d.grupo.nivel}</span>}
              {d.grupo.dirigente && <span>Dirigía {d.grupo.dirigente}{d.grupo.co_dirigente ? ` y ${d.grupo.co_dirigente}` : ''}</span>}
              <span className="inline-flex items-center gap-1">
                {d.grupo.ubicacion || d.grupo.zona ? (
                  <><MapPin size={13} className="text-navy-light/40" aria-hidden />{[d.grupo.ubicacion, d.grupo.zona].filter(Boolean).join(' · ')}</>
                ) : <><Video size={13} className="text-navy-light/40" aria-hidden />Sin ubicación</>}
              </span>
            </p>
            <p className="text-[13px] text-navy-light/80 font-body">
              {fmtDate(d.grupo.starts_at)} — {fmtDate(d.grupo.ends_at)}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Conteo label="Aprobados" value={d.conteo.aprobados} color="text-teal-deep" />
            <Conteo label="Reprobados" value={d.conteo.reprobados} color="text-coral" />
            <Conteo label="Retirados" value={d.conteo.retirados} color="text-navy" />
            <Conteo label="Sin evaluar" value={d.conteo.sin_evaluar} color="text-amber-600" />
          </div>

          {d.folleto_request_id && (
            <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5">
              <p className="flex flex-wrap items-center gap-2 text-sm text-navy font-body">
                <FileText size={15} className="text-coral shrink-0" aria-hidden />
                De este cierre salió una solicitud de folletos para el grupo siguiente.
                <Link href={`/estudios/folletos/${d.folleto_request_id}`} className="text-teal-deep hover:underline">
                  Verla
                </Link>
              </p>
            </div>
          )}

          <section className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--outline-variant)]">
              <Users size={16} className="text-coral shrink-0" aria-hidden />
              <h2 className="text-sm font-semibold text-navy font-display">Cómo terminó cada quien</h2>
              <span className="text-[13px] text-navy-light/80 font-body">{d.participantes.length} personas</span>
            </div>
            {d.participantes.length === 0 ? (
              <EmptyState icon={Users} title="Este grupo no tuvo inscripciones" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['Persona', 'Resultado', 'Nota', 'Motivo'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.participantes.map((p, i) => <Fila key={p.member_id} p={p} idx={i} />)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </PageContainer>
  )
}
