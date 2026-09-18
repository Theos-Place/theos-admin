'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { MemberCombobox, type MemberHit } from '@/components/shared/MemberCombobox'
import { CURRENCIES, currencySymbol, todayCR, amountStep } from '@/lib/format'
import { mensajeDeLaRespuesta } from '@/lib/api/mensaje-del-error'
import { cn } from '@/lib/utils'

/**
 * DON-2 · Registrar una donación a mano.
 *
 * El buscador de personas es el MISMO de siempre (MemberCombobox), que ya sabe
 * buscar por nombre y por cédula y no exige el módulo de miembros — el rol
 * finanzas no lo tiene.
 *
 * EL MONTO ES OPTATIVO a propósito: pasa que se sabe que alguien dio pero el
 * reporte del banco todavía no llegó. Vacío se guarda como "sin monto", NO como
 * cero: cero sumaría en los reportes y se leería como una donación de ₡0.
 */
export function AgregarDonacionModal({ onClose, onCreada }: {
  onClose: () => void
  onCreada: () => void
}) {
  const [persona, setPersona] = useState<MemberHit | null>(null)
  const [fecha, setFecha] = useState(todayCR())
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState<string>('CRC')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const campo = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
  const etiqueta = 'text-[13px] text-navy-light/80 font-body'

  async function guardar() {
    if (!persona || guardando) return
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch('/api/finance/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: persona.id,
          donation_date: fecha,
          // Vacío viaja como null, no como 0.
          amount: monto.trim() === '' ? null : monto.trim(),
          currency: moneda,
          note: nota.trim() || null,
        }),
      })
      if (!res.ok) throw new Error(await mensajeDeLaRespuesta(res, 'No se pudo registrar la donación.'))
      onCreada()
      onClose()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo registrar la donación.')
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={() => !guardando && onClose()} titleId="agregar-donacion" width={460}>
      <div className="p-6 space-y-4">
        <h3 id="agregar-donacion" className="text-lg font-bold text-navy font-display">Agregar donación</h3>

        <div className="space-y-1">
          <span className={etiqueta}>Persona</span>
          {persona ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-low px-3 py-2">
              <span className="text-sm text-navy font-body truncate">
                {persona.first_name} {persona.last_name}
                {persona.cedula && <span className="text-navy-light/80"> · {persona.cedula}</span>}
              </span>
              <button
                type="button" onClick={() => setPersona(null)}
                aria-label="Cambiar de persona"
                className="shrink-0 text-navy-light/80 hover:text-navy transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <MemberCombobox onSelect={setPersona} placeholder="Buscar por nombre o cédula…" autoFocus dropdown />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="don-fecha" className={etiqueta}>Fecha</label>
            {/* max = hoy: una donación futura es siempre un error de tecleo.
                El servidor lo valida igual. */}
            <input id="don-fecha" type="date" max={todayCR()} className={campo}
              value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="don-moneda" className={etiqueta}>Moneda</label>
            <select id="don-moneda" className={campo} value={moneda} onChange={e => setMoneda(e.target.value)}>
              {CURRENCIES.map(m => <option key={m} value={m}>{currencySymbol(m)} {m}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="don-monto" className={etiqueta}>Monto <span className="text-navy-light/80">(opcional)</span></label>
          <input id="don-monto" type="number" min="0" step={amountStep(moneda)} className={campo}
            placeholder="Dejalo vacío si todavía no se sabe"
            value={monto} onChange={e => setMonto(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label htmlFor="don-nota" className={etiqueta}>Nota <span className="text-navy-light/80">(opcional)</span></label>
          <input id="don-nota" type="text" maxLength={300} className={campo}
            placeholder="Ej.: Donación para Edificio — Campaña MyH"
            value={nota} onChange={e => setNota(e.target.value)} />
        </div>

        {error && (
          <p className="rounded-xl bg-coral/10 px-3 py-2 text-[13px] text-coral-deep font-body" role="alert">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={guardando}
            className="flex-1 rounded-full border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light/80 hover:bg-surface-low transition-colors disabled:opacity-50 font-body">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={!persona || guardando}
            className={cn('flex-1 rounded-full py-2.5 text-sm font-semibold text-white transition-colors font-body',
              !persona || guardando ? 'bg-coral/40' : 'bg-coral hover:bg-coral-deep')}>
            {guardando ? 'Guardando…' : 'Registrar donación'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
