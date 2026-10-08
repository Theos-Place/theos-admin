/**
 * Las opciones de un desplegable que NO se escriben a mano: salen de la base.
 *
 * Existía una sola fuente (`study_groups_open`) resuelta con un `if` dentro de
 * `resolveDynamicOptions`. Al agregar la segunda —los talleres, para la
 * encuesta de retroalimentación (Floriana, 2026-10-08)— ese `if` se habría
 * vuelto dos, y la lista de fuentes válidas habría quedado escrita en cuatro
 * lugares: el tipo del adaptador, el filtro, el `map` y el editor.
 *
 * Acá vive la lista y las etiquetas. Leer la base sigue siendo de la query.
 */

export const FUENTES_DINAMICAS = ['study_groups_open', 'talleres'] as const
export type FuenteDinamica = (typeof FUENTES_DINAMICAS)[number]

export function esFuenteDinamica(v: string | null | undefined): v is FuenteDinamica {
  return !!v && (FUENTES_DINAMICAS as readonly string[]).includes(v)
}

/** Cómo se le llama a cada fuente en el editor de formularios. */
export const NOMBRE_DE_FUENTE: Record<FuenteDinamica, string> = {
  study_groups_open: 'Grupos de estudio en matrícula',
  talleres: 'Talleres',
}

/**
 * La etiqueta de un taller en el desplegable: «Entre Mujeres · 22 ago 2026».
 *
 * LLEVA LA FECHA porque el mismo taller se repite. Sin ella, quien contesta
 * la encuesta de octubre elige una opción que también es la de agosto, y al
 * leer los resultados no hay forma de separarlas.
 *
 * La fecha se arma en hora de Costa Rica y no con `new Date(iso)` a secas:
 * un taller de las 7 p.m. cae al día siguiente en UTC (es el mismo
 * corrimiento que ya mordió tres veces en este repo).
 */
export function etiquetaDeTaller(t: { title: string; starts_at: string | null }): string {
  if (!t.starts_at) return t.title
  const f = new Intl.DateTimeFormat('es-CR', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Costa_Rica',
  }).format(new Date(t.starts_at))
  return `${t.title} · ${f.replace(/\./g, '')}`
}

/**
 * Los talleres que se ofrecen, del más reciente al más viejo.
 *
 * Se ordena así y no al revés porque una encuesta se llena justo después del
 * taller: lo que la persona busca está arriba. Y se recortan los muy viejos
 * —`MESES_HACIA_ATRAS`— para que la lista no crezca para siempre; nadie
 * contesta la retroalimentación de un taller de hace dos años.
 */
export const MESES_HACIA_ATRAS = 12

export function talleresQueSeOfrecen(
  talleres: ReadonlyArray<{ title: string; starts_at: string | null }>,
  hoy: Date = new Date(),
): string[] {
  const corte = new Date(hoy)
  corte.setMonth(corte.getMonth() - MESES_HACIA_ATRAS)
  return talleres
    .filter(t => !!t.title?.trim())
    // Sin fecha se conserva: no se puede afirmar que sea vieja.
    .filter(t => !t.starts_at || new Date(t.starts_at) >= corte)
    .sort((a, b) => (b.starts_at ?? '').localeCompare(a.starts_at ?? ''))
    .map(etiquetaDeTaller)
}
