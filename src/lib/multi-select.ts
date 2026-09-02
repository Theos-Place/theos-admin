/**
 * Lógica del selector múltiple (módulo puro).
 *
 * Lo que el componente NO debería tener que decidir en medio del JSX: cómo se
 * lee la etiqueta del botón cuando hay 0, 1 o muchas cosas escogidas, y qué
 * opciones sobreviven a lo que la persona escribió en el buscador.
 */

export type OpcionMulti = { value: string; label: string }

/** Quita tildes y baja a minúscula: buscar "hermeneutica" tiene que encontrar
 *  "Hermenéutica", que es como está escrito el catálogo. */
export function claveBusqueda(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Filtra por texto libre. Cada palabra tiene que aparecer en algún lado, así
 *  "nivel 2" encuentra "N2 — Nivel 2" y "dinero admin" encuentra
 *  "AED — Administrando el Dinero". */
export function filtrarOpciones(
  opciones: readonly OpcionMulti[],
  texto: string,
): OpcionMulti[] {
  const palabras = claveBusqueda(texto).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return [...opciones]
  return opciones.filter(o => {
    const heno = claveBusqueda(`${o.value} ${o.label}`)
    return palabras.every(p => heno.includes(p))
  })
}

/**
 * Qué dice el botón. Con una sola cosa escogida se muestra su nombre —
 * "3 tipos" obliga a abrir el menú para saber cuál es. Con varias no cabe, así
 * que se cuenta.
 */
export function etiquetaSeleccion(input: {
  seleccionados: readonly string[]
  opciones: readonly OpcionMulti[]
  /** Qué decir con cero escogidos: "Todos", "Todas las zonas"… */
  vacio: string
  /** Cómo contar de dos en adelante: "tipos", "zonas". */
  sustantivo: string
}): string {
  const n = input.seleccionados.length
  if (n === 0) return input.vacio
  if (n === 1) {
    const o = input.opciones.find(x => x.value === input.seleccionados[0])
    return o?.label ?? `1 ${input.sustantivo}`
  }
  return `${n} ${input.sustantivo}`
}

/** Agrega o quita, sin duplicar y conservando el orden en que se fueron
 *  escogiendo (el query string queda estable y las URLs compartidas no cambian
 *  de forma sola). */
export function alternar(seleccionados: readonly string[], value: string): string[] {
  return seleccionados.includes(value)
    ? seleccionados.filter(v => v !== value)
    : [...seleccionados, value]
}
