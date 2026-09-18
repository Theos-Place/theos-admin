/**
 * DON-1 · De una fila del reporte de donaciones a la persona del padrón.
 *
 * EL PROBLEMA. Los reportes llegan con Fecha / Cliente / Notas y SIN ningún id.
 * El nombre viene como lo escribió el banco: en mayúsculas, muchas veces con
 * los APELLIDOS PRIMERO ("RUIZ MORENO ALEJANDRO"), a veces con la inicial del
 * segundo apellido ("Ana Patricia Salazar A.") y a veces sin las partículas
 * ("Maria Angeles" por "María de los Ángeles").
 *
 * POR QUÉ SE COMPARA UN CONJUNTO DE PALABRAS Y NO EL TEXTO. Con el texto
 * pelado, "RUIZ MORENO ALEJANDRO" no se parece a "Alejandro Ruiz Moreno"
 * aunque sean la misma persona. Comparando el conjunto de palabras, el orden
 * deja de importar.
 *
 * EL RIESGO DE ESO, Y CÓMO SE CONTIENE. "María Rodríguez Vargas" y "María
 * Vargas Rodríguez" tienen las MISMAS palabras y son dos personas distintas.
 * Por eso la regla no es "el mejor parecido gana": si el conjunto lo comparten
 * dos o más fichas, el resultado es AMBIGUO y lo resuelve una persona en la
 * vista previa. Nunca se importa solo un match dudoso — es la misma regla que
 * AGENTS.md exige para cualquier cruce por nombre.
 *
 * Módulo puro: el caller trae los candidatos y esto decide.
 */

export type Candidato = { id: string; nombre: string; cedula?: string | null }

export type Emparejamiento =
  /** Coincidió la cédula: es la única vía sin margen de duda. */
  | { estado: 'por_cedula'; persona: Candidato }
  /** Una sola ficha con ese conjunto de palabras. */
  | { estado: 'por_nombre'; persona: Candidato }
  /** Varias fichas posibles: lo resuelve una persona, no el sistema. */
  | { estado: 'ambiguo'; candidatos: Candidato[] }
  | { estado: 'sin_candidato' }

/** Partículas que el banco suele comerse; se quitan de los dos lados para que
 *  "Maria Angeles" y "María de los Ángeles" caigan en la misma clave. */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])

export function palabrasDelNombre(nombre: string): string[] {
  return String(nombre ?? '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length > 1 && !PARTICULAS.has(p))
}

/**
 * La clave de comparación: las palabras ORDENADAS alfabéticamente.
 *
 * Ordenar es lo que hace que el orden del banco no importe. Las palabras de una
 * sola letra se descartan antes: son iniciales ("Salazar A.") y exigirlas
 * dejaría sin match a quien viene abreviado.
 */
export function claveDeNombre(nombre: string): string {
  return palabrasDelNombre(nombre).sort().join(' ')
}

/** ¿Las palabras de `a` están TODAS dentro de `b`? Para el parecido parcial:
 *  "Alejandro Ruiz" contra "Alejandro Ruiz Moreno". */
function contenido(a: string[], b: string[]): boolean {
  const set = new Set(b)
  return a.length > 0 && a.every(p => set.has(p))
}

const soloDigitos = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '')

/**
 * @param fila      lo que trae el reporte.
 * @param padron    las fichas contra las que buscar (activas).
 *
 * El orden es el de confianza: cédula, nombre idéntico, parecido parcial. En
 * cuanto una vía da MÁS DE UN candidato se corta ahí y devuelve ambiguo, en vez
 * de seguir bajando a vías menos confiables.
 */
export function emparejarDonante(
  fila: { cedula?: string | null; nombre?: string | null },
  padron: readonly Candidato[],
): Emparejamiento {
  // 1 · Cédula. Se comparan solo los dígitos: el reporte la trae con guiones
  //     ("1-0847-0291") y la ficha muchas veces sin ellos.
  const ced = soloDigitos(fila.cedula)
  if (ced) {
    const porCedula = padron.filter(p => soloDigitos(p.cedula) === ced)
    if (porCedula.length === 1) return { estado: 'por_cedula', persona: porCedula[0] }
    if (porCedula.length > 1) return { estado: 'ambiguo', candidatos: porCedula }
  }

  const palabras = palabrasDelNombre(fila.nombre ?? '')
  if (palabras.length === 0) return { estado: 'sin_candidato' }
  const clave = palabras.slice().sort().join(' ')

  // 2 · Mismo conjunto de palabras.
  const exactos = padron.filter(p => claveDeNombre(p.nombre) === clave)
  if (exactos.length === 1) return { estado: 'por_nombre', persona: exactos[0] }
  if (exactos.length > 1) return { estado: 'ambiguo', candidatos: exactos }

  // 3 · Parecido parcial: uno es subconjunto del otro. SIEMPRE ambiguo, aunque
  //     haya uno solo — que el reporte diga "Alejandro Ruiz" no prueba que sea
  //     el Alejandro Ruiz Moreno del padrón y no otro que no esté cargado.
  const parciales = padron.filter(p => {
    const suyas = palabrasDelNombre(p.nombre)
    return contenido(palabras, suyas) || contenido(suyas, palabras)
  })
  if (parciales.length > 0) return { estado: 'ambiguo', candidatos: parciales.slice(0, 20) }

  return { estado: 'sin_candidato' }
}

/** ¿Se puede importar sin que una persona confirme? Solo las dos vías seguras.
 *  Existe como función para que la pantalla y el endpoint usen el MISMO
 *  criterio: si viven separados, un día se desalinean. */
export function seImportaSolo(m: Emparejamiento): boolean {
  return m.estado === 'por_cedula' || m.estado === 'por_nombre'
}
