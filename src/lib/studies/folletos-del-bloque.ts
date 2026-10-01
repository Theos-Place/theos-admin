/**
 * De «estudiantes matriculados» a «folletos que hay que imprimir».
 *
 * EL DESFASE QUE ARREGLA (2026-10-01): el reporte de hitos decía «Conteo
 * definitivo: X folletos», pero X salía de contar MATRÍCULAS. Con un folleto
 * por estudiante eso coincidía. Desde EST-14 ya no:
 *
 *   · Un grupo de N1 con 10 estudiantes necesita 20 folletos —el de 1 y el de
 *     2 se entregan juntos al inicio—, y el reporte decía 10. Se imprimía la
 *     MITAD.
 *   · Un grupo de N2 aparecía con su propio conteo, pero esos folletos ya se
 *     habían entregado al matricular N1. Se imprimía de MÁS.
 *
 * Los dos errores a la vez, y en direcciones opuestas, así que ni siquiera se
 * compensaban de forma predecible.
 *
 * La regla de qué folletos pide cada nivel NO se reescribe acá: se reusa
 * `folletosQuePide`, que es la misma que crea los tiquetes. Dos copias de esa
 * regla se separarían el día que cambien los bloques, y entonces la cola y el
 * conteo de impresión dirían cosas distintas sin que nadie lo note.
 */
import { folletosQuePide } from './corte-de-bloque'

/** Una fila por GRUPO, como la devuelve la base: cuántos matriculados tiene. */
export type MatriculadosPorGrupo = {
  sede: string
  grupo: string
  nivel_code: string
  nivel: string
  dirigente: string
  cantidad: number
}

/** Una fila por FOLLETO: lo que de verdad se imprime. */
export type FolletosPorGrupo = MatriculadosPorGrupo & {
  /** Código del folleto (N1, N2, …), que puede no ser el nivel del grupo. */
  folleto_code: string
  /** Nombre del folleto para mostrar. */
  folleto: string
}

/**
 * Expande cada grupo a una línea POR FOLLETO.
 *
 * Un grupo de N1 sale dos veces —folleto de Nivel 1 y folleto de Nivel 2— con
 * la misma cantidad de estudiantes cada una, que es como lo pidió Floriana:
 * listados por aparte.
 *
 * Un grupo cuyo nivel no pide folletos (N2, N4: ya se entregaron) NO sale.
 * Eso es lo correcto y además es lo que evita el conteo de más.
 *
 * @param nombreDelNivel traduce el código a nombre. El de un folleto del par
 *        —el N2 de un grupo de N1— no viene en la fila, hay que buscarlo.
 */
export function expandirAFolletos(
  filas: readonly MatriculadosPorGrupo[],
  nombreDelNivel: (code: string) => string | undefined,
): FolletosPorGrupo[] {
  const salida: FolletosPorGrupo[] = []
  for (const f of filas) {
    for (const code of folletosQuePide(f.nivel_code)) {
      salida.push({
        ...f,
        folleto_code: code,
        // Si el nombre no está, se muestra el código: un «N2» es feo pero
        // dice qué imprimir. Un vacío no.
        folleto: nombreDelNivel(code) ?? (code === f.nivel_code ? f.nivel : code),
      })
    }
  }
  return salida
}

/** Total de folletos a imprimir. NO es la cantidad de personas. */
export function totalDeFolletos(filas: readonly FolletosPorGrupo[]): number {
  return filas.reduce((s, f) => s + f.cantidad, 0)
}

/** Cuántos folletos por sede, de mayor a menor. */
export function folletosPorSede(filas: readonly FolletosPorGrupo[]): Array<{ sede: string; cantidad: number }> {
  const m = new Map<string, number>()
  for (const f of filas) m.set(f.sede, (m.get(f.sede) ?? 0) + f.cantidad)
  return [...m.entries()]
    .map(([sede, cantidad]) => ({ sede, cantidad }))
    .sort((a, z) => z.cantidad - a.cantidad || a.sede.localeCompare(z.sede))
}

/** Los códigos que hay que buscarle el nombre, sin repetir. */
export function codigosDeFolleto(filas: readonly MatriculadosPorGrupo[]): string[] {
  const s = new Set<string>()
  for (const f of filas) for (const c of folletosQuePide(f.nivel_code)) s.add(c)
  return [...s]
}
