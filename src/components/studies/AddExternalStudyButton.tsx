'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { useStudies } from '@/hooks/useStudies'
import { useAuth } from '@/hooks/useAuth'
import { EXTERNAL_STUDY_ROLES } from '@/lib/auth/roles'

/**
 * "Agregar estudio" en el tab de Administración del expediente.
 *
 * El caso real: alguien llegó a Theos habiendo llevado Nivel 2 en otra iglesia.
 * Se le registra a mano para que el sistema lo reconozca como prerrequisito.
 *
 * Por qué vive acá y no en Participación (movido el 2026-08-24): Participación
 * es lo que la persona hizo; esto es una intervención administrativa sobre su
 * expediente, al lado de "Invitar a un estudio" y "Crear excepción".
 *
 * Se gatea a sí mismo con la MISMA lista que el API (admin + coordinador de
 * estudios). Antes el botón se mostraba a cualquier sesión y al enviarlo daba
 * 403 con un error genérico.
 */
export function AddExternalStudyButton({ memberId, onAdded }: {
  memberId: string
  /** Para refrescar el expediente; opcional porque no todo contexto lo tiene. */
  onAdded?: () => void
}) {
  const { hasRole, loaded } = useAuth()
  const [open, setOpen] = useState(false)
  const toast = useToast()
  if (!loaded || !hasRole(...EXTERNAL_STUDY_ROLES)) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
      >
        <GraduationCap size={14} aria-hidden="true" />
        Agregar estudio
      </button>
      {open && (
        <AddStudyModal
          memberId={memberId}
          onClose={() => setOpen(false)}
          onAdded={() => { setOpen(false); toast('Estudio agregado', 'success'); onAdded?.() }}
        />
      )}
    </>
  )
}

function AddStudyModal({ memberId, onClose, onAdded }: {
  memberId: string
  onClose: () => void
  onAdded: () => void
}) {
  const { studyTypes } = useStudies('plans')
  const [code, setCode] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('completed')
  // Llevado POR FUERA de Theos. No se deduce de "no tiene grupo": hay 25.610
  // matrículas sin grupo del import histórico, así que esa señal no distingue
  // nada. Se marca explícito o el dato queda indistinguible para siempre.
  const [esExterno, setEsExterno] = useState(false)
  const [fuente, setFuente] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Lo que la persona YA tiene registrado, para avisar antes de duplicar.
  // Sin esto, el 2026-08-25 se registró el mismo SCJ dos veces (con orígenes
  // distintos) sin que nada lo advirtiera. Se avisa, NO se bloquea: repetir un
  // estudio es legítimo y quien registra tiene que poder decidirlo.
  type Ya = { code: string; status: string; date: string | null; group: string | null; es_externo: boolean }
  const [yaTiene, setYaTiene] = useState<Ya[]>([])
  useEffect(() => {
    let vivo = true
    fetch(`/api/members/${memberId}/studies`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (vivo && d?.items) setYaTiene(d.items as Ya[]) })
      .catch(() => {}) // el aviso es una ayuda: si falla, el formulario sigue
    return () => { vivo = false }
  }, [memberId])

  const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

  async function handleSave() {
    if (!code) { setErr('Seleccioná un estudio'); return }
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/members/${memberId}/studies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_code: code, date: date || null, status,
          es_externo: esExterno,
          fuente_externa: esExterno ? (fuente.trim() || null) : null,
        }),
      })
      if (!res.ok) {
        // El mensaje del servidor dice QUÉ pasó (sin permiso, plan inexistente,
        // fuente sin marcar externo). El genérico de antes escondía todo eso.
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `No se pudo agregar el estudio (${res.status})`)
      }
      onAdded()
    } catch (e) {
      console.error(e)
      setErr(e instanceof Error ? e.message : 'No se pudo agregar el estudio. Intentá de nuevo.')
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} titleId="agregar-estudio-title" width={384}>
      <div className="p-6 space-y-4">
        <p id="agregar-estudio-title" className="text-base font-bold text-navy font-display">Agregar estudio</p>
        <p className="text-[13px] text-navy-light/80 font-body -mt-2">
          Para estudios que la persona llevó sin un grupo en el sistema.
        </p>

        <div className="space-y-1">
          <label htmlFor="hist-estudio" className="text-[13px] text-navy-light/80 font-display">Estudio *</label>
          <select id="hist-estudio" aria-required="true" className={inputCls} value={code} onChange={e => setCode(e.target.value)}>
            <option value="">Seleccionar…</option>
            {studyTypes.map(s => <option key={s.id} value={s.code}>{s.code} — {s.name}</option>)}
          </select>
        </div>

        {(() => {
          const repes = yaTiene.filter(y => y.code === code)
          if (!repes.length) return null
          const ESTADO: Record<string, string> = {
            completed: 'aprobado', reprobado: 'reprobado', enrolled: 'en curso', dropped: 'retirado',
          }
          return (
            <div className="flex items-start gap-2.5 rounded-xl border border-coral/30 bg-coral/[0.06] px-3 py-2.5">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-coral-deep" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-[13px] font-medium text-navy font-body">
                  Esta persona ya tiene {code} registrado
                </p>
                {repes.map((r, i) => (
                  <p key={i} className="text-[13px] text-navy-light/80 font-body">
                    {ESTADO[r.status] ?? r.status}
                    {r.date ? ` · ${r.date}` : ''}
                    {r.group ? ` · ${r.group}` : ' · sin grupo'}
                    {r.es_externo ? ' · externo' : ''}
                  </p>
                ))}
                <p className="text-[13px] text-navy-light/80 font-body">
                  Si de verdad lo llevó otra vez, seguí. Si no, cancelá para no duplicarlo.
                </p>
              </div>
            </div>
          )
        })()}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="hist-fecha" className="text-[13px] text-navy-light/80 font-display">Fecha</label>
            <input id="hist-fecha" type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="hist-estado" className="text-[13px] text-navy-light/80 font-display">Estado</label>
            <select id="hist-estado" className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="completed">Aprobado</option>
              <option value="dropped">Reprobó</option>
              <option value="enrolled">En curso</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl bg-surface-low p-3 space-y-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 accent-[var(--color-coral)]"
              checked={esExterno}
              onChange={e => { setEsExterno(e.target.checked); if (!e.target.checked) setFuente('') }}
            />
            <span>
              <span className="block text-sm text-navy font-body">Lo llevó fuera de Theos</span>
              <span className="block text-[13px] text-navy-light/80 font-body">
                Otra iglesia, otro ministerio, un instituto.
              </span>
            </span>
          </label>
          {esExterno && (
            <div className="space-y-1 pl-6">
              <label htmlFor="hist-fuente" className="text-[13px] text-navy-light/80 font-display">
                ¿Dónde lo llevó?
              </label>
              <input
                id="hist-fuente"
                className={inputCls}
                placeholder="Ej. Iglesia Vida Nueva, Cartago"
                maxLength={200}
                value={fuente}
                onChange={e => setFuente(e.target.value)}
              />
            </div>
          )}
        </div>

        {err && <p className="text-sm text-coral font-body">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body">
            {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

