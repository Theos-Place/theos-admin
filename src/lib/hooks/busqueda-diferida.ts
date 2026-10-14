/**
 * LINT-1 · Una búsqueda con debounce, sin `setState` dentro del efecto.
 *
 * EL PATRÓN QUE SE REEMPLAZA. Once pantallas tenían esto:
 *
 *     useEffect(() => {
 *       const q = query.trim()
 *       if (q.length < 2) { setResults([]); return }   // ← síncrono en el efecto
 *       setSearching(true)                              // ← y este también
 *       const t = setTimeout(() => fetch(...).then(d => setResults(d)), 300)
 *       return () => clearTimeout(t)
 *     }, [query])
 *
 * Los dos `setState` síncronos son lo que marca `react-hooks/set-state-in-
 * effect`, y con razón: provocan un segundo render antes de pintar. Pero no
 * hacen falta. «Qué resultados mostrar» y «si está buscando» se DERIVAN
 * comparando la consulta actual con la consulta que produjo lo guardado —la
 * misma idea que `estado-de-carga`—. El efecto solo pide y guarda.
 *
 * Esta parte es pura para fijarla con tests: vitest corre en `node`.
 */

/** Lo que llegó, junto con la consulta que lo produjo. */
export type Guardado<T> = { clave: string; resultados: T[] }

/**
 * La clave de la búsqueda: la consulta recortada, o '' cuando no hay nada que
 * buscar (muy corta, o la búsqueda está apagada). Con '' no se pide nada y los
 * resultados son [] — que es lo que antes hacía el `setResults([])` a mano.
 */
export function claveDeBusqueda(consulta: string, minimo: number, activa = true): string {
  if (!activa) return ''
  const q = consulta.trim()
  return q.length < minimo ? '' : q
}

export type EstadoDeBusqueda<T> = { resultados: T[]; buscando: boolean }

/**
 * @param clave    lo que se quiere tener (de `claveDeBusqueda`).
 * @param guardado lo último que llegó, o null si todavía nada.
 *
 * Mientras lo guardado no sea de ESTA consulta, se está buscando y la lista va
 * vacía: mostrar los resultados de «mar» mientras se escribe «mario» confunde
 * más de lo que ayuda, y el flujo original también los vaciaba.
 */
export function estadoDeBusqueda<T>(clave: string, guardado: Guardado<T> | null): EstadoDeBusqueda<T> {
  if (clave === '') return { resultados: [], buscando: false }
  const alDia = guardado?.clave === clave
  return { resultados: alDia ? guardado!.resultados : [], buscando: !alDia }
}
