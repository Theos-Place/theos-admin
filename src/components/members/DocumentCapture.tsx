'use client'

import { useState } from 'react'
import { IdCard, Loader2 } from 'lucide-react'
import {
  DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL, isValidDocument, documentFormatMessage,
  type DocumentType,
} from '@/lib/cedula'

/**
 * FIN-2 · Campos de captura de documento (tipo + número) con guardado.
 *
 * Un solo componente para los tres puntos donde se pide el documento (aviso al
 * entrar, matrícula y check-in): antes esto vivía duplicado en el
 * prematrimonial.
 *
 * Guarda con PATCH /api/members/[id] — salvo dentro de un evento, donde va por
 * /api/events/[eventId]/members/[memberId]. La diferencia es de permisos: el
 * PATCH general exige roles de padrón, y encargado_eventos no los tiene, así que
 * en la fila el guardado devolvía 403 y el documento nunca se guardaba
 * (bug 2026-09-09). Los dos normalizan, validan por tipo y dedupean con 409.
 */
export function DocumentCapture({
  memberId,
  onSaved,
  submitLabel = 'Guardar documento',
  autoFocus = false,
  idPrefix = 'doc',
  eventId,
}: {
  memberId: string
  onSaved: () => void
  submitLabel?: string
  autoFocus?: boolean
  /** Prefijo de los ids: permite más de una instancia en la misma pantalla. */
  idPrefix?: string
  /** Dentro del check-in de un evento: guarda por el endpoint acotado, que sí
   *  le permite al equipo de bienvenida corregir el documento. */
  eventId?: string
}) {
  const [docType, setDocType] = useState<DocumentType>('cedula')
  const [docNumber, setDocNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (saving) return
    if (!isValidDocument(docType, docNumber)) {
      setError(documentFormatMessage(docType))
      return
    }
    setError('')
    setSaving(true)
    try {
      const url = eventId
        ? `/api/events/${eventId}/members/${memberId}`
        : `/api/members/${memberId}`
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_type: docType, cedula: docNumber.trim() }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'No se pudo guardar el documento.')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el documento.')
    } finally {
      setSaving(false)
    }
  }

  const typeId = `${idPrefix}-type`
  const numberId = `${idPrefix}-number`

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={typeId} className="mb-1.5 block text-[13px] font-medium text-navy-light/80 font-body">
          Tipo de documento
        </label>
        <select
          id={typeId}
          value={docType}
          onChange={e => { setDocType(e.target.value as DocumentType); setError('') }}
          className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-navy/30 font-body"
        >
          {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{DOCUMENT_TYPE_LABEL[t]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={numberId} className="mb-1.5 block text-[13px] font-medium text-navy-light/80 font-body">
          Número de documento
        </label>
        <input
          id={numberId}
          value={docNumber}
          autoFocus={autoFocus}
          onChange={e => { setDocNumber(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter' && docNumber.trim()) save() }}
          className="w-full rounded-xl border border-navy/15 px-3 py-2.5 text-sm text-navy outline-none focus:border-navy/30 font-body"
        />
      </div>
      {error && <p className="text-[13px] text-coral-deep font-body" role="alert">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving || !docNumber.trim()}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-coral px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-coral-deep disabled:opacity-50 font-body"
      >
        {saving
          ? <><Loader2 size={14} className="animate-spin" aria-hidden /> Guardando…</>
          : <><IdCard size={14} aria-hidden /> {submitLabel}</>}
      </button>
    </div>
  )
}
