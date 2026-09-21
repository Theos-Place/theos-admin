/**
 * REP-8 · Quiénes asisten a cada sede: cuántos, qué edad y qué género.
 *
 * PERSONAS ÚNICAS, no check-ins. Alguien que fue ocho veces a Cartago es una
 * persona en Cartago, no ocho. Y si asistió a dos sedes en el período cuenta en
 * las dos: para cada sede, esa persona estuvo ahí. Por eso las columnas suman
 * más que el total de personas, igual que en el reporte de servidores.
 *
 * LO QUE NO SE INVENTA:
 *  · Sin fecha de nacimiento, la persona queda FUERA del promedio de edad y se
 *    reporta aparte. Contarla como 0 años hundiría el promedio y nadie sabría
 *    por qué — en 2026 son 552 de 4.355.
 *  · Sin género, va a "sin dato". No se deduce del nombre: el padrón tiene 385
 *    personas así y adivinar en 385 casos es equivocarse en unos cuantos.
 *
 * Módulo PURO.
 */
import { calcAge } from '@/lib/format'

export type FilaCruda = {
  /** Título del evento; la sede se deriva con sedeFromTitle. */
  sede: string
  member_id: string
  birth_date: string | null
  gender: string | null
}

export type DemografiaDeSede = {
  sede: string
  /** Personas distintas que asistieron. */
  personas: number
  /** Promedio y mediana de edad. null si nadie tiene fecha de nacimiento. */
  edadPromedio: number | null
  edadMediana: number | null
  /** Cuántas quedaron fuera del cálculo de edad. */
  sinEdad: number
  mujeres: number
  hombres: number
  /** Sin el dato o con un valor que no es M ni F. */
  sinGenero: number
}

function mediana(xs: readonly number[]): number | null {
  if (!xs.length) return null
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2)
}

/** 'F' → mujer, 'M' → hombre, cualquier otra cosa (incluido 'otro') → sin dato. */
export function clasificarGenero(g: string | null | undefined): 'F' | 'M' | 'sin' {
  const v = (g ?? '').trim().toUpperCase()
  return v === 'F' || v === 'M' ? v : 'sin'
}

export function demografiaPorSede(filas: readonly FilaCruda[]): DemografiaDeSede[] {
  const porSede = new Map<string, FilaCruda[]>()
  for (const f of filas) {
    // Una persona puede venir repetida en la misma sede si el crudo trae más de
    // una fila; se deduplica por (sede, persona).
    const ya = porSede.get(f.sede)
    if (ya) ya.push(f); else porSede.set(f.sede, [f])
  }

  return [...porSede.entries()]
    .map(([sede, todas]) => {
      const unicas = new Map<string, FilaCruda>()
      for (const f of todas) if (!unicas.has(f.member_id)) unicas.set(f.member_id, f)
      const gente = [...unicas.values()]
      const edades = gente.map(g => (g.birth_date ? calcAge(g.birth_date) : 0)).filter(e => e > 0)
      const generos = gente.map(g => clasificarGenero(g.gender))
      return {
        sede,
        personas: gente.length,
        edadPromedio: edades.length ? Math.round(edades.reduce((a, b) => a + b, 0) / edades.length) : null,
        edadMediana: mediana(edades),
        sinEdad: gente.length - edades.length,
        mujeres: generos.filter(g => g === 'F').length,
        hombres: generos.filter(g => g === 'M').length,
        sinGenero: generos.filter(g => g === 'sin').length,
      }
    })
    .sort((a, b) => b.personas - a.personas)
}

/** El total del período: personas distintas, sin repetir a quien fue a dos sedes. */
export function totalDeLaDemografia(filas: readonly FilaCruda[]): DemografiaDeSede {
  const comoUna = filas.map(f => ({ ...f, sede: '' }))
  return demografiaPorSede(comoUna)[0] ?? {
    sede: '', personas: 0, edadPromedio: null, edadMediana: null,
    sinEdad: 0, mujeres: 0, hombres: 0, sinGenero: 0,
  }
}
