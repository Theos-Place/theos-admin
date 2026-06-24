'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { EmptyState } from '@/components/shared/EmptyState'
import { useToast } from '@/components/shared/Toast'
import { Modal } from '@/components/shared/Modal'
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
  bajo:  { label: 'Baja coincidencia',  cls: 'text-navy-light/60 bg-surface-low' },
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
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[10px] font-display font-extrabold">{initials(m)}</span>
        <Link href={`/miembros/${m.id}`} className="text-sm text-navy font-body font-medium truncate hover:text-coral">
          {m.first_name} {m.last_name}
        </Link>
      </div>
      <dl className="space-y-0.5 text-[12px] font-body">
        <div className="flex gap-1"><dt className="text-navy-light/60 w-16 shrink-0">Cédula</dt><dd className="text-navy-light/70 truncate">{m.cedula ?? '—'}</dd></div>
        <div className="flex gap-1"><dt className="text-navy-light/60 w-16 shrink-0">Email</dt><dd className="text-navy-light/70 truncate">{m.email ?? '—'}</dd></div>
        <div className="flex gap-1"><dt className="text-navy-light/60 w-16 shrink-0">Teléfono</dt><dd className="text-navy-light/70 truncate">{m.phone ?? '—'}</dd></div>
        <div className="flex gap-1"><dt className="text-navy-light/60 w-16 shrink-0">Nacimiento</dt><dd className="text-navy-light/70 truncate">{birthLabel(m)}</dd></div>
        <div className="flex gap-1"><dt className="text-navy-light/60 w-16 shrink-0">Creado</dt><dd className="text-navy-light/70 truncate">{formatDateNumeric(m.created_at)}</dd></div>
      </dl>
    </div>
  )
}

// ─── Merge campo por campo ──────────────────────────────────────────────────────
const MERGE_FIELDS: { key: keyof DupMember; label: string }[] = [
  { key: 'first_name', label: 'Nombre' },
  { key: 'last_name', label: 'Apellido' },
  { key: 'cedula', label: 'Cédula' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'birth_date', label: 'Fecha de nacimiento' },
  { key: 'province', label: 'Provincia' },
  { key: 'canton', label: 'Cantón' },
  { key: 'occupation', label: 'Ocupación' },
  { key: 'photo_url', label: 'Foto' },
]

function fieldDisplay(m: DupMember, key: keyof DupMember): string {
  const v = m[key]
  if (v === null || v === undefined || v === '') return '—'
  if (key === 'birth_date') return formatDateNumeric(v as string)
  if (key === 'photo_url') return 'Foto cargada'
  return String(v)
}
function fieldEditedLabel(m: DupMember, key: string): string | null {
  const ts = m.field_updated_at?.[key]
  return ts ? `editado ${formatDateNumeric(ts)}` : null
}
/** Selección por defecto: el valor editado más recientemente; si solo uno tiene
 *  valor, ese; si ninguno, 'a'. */
function defaultChoice(a: DupMember, b: DupMember, key: keyof DupMember): 'a' | 'b' {
  const av = a[key], bv = b[key]
  const aHas = av !== null && av !== undefined && av !== ''
  const bHas = bv !== null && bv !== undefined && bv !== ''
  if (aHas && !bHas) return 'a'
  if (bHas && !aHas) return 'b'
  const at = a.field_updated_at?.[key], bt = b.field_updated_at?.[key]
  if (at && bt) return new Date(bt) > new Date(at) ? 'b' : 'a'
  if (bt && !at) return 'b'
  return 'a'
}

