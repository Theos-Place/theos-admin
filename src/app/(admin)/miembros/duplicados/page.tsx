'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal'
import { ChevronLeft, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'

type DupMember = {
  id: string; first_name: string; last_name: string
  cedula: string | null; email: string | null; phone: string | null; created_at: string
}
type DupPair = { a: DupMember; b: DupMember; reasons: string[] }

const REASON_LABEL: Record<string, string> = {
  email: 'Mismo email', cedula: 'Misma cédula', telefono: 'Mismo teléfono', nombre: 'Nombre similar',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function initials(m: DupMember) {
  return ((m.first_name[0] ?? '') + (m.last_name[0] ?? '')).toUpperCase()
}

function MemberMini({ m, selected, onSelect }: { m: DupMember; selected?: boolean; onSelect?: () => void }) {
  return (
    <div
      onClick={onSelect}
      className={cn('flex-1 min-w-0 rounded-xl border p-3', onSelect && 'cursor-pointer',
        selected ? 'border-coral bg-coral/5' : 'border-[var(--outline-variant)]')}
    >
      <div className="flex items-center gap-2 mb-2">
        {onSelect && <input type="radio" checked={!!selected} onChange={() => onSelect()} className="accent-coral" />}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy text-[10px] font-display font-extrabold">{initials(m)}</span>
        <Link href={`/miembros/${m.id}`} className="text-sm text-navy font-body font-medium truncate hover:text-coral" onClick={e => e.stopPropagation()}>
          {m.first_name} {m.last_name}
        </Link>
      </div>
      <dl className="space-y-0.5 text-[12px] font-body">
        <div className="flex gap-1"><dt className="text-navy-light/40 w-14 shrink-0">Cédula</dt><dd className="text-navy-light/70 truncate">{m.cedula ?? '—'}</dd></div>
        <div className="flex gap-1"><dt className="text-navy-light/40 w-14 shrink-0">Email</dt><dd className="text-navy-light/70 truncate">{m.email ?? '—'}</dd></div>
        <div className="flex gap-1"><dt className="text-navy-light/40 w-14 shrink-0">Teléfono</dt><dd className="text-navy-light/70 truncate">{m.phone ?? '—'}</dd></div>
        <div className="flex gap-1"><dt className="text-navy-light/40 w-14 shrink-0">Creado</dt><dd className="text-navy-light/70 truncate">{fmtDate(m.created_at)}</dd></div>
      </dl>
    </div>
  )
}

function MergeModal({ pair, onClose, onMerged }: { pair: DupPair; onClose: () => void; onMerged: () => void }) {
  const [keepId, setKeepId] = useState(pair.a.id)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const keep = keepId === pair.a.id ? pair.a : pair.b
  const drop = keepId === pair.a.id ? pair.b : pair.a

  async function doMerge() {
    setLoading(true)
    try {
      const res = await fetch(`/api/members/${keepId}/merge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duplicate_id: drop.id }),
      })
      if (!res.ok) throw new Error()
      onMerged()
    } catch { setLoading(false) }
  }

  if (confirming) {
    return (
      <DeleteConfirmModal
        open
        title="Confirmar fusión"
        description={`Se conservará ${keep.first_name} ${keep.last_name} y se eliminará ${drop.first_name} ${drop.last_name}, transfiriendo su familia, roles, estudios y servicio. Esta acción no se puede deshacer.`}
        keyword="fusionar"
        confirmLabel="Fusionar"
        loading={loading}
        onConfirm={doMerge}
        onCancel={() => setConfirming(false)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-ink/60 backdrop-blur-sm" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl rounded-2xl p-6 space-y-4 bg-surface-card shadow-[var(--shadow-lg)]">
        <div>
          <p className="text-base font-bold text-navy font-display">Fusionar duplicados</p>
          <p className="text-[13px] text-navy-light/60 font-body mt-1">Elegí cuál perfil se conserva. El otro se eliminará y todo su historial se transfiere al principal.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <MemberMini m={pair.a} selected={keepId === pair.a.id} onSelect={() => setKeepId(pair.a.id)} />
          <MemberMini m={pair.b} selected={keepId === pair.b.id} onSelect={() => setKeepId(pair.b.id)} />
        </div>
        <p className="text-[12px] text-navy-light/60 font-body">
          Se conserva <strong className="text-navy">{keep.first_name} {keep.last_name}</strong>.
        </p>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">Cancelar</button>
          <button onClick={() => setConfirming(true)} className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body">Continuar</button>
        </div>
      </div>
    </div>
  )
}

export default function DuplicadosPage() {
  const [pairs, setPairs] = useState<DupPair[]>([])
  const [loading, setLoading] = useState(true)
  const [merging, setMerging] = useState<DupPair | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/members/duplicates')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setPairs(Array.isArray(d) ? d : []))
      .catch(() => setPairs([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function pairKey(p: DupPair) { return [p.a.id, p.b.id].sort().join('|') }

  async function dismiss(p: DupPair) {
    setPairs(prev => prev.filter(x => pairKey(x) !== pairKey(p)))
    await fetch('/api/members/duplicates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: p.a.id, b: p.b.id }),
    }).catch(() => {})
  }

  return (
    <div className="space-y-5">
      <Link href="/miembros" className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors font-body">
        <ChevronLeft size={16} /> Miembros
      </Link>
      <div>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Duplicados sugeridos</h1>
        <p className="mt-1 text-sm text-navy-light/60 font-body">Pares de miembros que probablemente son la misma persona.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center font-body">
          <div className="h-7 w-7 mx-auto mb-3 rounded-full border-2 border-navy-light/20 border-t-coral animate-spin" />
          <p className="text-sm text-navy-light/50">Buscando duplicados…</p>
        </div>
      ) : pairs.length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
          <EmptyState icon={Users} title="No se encontraron duplicados sugeridos" />
        </div>
      ) : (
        <div className="space-y-3">
          {pairs.map(p => (
            <div key={pairKey(p)} className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {p.reasons.map(r => (
                  <span key={r} className="rounded-full bg-coral/10 px-2.5 py-0.5 text-[11px] text-coral font-body">{REASON_LABEL[r] ?? r}</span>
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
          ))}
        </div>
      )}

      {merging && (
        <MergeModal
          pair={merging}
          onClose={() => setMerging(null)}
          onMerged={() => { setMerging(null); load() }}
        />
      )}
    </div>
  )
}
