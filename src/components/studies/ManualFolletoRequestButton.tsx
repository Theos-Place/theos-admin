'use client'

import { useState, useEffect } from 'react'
import { FileStack, Loader2, Check } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { useDirigentes } from '@/hooks/useDirigentes'
import { Combobox, type ComboValue } from '@/components/shared/Combobox'
import { STUDY_CATALOG } from '@/data/study-catalog'
import { cn } from '@/lib/utils'

const SELECT_CLS = 'w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30'
const LABEL_CLS = 'block text-[12px] font-medium text-navy-light/70 font-body mb-1.5'

type Sede = { id: string; name: string; is_active?: boolean }

/** Botón + modal para crear una solicitud de folletos MANUAL (caso especial).
 *  Entra a la misma cola (tipo 'manual'). onCreated permite refrescar la lista. */
export function ManualFolletoRequestButton({ onCreated }: { onCreated?: () => void }) {
  const toast = useToast()
  const { dirigentes } = useDirigentes()
  const [open, setOpen] = useState(false)
  const [sedes, setSedes] = useState<Sede[]>([])
  const [level, setLevel] = useState('')
  const [quantity, setQuantity] = useState('')
  const [sede, setSede] = useState('')
  const [leader, setLeader] = useState<ComboValue>({ kind: 'empty' })
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || sedes.length) return
    fetch('/api/sedes').then(r => (r.ok ? r.json() : [])).then((d: Sede[]) => setSedes(Array.isArray(d) ? d : [])).catch(() => {})
  }, [open, sedes.length])

  // Solo sedes vigentes (activas); la tabla incluye históricas/inactivas.
  const activeSedes = sedes.filter(s => s.is_active !== false)

  function reset() {
    setLevel(''); setQuantity(''); setSede(''); setLeader({ kind: 'empty' }); setNote(''); setError('')
  }

  async function submit() {
    const q = Number(quantity)
    // El combobox devuelve un dirigente registrado (existing → linkea id) o un
    // nombre libre escrito (new → solo nombre, sin id).
    const name = leader.kind === 'empty' ? '' : leader.label.trim()
    const leaderId = leader.kind === 'existing' ? leader.value : null
    if (!level) { setError('Seleccioná el folleto/nivel.'); return }
    if (!Number.isInteger(q) || q <= 0) { setError('La cantidad debe ser mayor a 0.'); return }
    if (!sede) { setError('Seleccioná la sede de entrega.'); return }
    if (!name) { setError('Indicá el dirigente a quien entregar.'); return }
    setError(''); setSubmitting(true)
    try {
      const res = await fetch('/api/studies/folletos/manual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_level_code: level, quantity: q, sede, target_leader_id: leaderId, target_leader_name: name, note: note.trim() || null }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'No se pudo crear la solicitud')
      toast('Solicitud de folletos creada. Entró a la cola.', 'success')
      setOpen(false); reset(); onCreated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la solicitud')
    } finally { setSubmitting(false) }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white font-body hover:bg-coral-deep transition-colors shrink-0"
      >
        <FileStack size={14} /> Solicitud de folletos manual
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} titleId="manual-folleto-title">
          <div className="p-6 space-y-4">
            <div>
              <h2 id="manual-folleto-title" className="text-lg font-semibold text-navy font-display">Solicitud de folletos manual</h2>
              <p className="mt-1 text-[13px] text-navy-light/70 font-body">Caso especial, fuera del flujo automático de cierre. Entra a la misma cola de impresión/entrega.</p>
            </div>

            <div>
              <label htmlFor="mf-level" className={LABEL_CLS}>Folleto / nivel <span className="text-coral">*</span></label>
              <select id="mf-level" value={level} onChange={e => setLevel(e.target.value)} className={SELECT_CLS}>
                <option value="">Seleccionar…</option>
                {STUDY_CATALOG.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="mf-qty" className={LABEL_CLS}>Cantidad <span className="text-coral">*</span></label>
              <input id="mf-qty" type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Ej: 10" className={SELECT_CLS} />
            </div>

            <div>
              <label htmlFor="mf-sede" className={LABEL_CLS}>Sede de entrega <span className="text-coral">*</span></label>
              <select id="mf-sede" value={sede} onChange={e => setSede(e.target.value)} className={SELECT_CLS}>
                <option value="">Seleccionar sede…</option>
                {activeSedes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className={LABEL_CLS}>Dirigente a quien entregar <span className="text-coral">*</span></label>
              <Combobox
                items={dirigentes.map(d => ({ value: d.member_id, label: d.member_name }))}
                value={leader}
                onChange={setLeader}
                allowCreate
                createLabel={t => `Agregar “${t}” (no está en la lista)`}
                placeholder="Buscá un dirigente o escribí un nombre…"
                ariaLabel="Dirigente a quien entregar"
              />
              <p className="mt-1 text-[11px] text-navy-light/60 font-body">Escribí para buscar; si no aparece, podés agregar el nombre igual.</p>
            </div>

            <div>
              <label htmlFor="mf-note" className={LABEL_CLS}>Nota (opcional)</label>
              <textarea id="mf-note" value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Explicá el caso especial para quien imprime…" className={cn(SELECT_CLS, 'resize-none placeholder:text-navy-light/50')} />
            </div>

            {error && <p className="text-[13px] text-coral font-body">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm text-navy-light/70 font-body hover:text-navy transition-colors">Cancelar</button>
              <button onClick={submit} disabled={submitting} className="inline-flex items-center gap-1.5 rounded-full bg-coral px-5 py-2 text-sm text-white font-body font-medium hover:bg-coral-deep transition-colors disabled:opacity-60">
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Creando…</> : <><Check size={14} /> Crear solicitud</>}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
