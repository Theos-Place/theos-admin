/**
 * REP-7 · Cómo va el cumplimiento de compromisos de los servidores, a nivel
 * global, por área o por comité.
 *
 * Es la vista agregada de lo que "Mi comité" (SRV-4) muestra por comité. Las
 * reglas NO se reescriben: los ✓/✗ vienen tal cual de `lib/servers/compromisos`
 * y las filas de la misma consulta que alimenta esa pantalla. Si un comité
 * diera números distintos en los dos lados, sería un bug.
 *
 * LO QUE HAY QUE TENER PRESENTE AL LEERLO: alguien puede servir en VARIOS
 * comités. En el desglose cuenta en cada uno —es su gente— pero en los totales
 * cuenta UNA vez. Por eso las columnas del desglose no suman el total, y no es
 * un error de cuadre: es gente compartida.
 *
 * Módulo PURO.
 */
import { leFaltaAlgo, type Compromisos } from '@/lib/servers/compromisos'

export type ServidorDelReporte = Compromisos & {
  member_id: string
  nombre: string
  /** Comités donde tiene un puesto activo dentro del alcance. */
  comites: string[]
}

export type Cumplimiento = {
  /** Personas distintas. */
  total: number
  asistencia: number
  estudio: number
  donante: number
  /** Cumple los tres. */
  todo: number
  /** Le falta al menos uno. */
  conPendientes: number
}

function pct(parte: number, total: number): number | null {
  return total === 0 ? null : Math.round((parte / total) * 100)
}

export type Porcentajes = {
  asistencia: number | null
  estudio: number | null
  donante: number | null
  todo: number | null
}

export function porcentajes(c: Cumplimiento): Porcentajes {
  return {
    asistencia: pct(c.asistencia, c.total),
    estudio: pct(c.estudio, c.total),
    donante: pct(c.donante, c.total),
    todo: pct(c.todo, c.total),
  }
}

/**
 * Cuenta el cumplimiento de un grupo de personas, DES-DUPLICANDO por persona.
 *
 * Quien aparece dos veces —porque sirve en dos comités del alcance— cuenta una
 * sola vez. Sin esto, los totales globales inflarían a la gente más comprometida,
 * que es justamente la que sirve en más lugares.
 */
export function cumplimiento(servidores: readonly ServidorDelReporte[]): Cumplimiento {
  const vistos = new Map<string, ServidorDelReporte>()
  for (const s of servidores) if (!vistos.has(s.member_id)) vistos.set(s.member_id, s)
  const gente = [...vistos.values()]

  const enEstudio = (s: ServidorDelReporte) => s.llevandoEstudio || s.dandoEstudio
  return {
    total: gente.length,
    asistencia: gente.filter(s => s.asistencia).length,
    estudio: gente.filter(enEstudio).length,
    donante: gente.filter(s => s.donante).length,
    todo: gente.filter(s => s.asistencia && enEstudio(s) && s.donante).length,
    conPendientes: gente.filter(leFaltaAlgo).length,
  }
}

export type FilaDelDesglose = {
  id: string
  nombre: string
  cumplimiento: Cumplimiento
  porcentajes: Porcentajes
}

/**
 * El desglose: una fila por comité (o por área) con sus porcentajes.
 *
 * `pertenece` dice en qué filas va cada persona. Una persona en dos comités
 * aparece en los dos — para el encargado de cada uno, esa persona es suya.
 */
export function desglose(
  servidores: readonly ServidorDelReporte[],
  grupos: readonly { id: string; nombre: string }[],
  pertenece: (s: ServidorDelReporte, grupoId: string) => boolean,
): FilaDelDesglose[] {
  return grupos
    .map(g => {
      const suyos = servidores.filter(s => pertenece(s, g.id))
      const c = cumplimiento(suyos)
      return { id: g.id, nombre: g.nombre, cumplimiento: c, porcentajes: porcentajes(c) }
    })
    .filter(f => f.cumplimiento.total > 0)
    // Primero el que peor va: el reporte existe para encontrar dónde ayudar,
    // no para premiar al que ya cumple.
    .sort((a, b) => (a.porcentajes.todo ?? 0) - (b.porcentajes.todo ?? 0) || a.nombre.localeCompare(b.nombre, 'es'))
}

/** ¿Las columnas del desglose suman más que el total? Entonces hay gente
 *  compartida y conviene decirlo en pantalla en vez de que parezca un error. */
export function hayGenteCompartida(
  servidores: readonly ServidorDelReporte[],
): boolean {
  return servidores.some(s => s.comites.length > 1)
}
