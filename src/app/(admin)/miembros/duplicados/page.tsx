'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/EmptyState'
import { ResolucionDeFusion } from '@/components/members/ResolucionDeFusion'
import { principalSugerido } from '@/lib/members/resolucion-de-fusion'
import { useToast } from '@/components/shared/Toast'
import { calcAge, formatDateNumeric, initialsFromParts } from '@/lib/format'
import { ChevronLeft, Users } from 'lucide-react'

type DupMember = {
  id: string; first_name: string; last_name: string
  cedula: string | null; email: string | null; phone: string | null; created_at: string
  birth_date: string | null; province: string | null; canton: string | null
  occupation: string | null; photo_url: string | null
  field_updated_at: Record<string, string> | null
}
type DupPair = { a: DupMember; b: DupMember; reasons: string[] }

const REASON_LABEL: Record<string, string> = {
  email: 'Mismo email', cedula: 'Misma cédula', telefono: 'Mismo teléfono', nombre: 'Nombre similar',
}

// Peso de cada coincidencia (cédula vale por 2).
const REASON_WEIGHT: Record<string, number> = { cedula: 2, email: 1, telefono: 1, nombre: 1 }

function scoreOf(reasons: string[]) {
  return reasons.reduce((s, r) => s + (REASON_WEIGHT[r] ?? 1), 0)
}
function levelOf(score: number): 'alto' | 'medio' | 'bajo' {
  if (score >= 3) return 'alto'
  if (score === 2) return 'medio'
  return 'bajo'
}
const LEVEL = {
  alto:  { label: 'Alta coincidencia',  cls: 'text-coral bg-coral/10' },
  medio: { label: 'Media coincidencia', cls: 'text-yellow-600 bg-yellow-50' },
  bajo:  { label: 'Baja coincidencia',  cls: 'text-navy-light/80 bg-surface-low' },
}

function birthLabel(m: DupMember) {
  if (!m.birth_date) return '—'
  return `${formatDateNumeric(m.birth_date)} (${calcAge(m.birth_date)} años)`
}
function initials(m: DupMember) {
  return initialsFromParts(m.first_name, m.last_name)
}

function MemberMini({ m }: { m: DupMember }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-[var(--outline-variant)] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[11px] font-display font-extrabold">{initials(m)}</span>
        <Link href={`/miembros/${m.id}`} className="text-sm text-navy font-body font-medium truncate hover:text-coral">
          {m.first_name} {m.last_name}
        </Link>
      </div>
      <dl className="space-y-0.5 text-[13px] font-body">
        <div className="flex gap-1"><dt className="text-navy-light/80 w-16 shrink-0">Cédula</dt><dd className="text-navy-light/80 truncate">{m.cedula ?? '—'}</dd></div>
        <div className="flex gap-1"><dt className="text-navy-light/80 w-16 shrink-0">Email</dt><dd className="text-navy-light/80 truncate">{m.email ?? '—'}</dd></div>
        <div className="flex gap-1"><dt className="text-navy-light/80 w-16 shrink-0">Teléfono</dt><dd className="text-navy-light/80 truncate">{m.phone ?? '—'}</dd></div>
        <div className="flex gap-1"><dt className="text-navy-light/80 w-16 shrink-0">Nacimiento</dt><dd className="text-navy-light/80 truncate">{birthLabel(m)}</dd></div>
        <div className="flex gap-1"><dt className="text-navy-light/80 w-16 shrink-0">Creado</dt><dd className="text-navy-light/80 truncate">{formatDateNumeric(m.created_at)}</dd></div>
      </dl>
    </div>
  )
}

// ─── Merge campo por campo ──────────────────────────────────────────────────────

/**
 * La resolución campo por campo vive en un componente compartido: la misma la
 * usa el "Fusionar duplicado" de la ficha. Acá solo se elige cuál de las dos
 * sobrevive y se le pasa el par.
 */
