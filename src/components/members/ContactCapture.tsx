'use client'

import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'

/**
 * CHK-5 · Capturar en la puerta el correo (y de paso el teléfono) de un adulto
 * que no lo tiene.
 *
 * Hermano de `DocumentCapture` y con la misma forma, porque el momento es el
 * mismo: la persona está enfrente, se le pide el dato, y el check-in NO se
 * frena por esto.
 *
 * Guarda por un endpoint propio y angosto —no por el PATCH general de
 * miembros— porque los roles de la puerta no tienen edición de miembros y no se
 * les va a dar. Es la misma lección del bug del 2026-09-09 con el documento:
 * pedirle un dato a alguien que después no lo puede guardar es peor que no
 * pedírselo.
 */
export function ContactCapture({
  memberId,
  eventId,
  pedir,
  onSaved,
  idPrefix = 'contacto',
}: {
  memberId: string
  eventId: string
  /** Qué campos están vacíos. Lo decide el servidor (`pedirContacto`). */
  pedir: { email: boolean; phone: boolean }
  onSaved: (guardado: { email: boolean; phone: boolean }) => void
  idPrefix?: string
}) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const hayAlgo = (pedir.email && email.trim()) || (pedir.phone && phone.trim())

  async function save() {
    if (saving || !hayAlgo) return
    if (pedir.email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Ese correo no tiene un formato válido.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const body: { member_id: string; email?: string; phone?: string } = { member_id: memberId }
      if (pedir.email && email.trim()) body.email = email.trim()
      if (pedir.phone && phone.trim()) body.phone = phone.trim()
      const res = await fetch(`/api/events/${eventId}/checkins/contact-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'No se pudo guardar.')
      onSaved({ email: !!body.email, phone: !!body.phone })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {pedir.email && (
        <div>
          <label htmlFor={`${idPrefix}-email`} className="mb-1.5 block text-[13px] font-medium text-navy-light/80 font-body">
            Correo electrónico
          </label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            placeholder="persona@ejemplo.com"
            onChange={e => { setEmail(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter' && hayAlgo) save() }}
            className="w-full rounded-xl border border-navy/15 px-3 py-2.5 text-sm text-navy outline-none focus:border-navy/30 font-body"
          />
        </div>
      )}
      {pedir.phone && (
        <div>
          <label htmlFor={`${idPrefix}-phone`} className="mb-1.5 block text-[13px] font-medium text-navy-light/80 font-body">
            Teléfono
          </label>
          <input
            id={`${idPrefix}-phone`}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            placeholder="8888 8888"
            onChange={e => { setPhone(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter' && hayAlgo) save() }}
            className="w-full rounded-xl border border-navy/15 px-3 py-2.5 text-sm text-navy outline-none focus:border-navy/30 font-body"
          />
        </div>
      )}
      {error && <p className="text-[13px] text-coral-deep font-body" role="alert">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving || !hayAlgo}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-coral shadow-[var(--shadow-pulse)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-coral-deep disabled:opacity-50 font-body"
      >
        {saving
          ? <><Loader2 size={14} className="animate-spin" aria-hidden /> Guardando…</>
          : <><Mail size={14} aria-hidden /> Guardar</>}
      </button>
    </div>
  )
}
