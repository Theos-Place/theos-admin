'use client'

/**
 * FIN-11 fase D · Informe de viaje (ANX-04).
 *
 * Cuatro campos y la evidencia. Se guarda incompleto a propósito: el informe
 * se escribe de a poco y perder lo ya escrito por exigir el resto es la forma
 * segura de que nadie lo escriba.
 *
 * NO BLOQUEA la liquidación. La plata y el reporte son dos trámites
 * distintos.
 */
import { useState } from 'react'
import { Loader2, Paperclip, Trash2 } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { formatDate } from '@/lib/format'
import { CAMPOS_DEL_INFORME, revisarInforme, type Informe } from '@/lib/travel/informe'

const etiqueta = 'text-[11px] tracking-widest uppercase text-navy-light/80 font-display'
const campo = 'w-full rounded-xl border border-navy/15 px-3 py-2 text-[13px] text-navy font-body focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral'

export function InformeDeViaje({ viajeId, editable, inicial, archivos, enviadoAt, onCambio }: {
  viajeId: string
  editable: boolean
  inicial: Informe
  archivos: Array<{ id: string; path: string; nombre: string }>
  enviadoAt: string | null
  onCambio: () => void
}) {
  const [v, setV] = useState<Informe>(inicial)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const problemas = revisarInforme(v)
  const vacio = CAMPOS_DEL_INFORME.every(c => !(v[c.campo] ?? '').trim())

  // Nada escrito y nadie que lo pueda escribir: la sección sobra.
  if (!editable && vacio && archivos.length === 0) return null

  async function guardar() {
    setBusy(true)
    try {
      const res = await fetch(`/api/travel-requests/${viajeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'informe', ...v }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'No se pudo guardar.')
      toast(d?.completo ? 'Informe entregado.' : 'Informe guardado; todavía le falta.', 'success')
      onCambio()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar.', 'error')
    } finally { setBusy(false) }
  }

  async function adjuntar(file: File) {
    const fd = new FormData()
    fd.append('file', file)
    const up = await fetch(`/api/travel-requests/${viajeId}/receipts`, { method: 'POST', body: fd })
    const d = await up.json().catch(() => null)
    if (!up.ok) { toast(d?.error || 'No se pudo subir el archivo.', 'error'); return }
    const guardarRef = await fetch(`/api/travel-requests/${viajeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'informe_archivo', path: d.receipt_path, nombre: file.name }),
    })
    if (!guardarRef.ok) { toast('No se pudo guardar la evidencia.', 'error'); return }
    toast('Evidencia adjunta.', 'success')
    onCambio()
  }

  async function quitar(archivoId: string) {
    const res = await fetch(`/api/travel-requests/${viajeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'quitar_informe_archivo', archivo_id: archivoId }),
    })
    if (!res.ok) { toast('No se pudo quitar.', 'error'); return }
    onCambio()
  }

  return (
    <section className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-4">
      <div>
        <h2 className="text-[13px] font-bold text-navy font-display">Informe del viaje</h2>
        <p className="text-[13px] text-navy-light/80 font-body">
          {enviadoAt
            ? `Entregado el ${formatDate(enviadoAt)}.`
            : 'No frena la liquidación, pero el expediente no queda completo sin él.'}
        </p>
      </div>

      {editable ? (
        <>
          {CAMPOS_DEL_INFORME.map(c => (
            <div key={c.campo} className="space-y-1.5">
              <label htmlFor={`inf-${c.campo}`} className={etiqueta}>
                {c.etiqueta}{c.obligatorio ? '' : ' (opcional)'}
              </label>
              <textarea id={`inf-${c.campo}`} rows={3} className={campo}
                placeholder={c.ayuda}
                value={v[c.campo] ?? ''}
                onChange={e => setV(p => ({ ...p, [c.campo]: e.target.value }))} />
            </div>
          ))}
          {problemas.length > 0 && (
            <p className="text-[13px] text-navy-light/80 font-body">
              Falta: {problemas.map(p => p.mensaje).join(' ')} Se puede guardar igual y terminarlo después.
            </p>
          )}
        </>
      ) : (
        CAMPOS_DEL_INFORME.filter(c => (v[c.campo] ?? '').trim()).map(c => (
          <div key={c.campo}>
            <p className={etiqueta}>{c.etiqueta}</p>
            <p className="text-[13px] text-navy font-body whitespace-pre-wrap">{v[c.campo]}</p>
          </div>
        ))
      )}

      <div className="space-y-2 border-t border-[var(--outline-variant)] pt-3">
        <p className={etiqueta}>Evidencia</p>
        {archivos.length === 0 ? (
          <p className="text-[13px] text-navy-light/80 font-body">Sin archivos.</p>
        ) : (
          <ul className="space-y-1">
            {archivos.map(a => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] text-navy font-body">{a.nombre}</span>
                {editable && (
                  <button type="button" aria-label={`Quitar ${a.nombre}`} onClick={() => quitar(a.id)}
                    className="shrink-0 rounded-full p-1.5 text-navy-light/80 hover:text-coral-deep transition-colors">
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-navy-light hover:text-coral-deep transition-colors font-body">
            <Paperclip size={14} aria-hidden="true" /> Adjuntar evidencia
            <input type="file" accept="image/*,application/pdf" className="sr-only"
              aria-label="Evidencia del informe de viaje"
              onChange={e => { const f = e.target.files?.[0]; if (f) adjuntar(f) }} />
          </label>
        )}
      </div>

      {editable && (
        <div className="flex justify-end">
          <Button type="button" variante="secundario" tamano="sm" onClick={guardar} disabled={busy}>
            {busy ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> …</> : 'Guardar informe'}
          </Button>
        </div>
      )}
    </section>
  )
}
