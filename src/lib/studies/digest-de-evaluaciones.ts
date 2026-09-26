/**
 * RET-1 parte 6 · El resumen quincenal de lo que espera revisión.
 *
 * LO QUE LO MOTIVA, medido el 2026-09-25: había 8 tiquetes de evaluación, los 8
 * en `open`, el más viejo de hace 34 días, y NADIE había recibido un aviso. La
 * cola existe en `/estudios/evaluaciones` pero hay que acordarse de entrar, y
 * el dato dice que no se entra.
 *
 * NO SE MANDA SI NO HAY NADA. Un resumen que llega cada quince días diciendo
 * «cero pendientes» enseña a archivarlo sin leer, y el día que traiga ocho
 * también se archiva. El aviso tiene que significar algo cada vez que aparece.
 *
 * NO LLEVA EL CONTENIDO DE NINGUNA RESPUESTA. Es un recordatorio de que hay
 * trabajo, no el trabajo: quien deba leerlas entra por el link. Una
 * notificación se reenvía y se lee por encima del hombro, y el acceso a esas
 * respuestas se acaba de cerrar con llave.
 *
 * Módulo PURO: recibe los tiquetes y decide qué decir.
 */

export type TiqueteParaElResumen = {
  /** Cuándo entró a la cola (YYYY-MM-DD o ISO). */
  creado: string
  /** Cuántas respuestas tiene ese grupo. Cero también es información: hay que
   *  decidir si se cierra sin evaluación. */
  respuestas: number
  /** `escalated` se cuenta aparte: alguien ya lo marcó como delicado. */
  escalado: boolean
}

export type ResumenDeEvaluaciones = {
  total: number
  escalados: number
  /** Días del más viejo. Es el número que duele y por eso va en el título. */
  diasDelMasViejo: number
  titulo: string
  cuerpo: string
}

const diasEntre = (desde: string, hasta: Date): number => {
  const d = new Date(desde)
  if (isNaN(d.getTime())) return 0
  return Math.max(0, Math.floor((hasta.getTime() - d.getTime()) / 86_400_000))
}

const plural = (n: number, sing: string, plur: string) => `${n} ${n === 1 ? sing : plur}`

/**
 * El resumen, o `null` si no hay nada que decir.
 *
 * @param hoy entra como parámetro y no se lee el reloj adentro: así el test
 *   puede pararse en cualquier día y la función sigue siendo pura.
 */
export function resumenDeEvaluaciones(
  tiquetes: readonly TiqueteParaElResumen[],
  hoy: Date,
): ResumenDeEvaluaciones | null {
  if (tiquetes.length === 0) return null

  const escalados = tiquetes.filter(t => t.escalado).length
  const diasDelMasViejo = Math.max(...tiquetes.map(t => diasEntre(t.creado, hoy)))
  const sinRespuestas = tiquetes.filter(t => t.respuestas === 0).length

  const titulo = `${plural(tiquetes.length, 'evaluación espera', 'evaluaciones esperan')} revisión`

  const partes: string[] = []
  // El más viejo va primero: es el dato que dice si esto se está atendiendo o
  // se está acumulando.
  partes.push(diasDelMasViejo >= 1
    ? `La más vieja lleva ${plural(diasDelMasViejo, 'día', 'días')} esperando.`
    : 'Entraron hoy.')
  if (escalados > 0) {
    partes.push(`${plural(escalados, 'está marcada', 'están marcadas')} como delicada${escalados === 1 ? '' : 's'}.`)
  }
  if (sinRespuestas > 0) {
    // Sin respuestas no hay nada que compartir, pero igual hay que decidir: son
    // las que se quedan en la cola para siempre si nadie las cierra.
    partes.push(`${plural(sinRespuestas, 'no tiene', 'no tienen')} ninguna respuesta.`)
  }

  return {
    total: tiquetes.length,
    escalados,
    diasDelMasViejo,
    titulo,
    cuerpo: partes.join(' '),
  }
}
