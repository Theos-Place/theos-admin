/**
 * Superponer dos sedes en el gráfico semanal.
 *
 * POR QUÉ. La pregunta que lo pidió no se puede contestar mirando una sede a la
 * vez: "¿la caída de Meridiano Martes coincide con la apertura de Meridiano
 * Miércoles?". Con el filtro actual hay que abrir el reporte dos veces, anotar
 * los números y comparar de memoria.
 */

export type PuntoSemanal = { week: number; total: number; partial: boolean }

export type PuntoComparado = {
  week: number
  /** null = la sede principal no tiene esa semana. Recharts no dibuja la barra,
   *  que es lo correcto: un 0 se leería como "vinieron cero". */
  total: number | null
  partial: boolean
  /** Total de la sede comparada esa semana. null = no tuvo datos. */
  comparado: number | null
}

/**
 * Une las dos series por número de semana.
 *
 * La UNIÓN y no la intersección: si la sede comparada arrancó en la semana 30,
 * las semanas 1 a 29 tienen que seguir mostrando la principal —justamente el
 * "antes" que se quiere ver—. Y si la comparada tiene semanas que la principal
 * no, también entran: una sede que abre cuando la otra cierra es el caso de uso.
 *
 * `comparado: null` (y no 0) a propósito: Recharts corta la línea en null, que
 * es lo honesto —esa semana no hubo dato—, mientras que un 0 dibujaría una
 * caída a cero que nunca ocurrió.
 */
export function unirSeries(
  principal: readonly PuntoSemanal[],
  comparada: readonly PuntoSemanal[],
): PuntoComparado[] {
  const otra = new Map(comparada.map(p => [p.week, p.total]))
  const semanas = [...new Set([...principal.map(p => p.week), ...comparada.map(p => p.week)])].sort((a, b) => a - b)
  const porSemana = new Map(principal.map(p => [p.week, p]))
  return semanas.map(week => {
    const p = porSemana.get(week)
    return {
      week,
      total: p ? p.total : null,
      partial: p?.partial ?? false,
      comparado: otra.has(week) ? otra.get(week)! : null,
    }
  })
}
