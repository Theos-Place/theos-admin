/**
 * Relaciones posibles dentro de una unidad familiar.
 *
 * Vive acá y no en el modal porque ahora la validan tres lugares: el modal que
 * vincula, la pestaña que permite CORREGIR la relación (2026-09-10) y la API.
 * Con la lista duplicada, la API terminaría aceptando etiquetas que la UI no
 * ofrece y la pestaña mostraría un valor que su propio select no puede elegir.
 *
 * La etiqueta es relativa a la unidad, no a una persona concreta: por eso tras
 * fusionar dos familias puede haber más de un 'Titular' — y por eso hace falta
 * poder corregirlo a mano.
 */
export const RELACIONES_FAMILIARES = [
  'Titular',
  'Cónyuge',
  'Hijo/a',
  'Padre',
  'Madre',
  'Hermano/a',
  'Otro',
] as const

export type RelacionFamiliar = typeof RELACIONES_FAMILIARES[number]

export function esRelacionValida(v: unknown): v is RelacionFamiliar {
  return typeof v === 'string' && (RELACIONES_FAMILIARES as readonly string[]).includes(v)
}

// ── Parentesco visto desde una persona (FAM-3, 2026-10-29) ──────────────────

export type GeneroDeFicha = 'M' | 'F' | 'otro' | null | undefined

/** Los que forman la pareja de la unidad. */
const PAREJA: readonly string[] = ['Titular', 'Cónyuge']
const PADRES: readonly string[] = ['Padre', 'Madre']

function porGenero(g: GeneroDeFicha, masc: string, fem: string, ambos: string): string {
  return g === 'M' ? masc : g === 'F' ? fem : ambos
}

/**
 * Cómo se llama el vínculo de OTRA persona visto desde el perfil de alguien.
 *
 * La etiqueta de `family_members.relation` es el rol en la unidad —Titular,
 * Cónyuge, Hijo/a— y por eso, en el perfil de un hijo, la mamá salía como
 * «Titular» y el hermano como «Hijo/a» (Floriana, 2026-10-29). Esta función no
 * toca lo guardado: traduce el par (mi rol, su rol) y pone el género de la
 * otra persona. Los pares que no sabe resolver devuelven el rol guardado, que
 * es lo que se mostraba antes, así nada empeora.
 *
 * Los roles «Padre», «Madre» y «Hermano/a» se guardan respecto al Titular
 * (medido en producción el 2026-10-29: 7 Madre, 1 Padre, 2 Hermano/a, en
 * familias con un Titular o con solo hijos), y así se leen acá.
 */
export function parentescoVistoDesde(miRol: string | null | undefined, suRol: string | null | undefined, suGenero: GeneroDeFicha): string {
  const yo = (miRol ?? '').trim()
  const el = (suRol ?? '').trim()
  const hijo = () => porGenero(suGenero, 'Hijo', 'Hija', 'Hijo/a')
  const padre = () => porGenero(suGenero, 'Padre', 'Madre', 'Padre/Madre')
  const hermano = () => porGenero(suGenero, 'Hermano', 'Hermana', 'Hermano/a')

  if (PAREJA.includes(yo)) {
    if (PAREJA.includes(el)) return 'Cónyuge'
    if (el === 'Hijo/a') return hijo()
    if (PADRES.includes(el)) return padre()
    if (el === 'Hermano/a') return hermano()
  }
  if (yo === 'Hijo/a') {
    if (PAREJA.includes(el)) return padre()
    if (el === 'Hijo/a') return hermano()
    if (PADRES.includes(el)) return porGenero(suGenero, 'Abuelo', 'Abuela', 'Abuelo/a')
    if (el === 'Hermano/a') return porGenero(suGenero, 'Tío', 'Tía', 'Tío/a')
  }
  if (PADRES.includes(yo)) {
    if (el === 'Titular') return hijo()
    if (PADRES.includes(el)) return 'Cónyuge'
    if (el === 'Hijo/a') return porGenero(suGenero, 'Nieto', 'Nieta', 'Nieto/a')
    if (el === 'Hermano/a') return hijo()
  }
  if (yo === 'Hermano/a') {
    if (el === 'Titular' || el === 'Hermano/a') return hermano()
    if (PADRES.includes(el)) return padre()
    if (el === 'Hijo/a') return porGenero(suGenero, 'Sobrino', 'Sobrina', 'Sobrino/a')
  }
  return el || 'Otro'
}
