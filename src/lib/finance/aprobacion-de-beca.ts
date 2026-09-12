/**
 * Qué hace falta para APROBAR una solicitud de beca.
 *
 * El bug que lo motiva (2026-09-11): una solicitud de beca se podía marcar
 * "resuelta" desde el tablero genérico de solicitudes de finanzas. Ese botón
 * solo cambia el estado y guarda una nota — no crea la beca, no manda el correo
 * y no deja notificación. Seis personas quedaron con su solicitud en "resuelta"
 * y un mensaje de aprobación escrito a mano que nunca leyeron; tres de ellas se
 * matricularon después y pagaron el estudio completo.
 *
 * La causa de fondo es que "resolver" y "aprobar una beca" no son lo mismo:
 * aprobar exige decir CUÁNTO es el descuento, y el tablero genérico no tiene
 * dónde preguntarlo. Esta regla es el contrato que el endpoint exige antes de
 * dejar pasar un 'resolve' sobre una solicitud de beca.
 */
export type TipoDescuento = 'percentage' | 'fixed'
export type TipoAprobacion = 'total' | 'parcial'

export type DatosDeAprobacion = {
  discount_type: TipoDescuento
  discount_value: number
  approval_type: TipoAprobacion
}

export type Validacion =
  | { ok: true; datos: DatosDeAprobacion }
  | { ok: false; error: string }

/** Tipos de solicitud que NO se pueden cerrar con el "Resolver" genérico. */
export const TIPOS_CON_APROBACION_PROPIA = ['scholarship'] as const

export function necesitaAprobacionPropia(requestType: string | null | undefined): boolean {
  return (TIPOS_CON_APROBACION_PROPIA as readonly string[]).includes(String(requestType ?? ''))
}

/**
 * Valida lo que manda quien aprueba.
 *
 * El mensaje de error es el que ve la persona de finanzas, así que dice qué
 * falta y no "datos inválidos": el error viejo era que el sistema la dejaba
 * seguir sin nada.
 */
export function validarAprobacion(cuerpo: unknown): Validacion {
  const b = (cuerpo ?? {}) as Record<string, unknown>
  const tipo = b.discount_type
  if (tipo !== 'percentage' && tipo !== 'fixed') {
    return { ok: false, error: 'Falta decir si la beca es un porcentaje o un monto fijo.' }
  }
  const valor = Number(b.discount_value)
  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false, error: 'El descuento de la beca tiene que ser mayor a cero.' }
  }
  if (tipo === 'percentage' && valor > 100) {
    return { ok: false, error: 'Un descuento en porcentaje no puede pasar de 100.' }
  }
  const aprobacion = b.approval_type
  if (aprobacion !== 'total' && aprobacion !== 'parcial') {
    return { ok: false, error: 'Falta marcar si la beca cubre el total o solo una parte.' }
  }
  return { ok: true, datos: { discount_type: tipo, discount_value: valor, approval_type: aprobacion } }
}

/**
 * Cómo se lee el descuento. Se usa en el correo y en la pantalla, para que
 * digan lo mismo.
 *
 * Los miles se separan a mano y no con Intl: el ICU de Node usa un espacio fino
 * para es-CR y en un correo queda "₡15 000", que no es como se escribe acá.
 * Mismo criterio que el módulo de transferencias de estudio.
 */
export function textoDelDescuento(d: DatosDeAprobacion, moneda = 'CRC'): string {
  if (d.discount_type === 'percentage') return `${d.discount_value}%`
  const n = Math.round(d.discount_value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${moneda === 'USD' ? '$' : '₡'}${n}`
}

/**
 * ¿El tipo de aprobación concuerda con el descuento?
 *
 * Un 100% marcado como "parcial", o un 40% marcado como "total", produce un
 * correo que se contradice: el de parcial le dice a la persona cuánto le queda
 * por pagar. No se bloquea —hay casos raros, como un fijo que cubre justo el
 * costo— pero se avisa.
 */
export function avisoDeIncoherencia(d: DatosDeAprobacion): string | null {
  if (d.discount_type !== 'percentage') return null
  if (d.discount_value === 100 && d.approval_type === 'parcial') {
    return 'Marcaste "parcial" pero el descuento es del 100%: a la persona le va a llegar un correo diciéndole cuánto debe, y no debe nada.'
  }
  if (d.discount_value < 100 && d.approval_type === 'total') {
    return `Marcaste "total" pero el descuento es del ${d.discount_value}%: el correo no le va a decir cuánto le queda por pagar.`
  }
  return null
}
