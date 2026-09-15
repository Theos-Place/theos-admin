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
  'pro oeste': 'Charla Meridiano Martes',
  'pro oeste (meridiano)': 'Charla Meridiano Martes',
  'meridiano': 'Charla Meridiano Martes',
  // Antares (antes Pro Este)
  'pro este': 'Charla Antares Miércoles',
  'pro este (antares)': 'Charla Antares Miércoles',
  'antares': 'Charla Antares Miércoles',
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
  /**
   * RENOMBRE EN BLOQUE del 9 al 13 de setiembre de 2026: las series pasaron a
   * llevar el día de la semana en el nombre. Los alias viejos apuntan al nuevo
   * para que un import futuro no vuelva a crear la variante vieja.
   *
   * Los pares se confirmaron por fecha —la serie vieja termina justo cuando
   * arranca la nueva, sin traslape— y por día de la semana.
   */
  'meridiano martes': 'Charla Meridiano Martes',
  'meridiano mie': 'Charla Meridiano Miércoles',
  'meridiano miercoles': 'Charla Meridiano Miércoles',
  // Heredia es el nombre VIEJO de Pedregal Miércoles: la sede ya se renombró y
  // los dos registros que había con ese nombre se fusionaron en
  // 'pedregal-miercoles'.
  'heredia': 'Charla Pedregal Miércoles',
  'heredia youth': 'Charla Pedregal Miércoles Youth',
  'pedregal miercoles': 'Charla Pedregal Miércoles',
  'pedregal jueves': 'Charla Pedregal Jueves',
  'pedregal domingo': 'Charla Pedregal Domingo',
  // United es el nombre viejo de Pedregal Domingo.
  'united': 'Charla Pedregal Domingo',
  'united youth': 'Charla Pedregal Domingo Youth',
  'madrid': 'Charla Madrid Domingo',
  'madrid domingo': 'Charla Madrid Domingo',
  'madrid home': 'Charla Madrid Home Jueves',
  'madrid home jueves': 'Charla Madrid Home Jueves',
  'antares miercoles': 'Charla Antares Miércoles',
  'cartago miercoles': 'Charla Cartago Miércoles',
  'cartago youth': 'Charla Cartago Youth',
  'liberia miercoles': 'Charla Liberia Miércoles',
  'guapiles miercoles': 'Charla Guápiles Miércoles',
  'alajuela jueves': 'Charla Alajuela Jueves',
  'potrero jueves': 'Charla Potrero Jueves',
  'perez zeledon miercoles': 'Charla Pérez Zeledón Miércoles',

  // Resto de sedes: patrón "Charla [Sede]"
  'liberia': 'Charla Liberia Miércoles',
  'cartago': 'Charla Cartago Miércoles',
  'guapiles': 'Charla Guápiles Miércoles',
  'alajuela': 'Charla Alajuela Jueves',
  'potrero': 'Charla Potrero Jueves',
  'perez zeledon': 'Charla Pérez Zeledón Miércoles',
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