function MergeModal({ pair, onClose, onMerged }: { pair: DupPair; onClose: () => void; onMerged: () => void }) {
  const [principal, setPrincipal] = useState<'a' | 'b'>('a')
  const [choice, setChoice] = useState<Record<string, 'a' | 'b'>>(() => {
    const init: Record<string, 'a' | 'b'> = {}
    for (const f of MERGE_FIELDS) init[f.key] = defaultChoice(pair.a, pair.b, f.key)
    return init
  })
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const keep = principal === 'a' ? pair.a : pair.b
  const drop = principal === 'a' ? pair.b : pair.a

  function pick(key: string, side: 'a' | 'b') { setChoice(c => ({ ...c, [key]: side })) }
  function selectAll(side: 'a' | 'b') {
    const next: Record<string, 'a' | 'b'> = {}
    for (const f of MERGE_FIELDS) next[f.key] = side
    setChoice(next)
  }

  // Campos finales que difieren del principal → se actualizan.
  const changedFields = useMemo(() => {
    const out: { key: keyof DupMember; from: 'a' | 'b'; value: unknown }[] = []
    for (const f of MERGE_FIELDS) {
      const src = choice[f.key] === 'a' ? pair.a : pair.b
      const val = src[f.key]
      if (val !== keep[f.key]) out.push({ key: f.key, from: choice[f.key], value: val })
    }
    return out
  }, [choice, pair, keep])

  async function doMerge() {
    setLoading(true); setErr(null)
    try {
      const fields: Record<string, unknown> = {}
      for (const c of changedFields) fields[c.key as string] = c.value
      const res = await fetch(`/api/members/${keep.id}/merge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duplicate_id: drop.id, fields, soft: true }),
      })
      if (!res.ok) throw new Error()
      onMerged()
    } catch { setErr('No se pudo fusionar. Intentá de nuevo.'); setLoading(false); setConfirming(false) }
  }

  if (confirming) {
    return (
      <DeleteConfirmModal
        open
        title="Confirmar fusión"
        description={`Se conservará ${keep.first_name} ${keep.last_name} con los datos elegidos. El otro perfil quedará inactivo (marcado como fusionado) y su familia, roles, estudios, servicio y pagos pasarán al principal.`}
        keyword="fusionar"
        confirmLabel="Fusionar"
        loading={loading}
        onConfirm={doMerge}
        onCancel={() => setConfirming(false)}
      />
    )
  }

  return (
    <Modal onClose={onClose} titleId="fusionar-campos-title" width={768}>
      <div className="p-6 space-y-4">
        <div>
          <p id="fusionar-campos-title" className="text-base font-bold text-navy font-display">Fusionar campo por campo</p>
          <p className="text-[13px] text-navy-light/60 font-body mt-1">Elegí qué dato conservar de cada perfil. El perfil principal sobrevive; el otro queda inactivo.</p>
        </div>

        {/* Principal + seleccionar todo */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2 text-xs font-body">
            <span className="text-navy-light/60">Perfil principal:</span>
            {(['a', 'b'] as const).map(s => (
              <button key={s} onClick={() => setPrincipal(s)}
                className={cn('rounded-full px-3 py-1 transition-colors', principal === s ? 'bg-navy text-white' : 'bg-surface-low text-navy-light')}>
                {s === 'a' ? pair.a.first_name : pair.b.first_name} {s === 'a' ? pair.a.last_name : pair.b.last_name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => selectAll('a')} className="text-[11px] text-coral hover:underline font-body">Todo de A</button>
            <button onClick={() => selectAll('b')} className="text-[11px] text-coral hover:underline font-body">Todo de B</button>
          </div>
        </div>

        {/* Tabla comparativa */}
        <div className="rounded-xl border border-[var(--outline-variant)] divide-y divide-[var(--outline-variant)]">
          <div className="grid grid-cols-[80px_1fr_1fr] gap-2 px-3 py-2 text-[10px] uppercase tracking-widest text-navy-light/60 font-display">
            <span>Campo</span>
            <span>A · {pair.a.first_name}</span>
            <span>B · {pair.b.first_name}</span>
          </div>
          {MERGE_FIELDS.map(f => {
            const aEd = fieldEditedLabel(pair.a, f.key), bEd = fieldEditedLabel(pair.b, f.key)
            return (
              <div key={f.key} className="grid grid-cols-[80px_1fr_1fr] gap-2 px-3 py-2 items-start">
                <span className="text-[11px] text-navy-light/60 font-body pt-1">{f.label}</span>
                {(['a', 'b'] as const).map(side => {
                  const m = side === 'a' ? pair.a : pair.b
                  const ed = side === 'a' ? aEd : bEd
                  return (
                    <label key={side} className={cn('flex items-start gap-2 rounded-lg px-2 py-1 cursor-pointer', choice[f.key] === side ? 'bg-coral/5' : 'hover:bg-surface-low')}>
                      <input type="radio" checked={choice[f.key] === side} onChange={() => pick(f.key, side)} className="accent-coral mt-1 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[13px] text-navy font-body truncate">{fieldDisplay(m, f.key)}</span>
                        {ed && <span className="block text-[10px] text-navy-light/60 font-body">{ed}</span>}
                      </span>
                    </label>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Resumen */}
        {changedFields.length > 0 && (
          <div className="rounded-xl bg-surface-low px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display mb-1">Cambios a aplicar al principal</p>
            <ul className="text-[12px] text-navy-light/70 font-body space-y-0.5">
              {changedFields.map(c => (
                <li key={c.key as string}>
                  <strong className="text-navy">{MERGE_FIELDS.find(f => f.key === c.key)?.label}</strong>: se usa el valor del perfil {c.from.toUpperCase()}
                </li>
              ))}
            </ul>
          </div>
        )}

        {err && <p className="text-sm text-coral font-body">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">Cancelar</button>
          <button onClick={() => setConfirming(true)} className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body">Continuar</button>
        </div>
      </div>
    </Modal>
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
      <Link href="/miembros" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body">
        <ChevronLeft size={16} /> Miembros
      </Link>
      <div>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Duplicados sugeridos</h1>
        <p className="mt-1 text-sm text-navy-light/60 font-body">Pares de miembros que probablemente son la misma persona.</p>
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
          <p className="text-sm text-navy-light/60">Buscando duplicados…</p>
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
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium font-body', lvl.cls)}>
                    {lvl.label} · {p.reasons.length} campo{p.reasons.length === 1 ? '' : 's'}
                  </span>
                  {p.reasons.map(r => (
                    <span key={r} className="rounded-full bg-surface-low px-2.5 py-0.5 text-[11px] text-navy-light/60 font-body">{REASON_LABEL[r] ?? r}</span>
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
          onMerged={() => {
            const mergedKey = pairKey(merging)
            setMerging(null)
            // El par fusionado ya no es candidato (el secundario quedó inactivo):
            // se quita de inmediato y luego se refresca contra la BD.
            setPairs(prev => prev.filter(x => pairKey(x) !== mergedKey))
            toast('Miembros fusionados correctamente', 'success')
            load()
          }}
        />
      )}
    </div>
  )
}
