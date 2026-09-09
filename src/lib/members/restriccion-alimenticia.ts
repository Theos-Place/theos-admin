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
 */

export const RESTRICCIONES_ALIMENTICIAS = [
  { clave: 'celiaquia', etiqueta: 'Celiaquía' },
  { clave: 'intolerancia_lactosa', etiqueta: 'Intolerancia a la lactosa' },
  { clave: 'vegana', etiqueta: 'Persona vegana' },
  { clave: 'otros', etiqueta: 'Otros' },
] as const

export type ClaveRestriccion = typeof RESTRICCIONES_ALIMENTICIAS[number]['clave']

/** La clave que habilita el texto libre. */
export const CLAVE_OTROS: ClaveRestriccion = 'otros'

const CLAVES = new Set<string>(RESTRICCIONES_ALIMENTICIAS.map(r => r.clave))
const ETIQUETA = new Map<string, string>(RESTRICCIONES_ALIMENTICIAS.map(r => [r.clave, r.etiqueta]))

export function esClaveValida(v: unknown): v is ClaveRestriccion {
  return typeof v === 'string' && CLAVES.has(v)
}

export type Normalizacion = {
  ok: boolean
  /** Claves limpias, sin repetidos y en el orden del catálogo. */
  restricciones: ClaveRestriccion[]
  /** Texto de "Otros"; null cuando no corresponde. */
  otro: string | null
  error?: string
}

/**
 * Limpia y valida el par (lista, texto).
 *
 * REGLA cuando hay texto pero "Otros" no está marcado: se MARCA "Otros" sola, no
 * se borra el texto. Alguien que se tomó el trabajo de escribir su restricción
 * está diciendo algo; descartarlo por un checkbox sin marcar pierde información
 * real y además es lo que más molesta desde el celular, donde es fácil escribir
 * y que el toque del checkbox no registre.
 *
 * Al revés —"Otros" marcado sin texto— sí es un error: la opción no dice nada
 * por sí sola, y guardarla dejaría a la cocina con un "otros" sin contenido.
 */
export function normalizarRestricciones(
  lista: unknown,
  textoOtro: unknown,
): Normalizacion {
  const crudas = Array.isArray(lista) ? lista : []
  const invalidas = crudas.filter(v => !esClaveValida(v))
  if (invalidas.length) {
    return {
      ok: false,
      restricciones: [],
      otro: null,
      error: `Restricción alimenticia desconocida: ${invalidas.map(String).join(', ')}.`,
    }
  }

  const texto = typeof textoOtro === 'string' ? textoOtro.trim() : ''
  const set = new Set<string>(crudas as string[])
  if (texto) set.add(CLAVE_OTROS)

  // Orden del catálogo: la lista guardada no depende de en qué orden se tocaron
  // los checkboxes, así que dos personas con lo mismo se ven iguales.
  const restricciones = RESTRICCIONES_ALIMENTICIAS
    .map(r => r.clave)
    .filter(c => set.has(c)) as ClaveRestriccion[]

  if (set.has(CLAVE_OTROS) && !texto) {
    return {
      ok: false,
      restricciones,
      otro: null,
      error: 'Marcaste «Otros»: escribí cuál es la restricción.',
    }
  }

  return {
    ok: true,
    restricciones,
    otro: set.has(CLAVE_OTROS) ? texto : null,
  }
}

/** Cómo se lee en pantalla y en un export. '—' cuando no hay nada. */
export function textoDeRestricciones(
  lista: readonly string[] | null | undefined,
  otro: string | null | undefined,
): string {
  const claves = (lista ?? []).filter(esClaveValida)
  if (claves.length === 0) return '—'
  return RESTRICCIONES_ALIMENTICIAS
    .map(r => r.clave)
    .filter(c => claves.includes(c))
    .map(c => (c === CLAVE_OTROS && otro ? `${ETIQUETA.get(c)}: ${otro}` : ETIQUETA.get(c)!))
    .join(', ')
}
