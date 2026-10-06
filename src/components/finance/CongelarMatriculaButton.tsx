'use client'

/**
 * FIN-9 · «Congelar matrícula» — quitar la matrícula y guardarle la plata.
 *
 * VIVE EN LA FICHA DE LA PERSONA, en la fila de CADA estudio, porque
 * congelar es por MATRÍCULA y no por persona: alguien con dos estudios
 * puede congelar uno y seguir en el otro.
 *
 * ES MUY MANUAL A PROPÓSITO (Meli, 2026-09-29). Solo finanzas y dirección,
 * caso por caso y después de hablar con la persona. No hay autoservicio ni
 * se promociona: si «congelar» se vuelve un clic para cualquiera, deja de
 * ser la excepción que es y se come la matrícula normal.
 *
 * PRIMERO CONSULTA, DESPUÉS CONFIRMA. El crédito es por lo PAGADO y casi
 * nunca coincide con lo cobrado —alguien con un cobro de ₡10.000 que pagó
 * ₡5.000 recibe ₡5.000—, así que el monto se MUESTRA antes de decidir. Un
 * botón que congela a ciegas sería adivinar con la plata de otro.
 */

import { useState } from 'react'
import { Loader2, Snowflake } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { formatMoney } from '@/lib/format'
import { SALIDAS_DEL_CREDITO } from '@/lib/finance/credito-por-congelar'

type Contexto = {
  member_name: string
  estudio: string | null
  montoPagado: number
  currency: string
  motivoQueImpide: string | null
}

export function CongelarMatriculaButton({ enrollmentId, onCongelada }: {
  enrollmentId: string
  onCongelada?: () => void
}) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [ctx, setCtx] = useState<Contexto | null>(null)
  const [cargando, setCargando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function abrir() {
    setAbierto(true); setCargando(true); setCtx(null)
    try {
      const res = await fetch(`/api/finance/creditos?enrollment_id=${enrollmentId}`)
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'No se pudo consultar.')
      setCtx(d as Contexto)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo consultar.', 'error')
      setAbierto(false)
    } finally { setCargando(false) }
  }

  async function congelar() {
    if (enviando || motivo.trim().length < 10) return
    setEnviando(true)
    try {
      const res = await fetch('/api/finance/creditos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollment_id: enrollmentId, motivo: motivo.trim() }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'No se pudo congelar.')
      toast(
        `Matrícula congelada. Le quedan ${formatMoney(d.monto, ctx?.currency ?? 'CRC')} `
        + `guardados hasta el ${d.vence}.`,
        'success',
      )
      setAbierto(false); setMotivo('')
      onCongelada?.()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo congelar.', 'error')
    } finally { setEnviando(false) }
  }

  const puede = !!ctx && !ctx.motivoQueImpide
  const faltaMotivo = motivo.trim().length < 10

  return (
    <>
      <Button variante="secundario" tamano="sm" radio="pill" onClick={abrir}>
        <Snowflake size={13} aria-hidden="true" />
        Congelar
      </Button>

      {abierto && (
        <Modal onClose={() => !enviando && setAbierto(false)} titleId="congelar-title" width={480}>
          <div className="p-6 space-y-4">
            <h3 id="congelar-title" className="text-base font-bold text-navy font-display">
              Congelar la matrícula
            </h3>

            {cargando ? (
              <p className="text-[13px] text-navy-light/80 font-body inline-flex items-center gap-2 py-6">
                <Loader2 size={15} className="animate-spin" /> Viendo cuánto pagó…
              </p>
            ) : !ctx ? null : ctx.motivoQueImpide ? (
              <p className="rounded-xl bg-coral/10 px-3.5 py-2.5 text-[13px] text-coral-deep font-body">
                {ctx.motivoQueImpide}
              </p>
            ) : (
              <>
                {/* El monto, ANTES de decidir: es por lo PAGADO y casi nunca
                    coincide con lo cobrado. */}
                <div className="rounded-xl bg-surface-low p-3.5 space-y-1">
                  <p className="text-[13px] text-navy-light/80 font-body">
                    {ctx.member_name}{ctx.estudio ? ` · ${ctx.estudio}` : ''}
                  </p>
                  <p className="text-navy font-body">
                    Se le quita la matrícula y se le guardan{' '}
                    <strong>{formatMoney(ctx.montoPagado, ctx.currency)}</strong>, que es lo que
                    ya pagó.
                  </p>
                </div>

                {/* La escalera, para que quien congela sepa qué ofrecerle. */}
                <details className="rounded-xl border border-outline p-3">
                  <summary className="text-[13px] text-navy font-body cursor-pointer">
                    Qué se le puede ofrecer con ese crédito
                  </summary>
                  <ol className="mt-2 space-y-1.5 list-decimal list-inside">
                    {SALIDAS_DEL_CREDITO.map(s => (
                      <li key={s.clave} className="text-[13px] text-navy-light/80 font-body">
                        <strong className="text-navy">{s.titulo}</strong> — {s.que}
                      </li>
                    ))}
                  </ol>
                </details>

                <div className="space-y-1">
                  <label htmlFor="congelar-motivo" className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                    ¿Por qué se congela? <span className="text-coral">*</span>
                  </label>
                  <textarea
                    id="congelar-motivo"
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    rows={2}
                    placeholder="Ej: se va del país tres meses por trabajo, vuelve en enero"
                    className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body resize-none"
                  />
                  <p className="text-[13px] text-navy-light/80 font-body">
                    Queda con el crédito: en seis meses, «¿por qué tiene plata guardada?»
                    tiene que responderse sin preguntarle a nadie.
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-1">
              {puede && (
                <Button variante="navy" ancho="flex" onClick={congelar} disabled={enviando || faltaMotivo}>
                  {enviando ? <><Loader2 size={15} className="animate-spin" /> Congelando…</> : 'Congelar y guardar el dinero'}
                </Button>
              )}
              <Button variante="secundario" onClick={() => setAbierto(false)} disabled={enviando}>
                {puede ? 'Cancelar' : 'Cerrar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
