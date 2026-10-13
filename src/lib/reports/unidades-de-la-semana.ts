/**
 * REP-15 · Las dos secciones de la semana cuentan cosas distintas, y ese es
 * el problema: cuentan bien y lo dicen mal.
 *
 * MEDIDO con la semana 40 de 2026, que es el caso que se reportó:
 *
 *   · Arriba  → 899 CHECK-INS: 872 hechos como asistente y 27 como servidor.
 *   · Abajo   → 875 PERSONAS distintas hicieron esos 899 check-ins.
 *   · De esas 875, 839 ya habían venido antes; 36 vinieron por primera vez.
 *
 * Los tres números son correctos. Ninguna consulta estaba mal: las dos miran
 * el mismo universo (`event_type = 'charla'`) y la misma ventana. Lo que
 * estaba mal eran las PALABRAS:
 *
 *   1. Abajo decía «875 check-ins» a lo que son personas. Simplemente falso.
 *   2. Arriba decía «872 participantes» a lo que son check-ins.
 *   3. «Asistente» significaba DOS cosas en la misma pantalla: arriba, quien
 *      vino a recibir y no a servir; abajo, quien ya vino más de una vez.
 *
 * Por eso 872 + 27 = 899 no calzaba con 875, y 839 no calzaba con 872: se
 * estaban comparando check-ins con personas. Nadie podía notarlo porque las
 * etiquetas decían que eran lo mismo.
 *
 * La regla de acá en adelante: un número de esta pantalla dice SIEMPRE su
 * unidad, y las dos unidades nunca comparten nombre.
 */

/** Lo que se cuenta. Son dos cosas y nunca se llaman igual. */
export type Unidad = 'checkins' | 'personas'

export const ETIQUETA_UNIDAD: Record<Unidad, { singular: string; plural: string }> = {
  checkins: { singular: 'check-in', plural: 'check-ins' },
  personas: { singular: 'persona', plural: 'personas' },
}

export function etiqueta(n: number, unidad: Unidad): string {
  const e = ETIQUETA_UNIDAD[unidad]
  return n === 1 ? e.singular : e.plural
}

/**
 * La frase que reconcilia las dos secciones.
 *
 * Va en la pantalla y no en una nota al pie: que 899 y 875 conviviesen sin
 * explicación es justo lo que hizo que se reportaran como un error.
 */
export function reconciliacion(input: { checkins: number; personas: number }): string | null {
  const repetidos = input.checkins - input.personas
  if (repetidos <= 0) return null
  return `${input.checkins.toLocaleString('es-CR')} check-ins de `
    + `${input.personas.toLocaleString('es-CR')} personas: `
    + `${repetidos.toLocaleString('es-CR')} ${repetidos === 1 ? 'vino' : 'vinieron'} más de una vez en la semana.`
}

/**
 * Cómo se nombra a quien ya venía, frente a quien vino por primera vez.
 *
 * «Asistentes» a secas era la palabra que chocaba con la de arriba. Acá la
 * distinción real es otra: tener historia o no tenerla.
 */
export function desglosePorHistoria(input: { personas: number; conHistoria: number }): {
  conHistoria: number
  primeraVez: number
  frase: string
} {
  const primeraVez = Math.max(0, input.personas - input.conHistoria)
  return {
    conHistoria: input.conHistoria,
    primeraVez,
    frase: primeraVez === 0
      ? 'Todas ya habían venido antes.'
      : `${input.conHistoria.toLocaleString('es-CR')} ya habían venido antes y `
        + `${primeraVez.toLocaleString('es-CR')} ${primeraVez === 1 ? 'vino' : 'vinieron'} por primera vez.`,
  }
}
