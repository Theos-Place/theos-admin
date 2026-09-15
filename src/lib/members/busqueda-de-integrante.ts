/**
 * Buscar a la persona que se va a vincular como integrante de una familia.
 *
 * Antes solo servía la cédula: el modal pedía el número y descartaba todo
 * resultado cuya cédula no fuera EXACTAMENTE la escrita. El buscador de atrás
 * ya sabía buscar por nombre —`search_text` tokeniza nombre, apellidos, cédula,
 * correo y teléfono— así que la limitación era del filtro de adelante.
 *
 * Y la cédula justamente es lo que más falta: de las fichas del padrón, la
 * mayoría de los menores no tiene, y a quien se vincula a una familia es
 * seguido un hijo.
 */

/** ¿Lo que escribieron parece un número de documento y no un nombre? */
export function pareceDocumento(q: string): boolean {
  const t = q.trim()
  if (!t) return false
  // Dígitos con guiones o espacios, nada de letras. "1-1234-5678" y "112345678".
  return /^[\d][\d\s-]*$/.test(t)
}

/**
 * Mínimo de caracteres antes de ir al servidor.
 *
 * Distinto según el caso a propósito: una cédula parcial de 2 dígitos trae
 * cientos de coincidencias inútiles, mientras que un apellido corto ("Mora")
 * tiene que funcionar. El buscador de atrás exige 2 como piso absoluto.
 */
export function minimoParaBuscar(q: string): number {
  return pareceDocumento(q) ? 4 : 3
}

export function sePuedeBuscar(q: string): boolean {
  const t = q.trim()
  return t.length >= minimoParaBuscar(t)
}

/**
 * Lo que se le manda al servidor.
 *
 * `search_text` guarda la cédula SIN separadores, así que "1-1272-0074" —que es
 * como la gente la escribe y como sale en el documento— no encontraba nada. El
 * nombre se manda tal cual: ahí los espacios son los que tokenizan.
 */
export function consultaParaElServidor(q: string): string {
  const t = q.trim()
  return pareceDocumento(t) ? t.replace(/[\s-]/g, '') : t
}

export type Candidato = { id: string; first_name: string; last_name: string; cedula: string | null }

const soloDigitos = (s: string) => s.replace(/\D/g, '')

/** Los que se pueden ofrecer: fuera quien ya está en la familia que se arma. */
export function candidatosVisibles<T extends Candidato>(
  resultados: T[], yaVinculados: string[] = [],
): T[] {
  const fuera = new Set(yaVinculados)
  return resultados.filter(r => !fuera.has(r.id))
}

/**
 * Si escribieron una cédula COMPLETA y hay exactamente una ficha con ella, se
 * elige sola: es el flujo rápido de siempre y no hay que perderlo por agregar
 * la búsqueda por nombre. Con un nombre nunca se autoselecciona — dos personas
 * pueden llamarse igual y elegir por ellas es justo el error que no se puede
 * cometer al armar una familia.
 */
export function seleccionAutomatica<T extends Candidato>(candidatos: T[], q: string): T | null {
  if (!pareceDocumento(q)) return null
  const n = soloDigitos(q)
  if (n.length < 9) return null
  const exactos = candidatos.filter(c => c.cedula && soloDigitos(c.cedula) === n)
  return exactos.length === 1 ? exactos[0] : null
}

export function textoSinResultados(q: string): string {
  return pareceDocumento(q)
    ? 'No se encontró a nadie con esa cédula.'
    : 'No se encontró a nadie con ese nombre.'
}
