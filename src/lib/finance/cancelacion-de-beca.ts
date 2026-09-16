/**
 * Cancelar una beca que todavía no se usó.
 *
 * El caso que lo motiva (2026-09-16): a María José Ruiz se le emitió una beca
 * del 50% por error —lo que pedía era TRASLADAR la del 100% que ya tenía— y no
 * había forma de cerrarla desde la pantalla. Hubo que hacerlo por script, y el
 * motivo terminó metido a mano en `notes` porque no existía un campo.
 *
 * Dejar una beca de más viva no es cosmético: `findApplicableScholarship`
 * filtra por member+plan+active y hace `.limit(1)` SIN order by, así que con dos
 * becas activas del mismo plan cuál se aplica lo decide el planner. En ese caso
 * concreto podía agarrar la del 50% y cobrarle ₡10.000 que no debía.
 *
 * El estado 'revoked' ya existía; lo que faltaba era el botón, el motivo y el
 * nombre de quien la cancela.
 */

export type BecaParaCancelar = {
  kind: 'asignada' | 'generica'
  status: 'active' | 'used' | 'revoked'
  /** Redenciones registradas (cupones); una asignada usada ya viene en status. */
  used_count: number
}

export type MotivoBloqueoCancelacion =
  | 'ya_usada'      // alguien la aplicó: cancelarla reescribiría un cobro cerrado
  | 'ya_cancelada'  // no hay nada que hacer

export const MENSAJE_BLOQUEO_CANCELACION: Record<MotivoBloqueoCancelacion, string> = {
  ya_usada: 'Esta beca ya se usó, así que no se puede cancelar. Si hay que revertir el cobro, eso se hace desde el pago.',
  ya_cancelada: 'Esta beca ya está cancelada.',
}

/** Largo mínimo del motivo. No es burocracia: un "error" de cinco letras dentro
 *  de seis meses no le dice nada a nadie, que es exactamente el problema que
 *  este campo viene a resolver. */
export const MOTIVO_MINIMO = 10

export function puedeCancelarse(
  b: BecaParaCancelar,
): { ok: true } | { ok: false; error: MotivoBloqueoCancelacion } {
  if (b.status === 'revoked') return { ok: false, error: 'ya_cancelada' }
  if (b.status === 'used' || b.used_count > 0) return { ok: false, error: 'ya_usada' }
  return { ok: true }
}

/** El motivo tal como se guarda: sin espacios sobrantes. `null` si no sirve. */
export function motivoNormalizado(texto: unknown): string | null {
  if (typeof texto !== 'string') return null
  const limpio = texto.trim().replace(/\s+/g, ' ')
  return limpio.length >= MOTIVO_MINIMO ? limpio : null
}

export const MENSAJE_MOTIVO_CORTO =
  `Contá por qué se cancela, con al menos ${MOTIVO_MINIMO} caracteres. Queda guardado con tu nombre.`

/**
 * La línea que se muestra en una beca ya cancelada.
 *
 * Sin el nombre, el motivo queda flotando y no se sabe a quién preguntarle.
 */
export function textoDeLaCancelacion(input: {
  quien: string | null
  cuando: string | null
  motivo: string | null
}): string | null {
  if (!input.motivo) return null
  const fecha = input.cuando ? formatearFecha(input.cuando) : null
  const firma = [input.quien, fecha].filter(Boolean).join(' · ')
  return firma ? `${input.motivo} (${firma})` : input.motivo
}

function formatearFecha(iso: string): string | null {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  // Fecha civil de Costa Rica (UTC-6 fijo), no la del servidor.
  return new Date(t).toLocaleDateString('es-CR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Costa_Rica',
  })
}
