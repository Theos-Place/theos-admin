/**
 * La misma referencia SINPE, cargada dos veces.
 *
 * QUÉ PASÓ (2026-09-10). Adriana Jiménez y Raquel Badilla transfirieron
 * ₡5.000 una sola vez cada una, pero el mismo comprobante quedó cargado dos
 * veces —una por cada grupo al que las movieron— y el sistema decía que habían
 * pagado ₡10.000. Nadie lo notó hasta que alguien fue a cuadrar a mano.
 *
 * POR QUÉ SE COLÓ. `payments.reference_code` tiene índice pero no es único, y
 * desde que el comprobante se acepta al subirlo casi ningún pago pasa por
 * revisión humana: nacen aprobados. No había ningún momento en que alguien
 * mirara.
 *
 * POR QUÉ NO ALCANZA UN UNIQUE. Una familia paga los tres cursos con UNA sola
 * transferencia, y esos tres pagos comparten referencia legítimamente (caso
 * real: Diana Tseng, Lin Ta Hsiang y Roy Muñoz, ₡15.000 en un solo SINPE). Un
 * UNIQUE a secas rompería eso.
 *
 * LA SEÑAL QUE SÍ SEPARA los dos casos es DE QUIÉN es cada pago: la misma
 * referencia para la MISMA persona es el mismo dinero contado dos veces; para
 * personas distintas es una familia pagando junta.
 */
export type PagoConReferencia = {
  id: string
  member_id: string | null
  amount: number
  status: string
  review_status: string | null
  /** Para el mensaje: de qué es el pago. */
  descripcion?: string | null
  /** ISO. Para el mensaje. */
  creado?: string | null
}

export type VerdictoReferencia =
  | { nivel: 'ninguno' }
  | { nivel: 'bloqueo'; mensaje: string; pagoExistente: string }
  | { nivel: 'aviso'; mensaje: string; pagos: string[] }

const VIVO = (p: PagoConReferencia) =>
  (p.status === 'paid' || p.status === 'pending') && p.review_status !== 'rechazado'

const plata = (n: number) =>
  `₡${Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

function fecha(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return ` del ${d.toLocaleDateString('es-CR', { day: 'numeric', month: 'long', timeZone: 'America/Costa_Rica' })}`
}

/**
 * @param nuevo   el pago que se está por crear.
 * @param existentes  los pagos que YA tienen esa misma referencia.
 */
export function revisarReferencia(
  nuevo: { member_id: string | null; amount: number },
  existentes: readonly PagoConReferencia[],
): VerdictoReferencia {
  const vivos = existentes.filter(VIVO)
  if (vivos.length === 0) return { nivel: 'ninguno' }

  const mismaPersona = vivos.filter(p => p.member_id && p.member_id === nuevo.member_id)
  if (mismaPersona.length > 0) {
    const p = mismaPersona[0]
    return {
      nivel: 'bloqueo',
      pagoExistente: p.id,
      mensaje: `Ese comprobante ya está registrado: hay un pago de ${plata(p.amount)}${fecha(p.creado)}`
        + `${p.descripcion ? ` por «${p.descripcion}»` : ''} con la misma referencia. `
        + 'Si de verdad hizo otra transferencia, usá el número de referencia de esa otra.',
    }
  }

  // Otra persona con la misma referencia: pasa cuando una familia paga junta.
  // No se bloquea, pero queda dicho.
  return {
    nivel: 'aviso',
    pagos: vivos.map(p => p.id),
    mensaje: vivos.length === 1
      ? 'Ese número de referencia ya lo usó otra persona. Si están pagando juntos en una sola transferencia, está bien.'
      : `Ese número de referencia ya lo usaron otras ${vivos.length} personas. Si están pagando juntos en una sola transferencia, está bien.`,
  }
}

/** ¿Vale la pena siquiera consultar? Sin referencia no hay nada que comparar. */
export function tieneReferenciaComparable(ref: string | null | undefined): ref is string {
  return typeof ref === 'string' && ref.trim().length >= 6
}
