/**
 * Vigencia y alcance de una excepción de matrícula.
 *
 * DOS COSAS QUE SE AGREGAN (2026-09-01):
 *
 * 1) REPETIR UN CURSO. Hasta ahora una excepción solo perdonaba requisitos de
 *    entrada (donante, asistencia, servidor, prerequisito, edad). No cubría el
 *    caso de alguien que YA llevó un estudio y lo quiere repetir: ahí la
 *    matrícula lo bloquea con "Ya completaste este estudio", que no es un
 *    requisito incumplido sino lo contrario.
 *
 *    'repetir' NO está incluido en 'all', a propósito. "Todos los requisitos"
 *    significa perdonar lo que le falta a alguien, no habilitarle un curso que
 *    ya aprobó: son decisiones distintas y quien otorga tiene que marcarla.
 *
 * 2) CADUCIDAD POR BLOQUE. La excepción se otorga para que la persona entre a
 *    los grupos que están abiertos AHORA, así que muere cuando cierra la
 *    matrícula del bloque en que se otorgó. Sin esto quedaban vivas para
 *    siempre y alguien podía usarlas un año después, cuando la razón por la que
 *    se dieron ya no aplica.
 *
 *    Las excepciones anteriores a este cambio no tienen bloque y NO caducan: se
 *    otorgaron bajo otra regla y no se les cambia el trato por retroactividad.
 */

/** Lo que una excepción puede perdonar. */
export const WAIVABLE = ['donor', 'attendance', 'server', 'prerequisite', 'age', 'repetir', 'all'] as const
export type Waivable = (typeof WAIVABLE)[number]

/** Los que 'all' cubre. `repetir` queda afuera — ver arriba. */
const CUBIERTOS_POR_ALL: readonly string[] = ['donor', 'attendance', 'server', 'prerequisite', 'age']

/** ¿Esta excepción perdona `req`? */
export function perdona(waived: readonly string[] | null | undefined, req: Waivable): boolean {
  const w = waived ?? []
  if (w.includes(req)) return true
  return w.includes('all') && CUBIERTOS_POR_ALL.includes(req)
}

/**
 * EST-23 · Los NIVELES no siguen el calendario de bloques.
 *
 * Los tres bloques anuales son de CAPACITACIONES. Un grupo de Nivel 1 abre
 * cuando hay gente y dirigente, no cuando empieza un cuatrimestre, así que
 * colgarle a su excepción el cierre de matrícula de un bloque le pone una
 * fecha que no significa nada.
 *
 * NO ES TEÓRICO (medido el 2026-10-06): tres excepciones de Nivel 1 estaban
 * MUERTAS sin que nadie lo supiera —Jose Fabio Quesada por edad, Kenneth
 * Campos y Kristal Monge para repetir— porque el «Bloque 3 2026» cerró su
 * matrícula el 13 de setiembre. Siguen diciendo `active` en la base y la
 * elegibilidad las descartaba en silencio.
 */
export function esNivel(planCode: string | null | undefined): boolean {
  return !!planCode && /^N[1-4]$/.test(planCode)
}

/**
 * ¿Sigue viva? Se exige status 'active' Y que no haya cerrado la matrícula del
 * bloque en que se otorgó.
 *
 * `cierreMatricula` null = excepción vieja, sin bloque: no caduca.
 * El día del cierre TODAVÍA vale — la matrícula está abierta hasta ese día
 * inclusive, así que la excepción tiene que durar lo mismo.
 *
 * EN NIVELES NO CADUCA NUNCA (EST-23). Vive hasta que se USA —un solo uso, al
 * matricularse queda `used`— o hasta que alguien la quita. `planCode` es
 * obligatorio justamente para que nadie se olvide de la distinción: un
 * default convertiría de nuevo a los niveles en capacitaciones.
 */
export function excepcionVigente(input: {
  status: string
  cierreMatricula: string | null | undefined
  hoy: string
  planCode: string | null | undefined
}): boolean {
  if (input.status !== 'active') return false
  if (esNivel(input.planCode)) return true
  const cierre = (input.cierreMatricula ?? '').slice(0, 10)
  if (!cierre) return true
  return input.hoy <= cierre
}

/** Qué decir en pantalla sobre hasta cuándo sirve. */
export function etiquetaVigencia(input: {
  cierreMatricula: string | null | undefined
  bloqueNombre?: string | null
  hoy: string
}): string {
  const cierre = (input.cierreMatricula ?? '').slice(0, 10)
  if (!cierre) return 'Sin vencimiento'
  const [a, m, d] = cierre.split('-')
  const fecha = `${Number(d)}/${Number(m)}/${a}`
  if (input.hoy > cierre) return `Vencida el ${fecha}`
  return input.bloqueNombre ? `Vence al cerrar ${input.bloqueNombre} (${fecha})` : `Vence el ${fecha}`
}
