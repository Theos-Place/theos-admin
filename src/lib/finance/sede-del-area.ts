/**
 * FIN-12 · De qué SEDE es un puesto.
 *
 * El puesto «Colaborador Finanzas» cuelga de un comité que se llama como la
 * sede («Sede Liberia», bajo «Area Sedes»), y las sedes del catálogo se
 * llaman parecido pero no igual («Sede Liberia» ↔ code `liberia`, «Sede
 * Pedregal Domingos» ↔ `united`). No hay llave foránea entre área y sede: la
 * relación es por NOMBRE, y acá vive esa comparación para que no se escriba
 * tres veces.
 *
 * Verificado el 2026-10-14 contra producción: las 12 sedes activas con
 * comité casan por nombre con esta regla.
 *
 * Módulo PURO.
 */

/** Minúsculas, sin tildes, sin los prefijos «Sede», «Área de», «Comité de» —
 *  y los quita EN CADENA: «Area de Sede Guápiles» lleva dos. */
function norm(s: string): string {
  let t = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  for (;;) {
    const u = t.replace(/^(sede|area de|area|comite de|comite)\s+/, '')
    if (u === t) return t
    t = u
  }
}

export type SedeDelCatalogo = { code: string; name: string; is_active?: boolean }

/** La sede cuyo nombre casa con el del área, o null. Nunca adivina por parecido. */
export function sedeDelArea(areaName: string, sedes: readonly SedeDelCatalogo[]): SedeDelCatalogo | null {
  const objetivo = norm(areaName)
  if (!objetivo) return null
  const exactas = sedes.filter(s => norm(s.name) === objetivo)
  // Dos sedes con el mismo nombre normalizado sería un error del catálogo:
  // no se elige una, se reporta no encontrando.
  return exactas.length === 1 ? exactas[0] : null
}

/** De una lista de áreas donde la persona sirve, las sedes que le tocan. */
export function sedesDeLasAreas(areas: readonly string[], sedes: readonly SedeDelCatalogo[]): string[] {
  const out = new Set<string>()
  for (const a of areas) { const s = sedeDelArea(a, sedes); if (s) out.add(s.code) }
  return [...out].sort()
}
