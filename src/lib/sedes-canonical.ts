/**
 * Diccionario CANÓNICO de nombres de charlas por sede. Centraliza los alias
 * (nombres viejos/variantes) → nombre oficial, para que imports y creación de
 * eventos no vuelvan a generar variantes. Módulo PURO (sin React) para poder
 * usarlo también desde scripts de import.
 *
 * Normalización de la clave: sin tildes, minúsculas, sin el prefijo "Charla ".
 */
const stripAccents = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Clave normalizada de un título de charla/sede (para buscar en el diccionario). */
export function normalizeSedeKey(title: string): string {
  return stripAccents(title).toLowerCase().replace(/^charla\s+/, '').trim()
}

/** alias normalizado → nombre canónico oficial. */
export const SEDE_CANONICAL: Record<string, string> = {
  // Meridiano (antes Pro Oeste)
  'pro oeste': 'Charla Meridiano',
  'pro oeste (meridiano)': 'Charla Meridiano',
  'meridiano': 'Charla Meridiano',
  // Antares (antes Pro Este)
  'pro este': 'Charla Antares',
  'pro este (antares)': 'Charla Antares',
  'antares': 'Charla Antares',
  // "Theos Home" se dividió en DOS sedes:
  //  · Charla Meridiano Home ← Meridiano Jueves / "Theos Home (antes Meridiano Jueves)"
  'meridiano jueves': 'Charla Meridiano Home',
  'theos home (antes meridiano jueves)': 'Charla Meridiano Home',
  'meridiano home': 'Charla Meridiano Home',
  //  · Charla Pedregal Home ← "Theos Home"/"Home" + "Pedregal (Jóvenes)"
  'home': 'Charla Pedregal Home',
  'theos home': 'Charla Pedregal Home',
  'pedregal (jovenes)': 'Charla Pedregal Home',
  'pedregal jovenes': 'Charla Pedregal Home',
  'pedregal home': 'Charla Pedregal Home',
  // Resto de sedes: patrón "Charla [Sede]"
  'liberia': 'Charla Liberia',
  'cartago': 'Charla Cartago',
  'guapiles': 'Charla Guápiles',
  'heredia': 'Charla Heredia',
  'alajuela': 'Charla Alajuela',
  'potrero': 'Charla Potrero',
  'perez zeledon': 'Charla Pérez Zeledón',
  'united': 'Charla United',
  'madrid': 'Charla Madrid',
  // Life Este y Life Escalante están registradas como sedes SEPARADAS (sedes
  // table: 'life-este' y 'life-escalante') → se mantienen separadas.
  'life este': 'Charla Life Este',
  'life escalante': 'Charla Life Escalante',
}

/** Devuelve el nombre canónico de una charla de sede, o null si el título no
 *  corresponde a una sede del diccionario (no se toca: actividades, campas, etc.). */
export function canonicalCharlaTitle(title: string): string | null {
  return SEDE_CANONICAL[normalizeSedeKey(title)] ?? null
}
