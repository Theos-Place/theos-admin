/**
 * EST-20 · Qué estudio hay que abrir cuando se llega con `?grupo=<id>`.
 *
 * Quien viene de la página pública ya eligió su grupo. Aterrizar en la
 * matrícula con la lista cerrada le haría buscarlo otra vez entre todos —y
 * si hay varios Nivel 1, elegir mal es fácil—. Así que la pantalla abre el
 * estudio que contiene ese grupo y lo resalta.
 *
 * Módulo PURO.
 */

export type EstudioConGrupos = {
  study_code: string
  available_groups: ReadonlyArray<{ group_id: string }>
}

/**
 * El `study_code` que hay que expandir, o null.
 *
 * Devuelve null cuando el grupo ya no está disponible —se llenó, cerró
 * matrícula, o esta persona no califica—. La pantalla entonces se comporta
 * como siempre, que es lo correcto: forzar un estudio vacío dejaría a la
 * persona mirando una lista sin su grupo y sin explicación.
 */
export function estudioQueAbrir(
  resultados: ReadonlyArray<EstudioConGrupos>,
  grupoId: string | null | undefined,
): string | null {
  if (!grupoId) return null
  const r = resultados.find(x => x.available_groups.some(g => g.group_id === grupoId))
  return r?.study_code ?? null
}

/**
 * ¿Hay que avisar que el grupo que venía en el enlace ya no está?
 *
 * Se pregunta SOLO cuando los resultados ya llegaron: antes de eso «no está»
 * significa «todavía no sé», y el aviso saldría siempre por un instante.
 */
export function elGrupoYaNoEsta(input: {
  grupoId: string | null | undefined
  resultadosCargados: boolean
  resultados: ReadonlyArray<EstudioConGrupos>
}): boolean {
  if (!input.grupoId || !input.resultadosCargados) return false
  return estudioQueAbrir(input.resultados, input.grupoId) === null
}
