/**
 * FIN-13 · Hasta dónde puede estirarse un arreglo de pago.
 *
 * DECIDIDO CON FINANZAS EL 2026-09-29. Antes un arreglo podía partirse hasta
 * en 24 tractos y vencer cuando fuera: nada ataba el último vencimiento a la
 * cosa que se estaba pagando. O sea que se podía pactar terminar de pagar un
 * campamento tres meses DESPUÉS del campamento, y el sistema lo aceptaba sin
 * decir nada.
 *
 * LAS DOS REGLAS, Y POR QUÉ SON DISTINTAS:
 *
 * · EVENTOS Y ACTIVIDADES — solo QUINCENAL y MÁXIMO 2 TRACTOS, y el último
 *   vencimiento tiene que caer ANTES de que arranque la actividad. El motivo
 *   es operativo: las actividades se anuncian con cerca de un mes de
 *   anticipación, así que en esa ventana caben dos quincenas y nada más.
 *   Cobrar después del evento no es un arreglo de pago, es una deuda.
 *
 * · ESTUDIOS — el arreglo se cierra dentro del PERÍODO DE MATRÍCULA, que es
 *   aproximadamente un mes, y no «mientras dure el estudio». Acá no se topan
 *   los tractos ni se obliga la quincena: el tope lo pone la fecha, que ya es
 *   suficientemente corta.
 *
 * SOBRE LA FECHA TOPE DE UN ESTUDIO. Lo correcto es `enrollment_end_date`.
 * Medido en producción el 2026-10-02: de 2 209 grupos solo 40 la tienen, PERO
 * los 12 grupos abiertos la tienen todos — que son justamente aquellos sobre
 * los que alguien haría un arreglo. Para los demás se cae a `starts_at`, que
 * es un tope más flojo pero real (desde EST-23 la matrícula cierra una semana
 * antes del inicio, así que nunca es más permisivo de lo razonable). Y 60
 * grupos no tienen ninguna de las dos: ahí no se puede acotar, y se dice —
 * inventar una fecha sería peor que no tener la regla.
 *
 * Módulo PURO: decide. Quien lee la base es la query y quien responde el
 * error es la ruta.
 */

import type { PlanFrequency } from '@/lib/finance/installments'

/** Solo QUINCENAL para actividades, y nunca más de dos tractos. */
export const MAX_TRACTOS_EVENTO = 2
export const FRECUENCIA_OBLIGADA_EVENTO: PlanFrequency = 'quincenal'

export type TipoDeObjeto = 'evento' | 'estudio'

export type ContextoDelArreglo = {
  tipo: TipoDeObjeto
  /**
   * La fecha tope, `YYYY-MM-DD` en día de Costa Rica:
   * · evento  → cuándo arranca la actividad
   * · estudio → cuándo cierra la matrícula (o el inicio, como respaldo)
   * `null` cuando no se pudo determinar.
   */
  limite: string | null
  /** De dónde salió `limite`, para poder explicarlo en el mensaje. */
  origenDelLimite?: 'inicio_actividad' | 'cierre_matricula' | 'inicio_estudio' | null
}

export type PropuestaDeArreglo = {
  installments: number
  frequency: PlanFrequency
  /** Los vencimientos ya calculados, en orden. */
  vencimientos: string[]
}

export type MotivoDeRechazo = {
  code: string
  /** Mensaje para la persona de finanzas que está creando el arreglo. */
  error: string
}

const fmt = (ymd: string): string => {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

/**
 * ¿Se puede crear este arreglo? Devuelve `null` si sí, o el motivo si no.
 *
 * Se devuelve UN motivo y no una lista: quien lo lee está llenando un
 * formulario y arregla una cosa a la vez. El orden va de lo más estructural
 * (la frecuencia, los tractos) a lo que depende de ellos (la fecha), porque
 * corregir los primeros cambia la última.
 */
export function motivoParaRechazarArreglo(
  propuesta: PropuestaDeArreglo,
  ctx: ContextoDelArreglo,
): MotivoDeRechazo | null {
  if (ctx.tipo === 'evento') {
    if (propuesta.frequency !== FRECUENCIA_OBLIGADA_EVENTO) {
      return {
        code: 'FRECUENCIA_NO_PERMITIDA',
        error: 'Los arreglos de actividades son solo quincenales: no hay tiempo para '
          + 'cuotas mensuales antes de que arranque.',
      }
    }
    if (propuesta.installments > MAX_TRACTOS_EVENTO) {
      return {
        code: 'DEMASIADOS_TRACTOS',
        error: `Un arreglo de actividad admite como máximo ${MAX_TRACTOS_EVENTO} tractos `
          + `(se pidieron ${propuesta.installments}).`,
      }
    }
  }

  const ultimo = ultimoVencimiento(propuesta.vencimientos)
  if (!ultimo || !ctx.limite) return null

  // El último tracto tiene que estar COBRADO antes de la fecha tope, así que
  // vencer el mismo día no sirve: la plata entraría el día del evento.
  if (ultimo >= ctx.limite) {
    return ctx.tipo === 'evento'
      ? {
        code: 'VENCE_DESPUES_DE_LA_ACTIVIDAD',
        error: `El último tracto vence el ${fmt(ultimo)} y la actividad arranca el `
          + `${fmt(ctx.limite)}. Todo el arreglo tiene que quedar cobrado antes.`,
      }
      : {
        code: 'VENCE_DESPUES_DE_LA_MATRICULA',
        error: `El último tracto vence el ${fmt(ultimo)} y la matrícula cierra el `
          + `${fmt(ctx.limite)}. El arreglo tiene que cerrarse dentro del período `
          + `de matrícula.`,
      }
  }
  return null
}

/** El vencimiento más tardío. No asume que vengan ordenados. */
export function ultimoVencimiento(vencimientos: string[]): string | null {
  const validos = vencimientos.filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v))
  if (validos.length === 0) return null
  return validos.reduce((a, b) => (a >= b ? a : b))
}

/**
 * La fecha tope de un estudio: el cierre de matrícula, y si no está, el
 * inicio. `null` cuando no hay ninguna de las dos y por lo tanto no hay regla
 * que aplicar.
 */
export function limiteDeEstudio(grupo: {
  enrollment_end_date?: string | null
  starts_at?: string | null
}): { limite: string | null; origenDelLimite: ContextoDelArreglo['origenDelLimite'] } {
  if (grupo.enrollment_end_date) {
    return { limite: grupo.enrollment_end_date, origenDelLimite: 'cierre_matricula' }
  }
  if (grupo.starts_at) {
    return { limite: grupo.starts_at, origenDelLimite: 'inicio_estudio' }
  }
  return { limite: null, origenDelLimite: null }
}

/**
 * Qué se le puede ofrecer a finanzas en la pantalla, según el objeto.
 *
 * Existe para que el formulario no ofrezca lo que el servidor va a rechazar:
 * mostrar «hasta 24 tractos» y reventar al guardar es la peor combinación.
 */
export function opcionesPermitidas(tipo: TipoDeObjeto, maxGlobal: number): {
  maxTractos: number
  frecuencias: PlanFrequency[]
} {
  return tipo === 'evento'
    ? { maxTractos: MAX_TRACTOS_EVENTO, frecuencias: [FRECUENCIA_OBLIGADA_EVENTO] }
    : { maxTractos: maxGlobal, frecuencias: ['mensual', 'quincenal'] }
}
