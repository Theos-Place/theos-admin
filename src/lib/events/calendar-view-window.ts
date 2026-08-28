// Qué rango de fechas muestra cada vista del calendario público (módulo puro).
//
// EL BUG QUE ARREGLA. Las vistas de lista y cuadrícula usaban "desde hoy hasta
// el fin del mes en curso". Esa ventana se encoge sola: el 28 de agosto son
// cuatro días y el 31 es uno. Medido ese 28, daba CERO eventos mientras el
// encabezado decía "33 este mes" — la misma pantalla afirmando dos cosas
// distintas. Y como las flechas de mes solo existen en la vista mensual, desde
// lista o cuadrícula no había forma de salir de ahí.
//
// Lista y cuadrícula son "los próximos eventos", no "lo que queda del mes": es
// lo que sirve en un calendario embebido, y no depende del día en que se mire.

/** Días hacia adelante que muestran lista y cuadrícula. Dos meses alcanza para
 *  que siempre haya algo aunque el mes esté por terminar, sin volverse un
 *  listado infinito. */
export const DIAS_PROXIMOS = 60

export type Vista = 'monthly' | 'weekly' | 'list' | 'grid'

/** ¿Esta vista muestra "los próximos", o un mes concreto? */
export function esVistaDeProximos(view: Vista): boolean {
  return view === 'list' || view === 'grid'
}

/** Rango [desde, hasta) de las vistas de próximos, a partir de un "hoy". */
export function ventanaProximos(hoy: Date, dias = DIAS_PROXIMOS): { desde: Date; hasta: Date } {
  const desde = new Date(hoy)
  desde.setHours(0, 0, 0, 0)
  const hasta = new Date(desde)
  hasta.setDate(hasta.getDate() + dias)
  return { desde, hasta }
}

/**
 * El texto del contador del encabezado.
 *
 * Cambia con la vista a propósito: decir "este mes" arriba de una lista de los
 * próximos 60 días es la contradicción que hizo visible el bug.
 */
export function etiquetaContador(view: Vista, n: number): string {
  return esVistaDeProximos(view)
    ? `${n} ${n === 1 ? 'próximo' : 'próximos'}`
    : `${n} este mes`
}
