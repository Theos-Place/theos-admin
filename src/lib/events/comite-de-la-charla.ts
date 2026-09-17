/**
 * De una charla a su comité de sede (EVE-12).
 *
 * Hace falta porque el alcance por comité necesita que cada charla diga de
 * quién es, y hoy 174 de 188 no tienen comité organizador. Asignarlos a mano es
 * inviable y el título ya lo dice.
 *
 * TRES PASADAS, y la tercera es la que importa:
 *
 *  1. Nombre exacto: "Charla Meridiano Martes" → "Sede Meridiano Martes".
 *  2. Plural: el comité de Pedregal domingo se llama "Sede Pedregal DomingoS".
 *  3. Sin el día: "Charla Alajuela Jueves" → "Sede Alajuela". Esta SOLO vale si
 *     queda UN candidato. Sin esa condición el mapeo se equivoca feo: Pedregal
 *     tiene tres comités —Domingos, Jueves y Miércoles— y quitarles el día deja
 *     "pedregal" en los tres, así que "Charla Pedregal Domingo" caía en "Sede
 *     Pedregal Miércoles". Pasó en el primer intento de este mapeo.
 */

const DIAS = /\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingos?)\b/gi

/** minúsculas, sin tildes y sin el prefijo del tipo ("Charla", "Sede", "Comité"). */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/^(charla|comite|sede)\s+/, '').replace(/\s+/g, ' ').trim()
}

/** "domingos" y "domingo" son el mismo día. */
function sinPlural(s: string): string {
  return s.replace(/\b(domingo|martes|miercoles|jueves|viernes|sabado|lunes)s\b/g, '$1')
}

function sinDia(s: string): string {
  return normalizar(s.replace(DIAS, ' ')).replace(/\s+/g, ' ').trim()
}

export type Comite = { id: string; name: string }

/**
 * @returns el comité, o null si no hay ninguno o si hay MÁS DE UNO — la
 *   ambigüedad no se resuelve adivinando, se reporta.
 */
export function comiteDeLaCharla(tituloCanonico: string, comites: readonly Comite[]): Comite | null {
  const clave = normalizar(tituloCanonico)

  const exacto = comites.filter(c => normalizar(c.name) === clave)
  if (exacto.length === 1) return exacto[0]

  const plural = comites.filter(c => sinPlural(normalizar(c.name)) === sinPlural(clave))
  if (plural.length === 1) return plural[0]

  // Última pasada, y solo si NO hay ambigüedad.
  const base = sinDia(tituloCanonico)
  const candidatos = comites.filter(c => sinDia(c.name) === base)
  return candidatos.length === 1 ? candidatos[0] : null
}
