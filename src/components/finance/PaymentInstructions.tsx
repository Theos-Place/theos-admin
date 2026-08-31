'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import {
  SINPE_TELEFONO, CUENTA_BAC, detalleSugerido,
} from '@/lib/finance/payment-instructions'

/** Botón de copiar de un dato suelto. Existe porque el IBAN y la cuenta se
 *  transcriben a mano en la app del banco y un dígito mal es un pago perdido. */
function Copiable({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(valor).then(() => {
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1800)
        }).catch(() => {})
      }}
      aria-label={copiado ? `${etiqueta} copiado` : `Copiar ${etiqueta}`}
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-navy-light/80 hover:text-navy hover:bg-navy/5 transition-colors"
    >
      {copiado
        ? <Check size={13} className="text-teal-deep" aria-hidden />
        : <Copy size={13} aria-hidden />}
    </button>
  )
}

/**
 * Dónde pagar y qué escribir en el detalle.
 *
 * Se muestra en TODA pantalla que le pide plata a alguien. Los datos salen de
 * `@/lib/finance/payment-instructions`, no escritos acá: son los mismos que van
 * en los correos, y tenerlos en dos lados es tenerlos distintos.
 *
 * `concepto` y `nombre` arman el detalle ya listo para copiar; sin ellos se
 * muestra la instrucción genérica, que igual hay que dar.
 */
export function PaymentInstructions({ concepto, nombre, className = '' }: {
  /** Nombre del curso o evento. */
  concepto?: string | null
  /** Nombre de la persona INSCRITA — no siempre es quien paga. */
  nombre?: string | null
  className?: string
}) {
  const detalle = detalleSugerido(concepto, nombre)
  return (
    <div className={`rounded-xl bg-surface-low border border-outline px-4 py-3.5 ${className}`}>
      <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display mb-2.5">
        Cómo pagar
      </p>

      <dl className="space-y-2 text-[13px] font-body">
        <div className="flex items-baseline gap-2">
          <dt className="text-navy-light/80 shrink-0">SINPE Móvil</dt>
          <dd className="text-navy font-medium tabular-nums">{SINPE_TELEFONO}</dd>
          <Copiable valor={SINPE_TELEFONO.replace(/\s/g, '')} etiqueta="número de SINPE" />
        </div>

        <div className="pt-1.5 border-t border-outline/60">
          <p className="text-navy-light/80 mb-1">
            Cuenta {CUENTA_BAC.banco} en {CUENTA_BAC.moneda}
          </p>
          <div className="flex items-baseline gap-2">
            <dt className="text-navy-light/80 shrink-0">Número</dt>
            <dd className="text-navy font-medium tabular-nums">{CUENTA_BAC.numero}</dd>
            <Copiable valor={CUENTA_BAC.numero} etiqueta="número de cuenta" />
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-navy-light/80 shrink-0">IBAN</dt>
            <dd className="text-navy font-medium tabular-nums break-all">{CUENTA_BAC.iban}</dd>
            <Copiable valor={CUENTA_BAC.iban} etiqueta="IBAN" />
          </div>
        </div>
      </dl>

      <div className="mt-3 pt-3 border-t border-outline/60">
        {detalle ? (
          <>
            <p className="text-[13px] text-navy font-body">
              Poné esto en el <strong>detalle</strong> de la transferencia:
            </p>
            <p className="mt-1.5 flex items-center gap-1.5">
              <span className="rounded-lg bg-white border border-outline px-2.5 py-1.5 text-[13px] text-navy font-body break-all">
                {detalle}
              </span>
              <Copiable valor={detalle} etiqueta="detalle" />
            </p>
          </>
        ) : (
          <p className="text-[13px] text-navy font-body">
            En el <strong>detalle</strong> de la transferencia poné el nombre del curso o
            evento y el nombre de la persona inscrita.
          </p>
        )}
        <p className="mt-1.5 text-[13px] text-navy-light/80 font-body">
          Sin ese detalle no podemos saber de quién es el pago.
        </p>
      </div>
    </div>
  )
}
