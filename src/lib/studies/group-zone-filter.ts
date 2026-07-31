// Opciones del filtro de ZONA en el listado de grupos.
//
// Problema que resuelve (2026-07-31): el filtro listaba las 11 sedes activas MÁS
// las 29 históricas — 40 opciones, de las cuales solo 2 tenían grupos — y en
// cambio NO tenía opción para los grupos sin zona específica, que son 2.167 de
// 2.169. O sea: casi todo el listado era imposible de filtrar.
//
// Regla (pedido de TI): las mismas zonas que al CREAR un grupo — las activas más
// "Todas las zonas" — y además cualquier zona HISTÓRICA que de verdad aparezca en
// algún grupo. Una zona histórica sin grupos no se ofrece: filtrar por ella
// devuelve una tabla vacía y no le sirve a nadie.

/** Valor del filtro para los grupos cuya zona es NULL ("Todas las zonas" al
 *  crearlos). No puede ser '' porque eso significa "sin filtro". */
export const ZONE_ANY = '__sin_zona__'

export type SedeLite = { id: string; name: string }

export type ZoneOption = {
  value: string
  label: string
  /** Para agrupar en el select: las históricas van aparte. */
  historical: boolean
}

export function groupZoneFilterOptions(input: {
  activeSedes: readonly SedeLite[]
  historicalSedes: readonly SedeLite[]
  /** Zonas presentes en los grupos (códigos; null = sin zona específica). */
  zonesInGroups: readonly (string | null)[]
  /** ¿Hay grupos sin zona específica? Si no viene, se deduce de zonesInGroups. */
  hasGroupsWithoutZone?: boolean
}): ZoneOption[] {
  const present = new Set(input.zonesInGroups.filter((z): z is string => !!z))
  const sinZona = input.hasGroupsWithoutZone ?? input.zonesInGroups.some(z => !z)

  const out: ZoneOption[] = []

  // "Todas las zonas" primero: es la zona de la mayoría de los grupos.
  if (sinZona) out.push({ value: ZONE_ANY, label: 'Todas las zonas (sin sede)', historical: false })

  for (const s of input.activeSedes) {
    out.push({ value: s.id, label: s.name, historical: false })
  }
  // Históricas: SOLO las que tienen grupos.
  const activeIds = new Set(input.activeSedes.map(s => s.id))
  for (const s of input.historicalSedes) {
    if (activeIds.has(s.id) || !present.has(s.id)) continue
    out.push({ value: s.id, label: s.name, historical: true })
  }
  // Zonas que están en grupos pero no existen como sede (datos heredados del
  // import): se ofrecen igual, con su código, para que el grupo sea filtrable.
  const known = new Set(out.map(o => o.value))
  for (const z of [...present].sort()) {
    if (!known.has(z)) out.push({ value: z, label: z, historical: true })
  }
  return out
}

/** Traduce el valor del select al parámetro que entiende el API. */
export function zoneFilterParam(value: string): { zone?: string; zoneNull?: boolean } {
  if (!value) return {}
  if (value === ZONE_ANY) return { zoneNull: true }
  return { zone: value }
}
