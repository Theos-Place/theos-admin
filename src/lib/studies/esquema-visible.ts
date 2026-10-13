/**
 * EST-28 · Mostrar en qué esquema está un grupo, donde se opera.
 *
 * Durante la transición de EST-14/EST-25 conviven los dos y a simple vista
 * no se distinguen, así que hay que operar sabiendo cuál es cuál: por qué un
 * cobro es de ₡5.000 por el par y otro del nivel solo, por qué un tiquete
 * pide dos folletos y otro uno.
 *
 * Esto es SOLO LECTURA de `study_groups.modalidad`, que ya existe. No cambia
 * ninguna regla: quien decide qué se cobra y qué folletos van sigue siendo
 * `nivelesACobrar` y `folletosQuePide`.
 *
 * TEMPORAL A PROPÓSITO. Todo lo que cuelga de acá —la columna de la lista,
 * el badge, la columna del export— existe mientras dure la transición.
 * Cuando ya no queden grupos legacy, se quita esto y se quitan con él. El
 * día que `select count(*) from study_groups where modalidad = 'legacy'
 * and status in ('en_curso','en_matricula')` dé 0, esto sobra.
 *
 * Módulo PURO.
 */
import { modalidadDe, type Modalidad } from './modalidad-de-bloques'
import { folletosQuePide } from './corte-de-bloque'

/** Cómo se le dice a cada esquema en pantalla. Corto: va en una columna. */
export const NOMBRE_DEL_ESQUEMA: Record<Modalidad, string> = {
  legacy: 'viejo',
  bloques: 'nuevo',
}

export function esquemaDelGrupo(modalidad: string | null | undefined): {
  modalidad: Modalidad
  nombre: string
} {
  const m = modalidadDe(modalidad)
  return { modalidad: m, nombre: NOMBRE_DEL_ESQUEMA[m] }
}

/** La explicación de una línea, para el badge y el tooltip. */
export function porQueImporta(modalidad: string | null | undefined): string {
  return modalidadDe(modalidad) === 'bloques'
    ? 'Esquema nuevo: se cobra y se entrega el PAR de niveles al entrar.'
    : 'Esquema viejo: cada nivel cobra y entrega lo suyo por aparte.'
}

/**
 * Qué folletos lleva este grupo, dicho con nombres y no con códigos.
 *
 * El tiquete decía solo «Nivel 1» en los dos esquemas, y en el nuevo lleva
 * dos folletos. Quien los imprime necesita verlo en el tiquete, no deducirlo
 * de la modalidad.
 *
 * `nombres` lo trae el llamador desde `study_plans`: acá no se inventa cómo
 * se llama un nivel, porque el catálogo puede cambiar y un literal quedaría
 * mintiendo.
 */
export function folletosDelTiquete(input: {
  planCode: string | null | undefined
  modalidad: string | null | undefined
  nombres?: Readonly<Record<string, string>>
}): { codigos: readonly string[]; etiqueta: string } {
  const codigos = folletosQuePide(input.planCode, modalidadDe(input.modalidad))
  if (codigos.length === 0) return { codigos, etiqueta: 'No pide folletos' }
  const legible = codigos.map(c => input.nombres?.[c] ?? c)
  // «Nivel 1 y Nivel 2» se lee peor que «Nivel 1 y 2» cuando comparten
  // prefijo, que es el caso de todos los niveles.
  const etiqueta = legible.length === 2 && comparten(legible[0], legible[1])
    ? `${legible[0]} y ${ultimaPalabra(legible[1])}`
    : legible.join(' y ')
  return { codigos, etiqueta }
}

function comparten(a: string, b: string): boolean {
  const pa = a.split(' ')[0]
  return pa.length > 0 && pa === b.split(' ')[0]
}

function ultimaPalabra(s: string): string {
  const partes = s.split(' ')
  return partes[partes.length - 1]
}