function MergeModal({ pair, onClose, onMerged }: { pair: DupPair; onClose: () => void; onMerged: (aviso: string) => void }) {
  // Cuál sobrevive NO arranca en "la primera": si una de las dos tiene la
  // cuenta que la persona usa para entrar, esa manda. Dejar de secundaria la
  // cuenta que sí se ocupa significa apagarle el login bueno.
  const sugerido = useMemo(() => principalSugerido(pair.a, pair.b), [pair])
  const [invertido, setInvertido] = useState(false)
  const keep = invertido ? sugerido.duplicado : sugerido.principal
  const drop = invertido ? sugerido.principal : sugerido.duplicado
  return (
    <ResolucionDeFusion
      principal={keep}
      duplicado={drop}
      porQueEstePrincipal={invertido ? null : sugerido.porQue}
      onCambiarPrincipal={() => setInvertido(v => !v)}
      onCancelar={onClose}
      onFusionado={onMerged}
    />
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'cedula', label: 'Cédula repetida' },
  { key: 'email', label: 'Email repetido' },
  { key: 'telefono', label: 'Teléfono repetido' },
  { key: 'nombre', label: 'Nombre similar' },
  { key: 'alta', label: 'Alta confianza' },
] as const

export default function DuplicadosPage() {
  const toast = useToast()
  const [pairs, setPairs] = useState<DupPair[]>([])
  const [loading, setLoading] = useState(true)
  const [merging, setMerging] = useState<DupPair | null>(null)
  const [filter, setFilter] = useState<typeof FILTERS[number]['key']>('todos')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/members/duplicates')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setPairs(Array.isArray(d) ? d : []))
      .catch(() => setPairs([]))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const pairKey = (p: DupPair) => [p.a.id, p.b.id].sort().join('|')

  async function dismiss(p: DupPair) {
    setPairs(prev => prev.filter(x => pairKey(x) !== pairKey(p)))
    await fetch('/api/members/duplicates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: p.a.id, b: p.b.id }),
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`) })
      .catch(() => toast('No se pudo descartar el par de duplicados', 'error'))
  }

  const sorted = useMemo(() =>
    [...pairs].sort((x, y) => scoreOf(y.reasons) - scoreOf(x.reasons)),
  [pairs])

  const visible = useMemo(() => sorted.filter(p => {
    if (filter === 'todos') return true
    if (filter === 'alta') return levelOf(scoreOf(p.reasons)) === 'alto'
    return p.reasons.includes(filter)
  }), [sorted, filter])

  return (
    <div className="space-y-5">
      <Link href="/miembros" className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body">
        <ChevronLeft size={16} /> Miembros
      </Link>
      <div>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Duplicados sugeridos</h1>
        <p className="mt-1 text-sm text-navy-light/80 font-body">Pares de miembros que probablemente son la misma persona.</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn('rounded-full px-3.5 py-1.5 text-sm transition-colors font-body',
              filter === f.key ? 'bg-navy text-white' : 'bg-surface-low text-navy-light hover:bg-surface-container')}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center font-body">
          <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
          <p className="text-sm text-navy-light/80">Buscando duplicados…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
          <EmptyState icon={Users} title="No se encontraron duplicados sugeridos" />
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(p => {
            const score = scoreOf(p.reasons)
            const lvl = LEVEL[levelOf(score)]
            return (
              <div key={pairKey(p)} className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[13px] font-medium font-body', lvl.cls)}>
                    {lvl.label} · {p.reasons.length} campo{p.reasons.length === 1 ? '' : 's'}
                  </span>
                  {p.reasons.map(r => (
                    <span key={r} className="rounded-full bg-surface-low px-2.5 py-0.5 text-[13px] text-navy-light/80 font-body">{REASON_LABEL[r] ?? r}</span>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <MemberMini m={p.a} />
                  <MemberMini m={p.b} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => dismiss(p)} className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">No es duplicado</button>
                  <button onClick={() => setMerging(p)} className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body">Hacer merge</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {merging && (
        <MergeModal
          pair={merging}
          onClose={() => setMerging(null)}
          onMerged={(aviso) => {
            const mergedKey = pairKey(merging)
            setMerging(null)
            // El par fusionado ya no es candidato (el secundario quedó inactivo):
            // se quita de inmediato y luego se refresca contra la BD.
            setPairs(prev => prev.filter(x => pairKey(x) !== mergedKey))
            // El aviso lo arma la resolución: puede incluir que una cuenta de
            // acceso quedó deshabilitada, que es lo que hay que leer.
            toast(aviso, 'success')
            load()
          }}
        />
      )}
    </div>
  )
}
