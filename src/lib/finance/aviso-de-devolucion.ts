/**
 * Qué se le dice a finanzas sobre CÓMO va a salir una devolución.
 *
 * EL BUG (2026-09-16). El aviso del modal era binario: `isSinpe ? "fue por
 * SINPE" : "fue por tarjeta y se procesará automáticamente a través de la
 * pasarela de pago"`. O sea que TODO lo que no fuera SINPE se rotulaba como
 * tarjeta — y el método real de casi todos los pagos del sistema es
 * 'comprobante' (240 de 243 el día que se encontró esto; 'card' no lo usa
 * nadie porque la pasarela ni siquiera está activa).
 *
 * Lo apareció Irene Arias Vargas: su pago de ₡15.000 fue por comprobante y el
 * modal decía tarjeta.
 *
 * Y lo del nombre era lo de menos. La frase le PROMETÍA a finanzas que la plata
 * salía sola por la pasarela, cuando la propia pantalla de devoluciones dice
 * que eso es fase futura y que hoy todo se procesa a mano. Alguien podía cerrar
 * el modal creyendo que la devolución ya estaba encaminada y que la plata nunca
 * saliera.
 *
 * Por eso el aviso ahora dice siempre quién tiene que mover la plata, y el
 * método real solo cambia el detalle.
 */
import type { PaymentMethod } from '@/types/finance'

export type Tono = 'manual' | 'automatico'

export type AvisoDeDevolucion = {
  texto: string
  /** 'manual' pinta ámbar (alguien tiene que hacer algo). Hoy es siempre. */
  tono: Tono
}

const COMO_ENTRO: Record<PaymentMethod, string> = {
  comprobante: 'Este pago entró por transferencia con comprobante.',
  sinpe:       'Este pago entró por SINPE.',
  cash:        'Este pago se registró como efectivo.',
  card:        'Este pago entró por tarjeta.',
  scholarship: 'Este pago quedó cubierto por una beca, así que no entró plata.',
}

export function avisoDeDevolucion(method: PaymentMethod | null | undefined): AvisoDeDevolucion {
  // Una beca no se devuelve: no hubo plata. Es el único caso que cambia el
  // fondo del mensaje y no solo el detalle.
  if (method === 'scholarship') {
    return {
      tono: 'manual',
      texto: `${COMO_ENTRO.scholarship} Revisá con finanzas si corresponde devolver algo antes de seguir.`,
    }
  }
  const entro = method ? COMO_ENTRO[method] : 'No quedó registrado cómo entró este pago.'
  // NUNCA se promete procesamiento automático: la pasarela no está activa y las
  // devoluciones por SINPE directo tampoco. Hoy TODAS se procesan a mano.
  return {
    tono: 'manual',
    texto: `${entro} La devolución NO es automática: queda como solicitud y el equipo de finanzas coordina la transferencia a mano.`,
  }
}
