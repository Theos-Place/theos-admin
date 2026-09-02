/**
 * Cuántos folletos pedir de verdad (módulo puro).
 *
 * Hasta ahora el tiquete decía una sola cifra: los estudiantes matriculados.
 * Pero el dirigente y el co-dirigente también necesitan su folleto para dar
 * el estudio, así que quien imprime tenía que acordarse de sumarlos a mano —
 * y cuando se le olvidaba, el grupo arrancaba con el dirigente sin material.
 *
 * Acá se calcula el total y se deja el desglose visible: quien recibe el
 * correo tiene que poder ver de dónde sale el número, no solo el número.
 */

export type DesgloseFolletos = {
  /** Un folleto por estudiante matriculado. */
  estudiantes: number
  /** Dirigente + co-dirigente, los que el grupo tenga (0, 1 o 2). */
  dirigentes: number
  /** Lo que hay que imprimir. */
  total: number
}

export function desgloseFolletos(input: {
  estudiantes: number
  tieneDirigente: boolean
  tieneCoDirigente: boolean
}): DesgloseFolletos {
  const estudiantes = Math.max(0, Math.trunc(input.estudiantes) || 0)
  const dirigentes = (input.tieneDirigente ? 1 : 0) + (input.tieneCoDirigente ? 1 : 0)
  return { estudiantes, dirigentes, total: estudiantes + dirigentes }
}

/** Una línea para el correo y la cola: "14 de estudiantes + 2 de dirigentes = 16". */
export function textoDesglose(d: DesgloseFolletos): string {
  if (d.dirigentes === 0) return `${d.estudiantes} (solo estudiantes, el grupo no tiene dirigente asignado)`
  const plural = d.dirigentes === 1 ? 'dirigente' : 'dirigentes'
  return `${d.estudiantes} de estudiantes + ${d.dirigentes} de ${plural} = ${d.total}`
}
