/**
 * Restricciones alimenticias de una persona.
 *
 * Se guardan como CLAVES estables ('celiaquia', …) y no como las etiquetas en
 * español: renombrar "Persona vegana" a otra cosa no debe obligar a tocar 23 mil
 * filas ni a mantener dos escrituras del mismo valor conviviendo en la base.
 * Las etiquetas viven acá.
 *
 * El tipo en la base es text[], siguiendo la convención del esquema para listas
 * de claves (study_groups.schedule_days, study_leaders.qualified_study_codes,
 * prematrimonial_requests.zones). jsonb se reserva para estructuras con forma.
 *
 * NO hay opción "Otros" (decisión del usuario, 2026-09-10): la lista es cerrada.
 * Con ella se fue también la columna del texto libre — una columna sin uso
 * posible es una invitación a llenarla por otro camino.
 */

export const RESTRICCIONES_ALIMENTICIAS = [
  { clave: 'celiaquia', etiqueta: 'Celiaquía' },
  { clave: 'intolerancia_lactosa', etiqueta: 'Intolerancia a la lactosa' },
  { clave: 'vegana', etiqueta: 'Persona vegana' },
] as const

export type ClaveRestriccion = typeof RESTRICCIONES_ALIMENTICIAS[number]['clave']

const CLAVES = new Set<string>(RESTRICCIONES_ALIMENTICIAS.map(r => r.clave))
const ETIQUETA = new Map<string, string>(RESTRICCIONES_ALIMENTICIAS.map(r => [r.clave, r.etiqueta]))

export function esClaveValida(v: unknown): v is ClaveRestriccion {
  return typeof v === 'string' && CLAVES.has(v)
}

export type Normalizacion = {
  ok: boolean
  /** Claves limpias, sin repetidos y en el orden del catálogo. */
  restricciones: ClaveRestriccion[]
  error?: string
}

/** Limpia y valida la lista. Una clave fuera del catálogo se rechaza nombrándola,
 *  en vez de guardarse y aparecer después como un valor que nadie sabe pintar. */
export function normalizarRestricciones(lista: unknown): Normalizacion {
  const crudas = Array.isArray(lista) ? lista : []
  const invalidas = crudas.filter(v => !esClaveValida(v))
  if (invalidas.length) {
    return {
      ok: false,
      restricciones: [],
      error: `Restricción alimenticia desconocida: ${invalidas.map(String).join(', ')}.`,
    }
  }
  const set = new Set<string>(crudas as string[])
  // Orden del catálogo: la lista guardada no depende de en qué orden se tocaron
  // los checkboxes, así que dos personas con lo mismo se ven iguales.
  return {
    ok: true,
    restricciones: RESTRICCIONES_ALIMENTICIAS.map(r => r.clave).filter(c => set.has(c)) as ClaveRestriccion[],
  }
}

/** Cómo se lee en pantalla y en un export. '—' cuando no hay nada. */
export function textoDeRestricciones(lista: readonly string[] | null | undefined): string {
  const claves = (lista ?? []).filter(esClaveValida)
  if (claves.length === 0) return '—'
  return RESTRICCIONES_ALIMENTICIAS
    .map(r => r.clave)
    .filter(c => claves.includes(c))
    .map(c => ETIQUETA.get(c)!)
    .join(', ')
}
