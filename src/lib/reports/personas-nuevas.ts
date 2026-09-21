/**
 * REP-6 · Personas nuevas: quién entró, por dónde y si se quedó.
 *
 * "Nueva" = su PRIMERA ACTIVIDAD cae en el período. Primera actividad es la más
 * antigua entre el primer check-in a charla, la primera matrícula y la primera
 * inscripción a un evento.
 *
 * NO es la fecha de creación de la ficha, y la diferencia no es teórica:
 * medido el 2026-09-21, hay **9.181 fichas sin ninguna actividad** —en su
 * mayoría de la migración de 23k de CCB— que con el criterio viejo aparecerían
 * como "personas nuevas" el día del import. Una ficha no es una persona que
 * llegó.
 *
 * Al revés sí cuenta: las asistencias y matrículas MIGRADAS son actividad real
 * de esa persona en su fecha real. Lo que no cuenta es el import en sí.
 *
 * Módulo PURO: la base trae las filas y acá se arman los números.
 */
import { calcAge } from '@/lib/format'

export type Canal = 'charla' | 'estudio' | 'evento'

export const ETIQUETA_DE_CANAL: Record<Canal, string> = {
  charla: 'Charla',
  estudio: 'Estudio',
  evento: 'Evento',
}

export type PersonaNueva = {
  member_id: string
  nombre: string
  birth_date: string | null
  phone: string | null
  /** Fecha de la primera actividad. */
  fecha: string
  canal: Canal
  /** Dónde fue esa primera vez: la charla, el estudio o el evento. */
  origen: string
  /** Volvió a una charla dentro de las 8 semanas siguientes. */
  volvio: boolean
  /** Se matriculó en algún estudio después de esa primera vez. */
  seMatriculo: boolean
  esServidor: boolean
}

export type ResumenDeNuevos = {
  total: number
  /** Promedio y mediana de edad. null si NADIE tiene fecha de nacimiento. */
  edadPromedio: number | null
  edadMediana: number | null
  /** Cuántos quedaron fuera del cálculo de edad por no tener fecha. */
  sinEdad: number
  servidores: number
  volvieron: number
  seMatricularon: number
  /** Porcentajes sobre el total, redondeados. null si no hay nadie. */
  pctVolvieron: number | null
  pctSeMatricularon: number | null
  porCanal: Array<{ canal: Canal; n: number }>
}

function mediana(xs: readonly number[]): number | null {
  if (!xs.length) return null
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2)
}

function pct(parte: number, total: number): number | null {
  return total === 0 ? null : Math.round((parte / total) * 100)
}

/**
 * Los KPIs del período.
 *
 * Quien no tiene fecha de nacimiento queda FUERA del promedio y la mediana, y
 * se reporta aparte. Contarlo como 0 años hundiría el promedio —en agosto de
 * 2026 son 36 de 204— y nadie sabría por qué la edad promedio dice 19.
 */
export function resumenDeNuevos(personas: readonly PersonaNueva[]): ResumenDeNuevos {
  const edades = personas
    .map(p => (p.birth_date ? calcAge(p.birth_date) : 0))
    .filter(e => e > 0)
  const volvieron = personas.filter(p => p.volvio).length
  const seMatricularon = personas.filter(p => p.seMatriculo).length

  const canales = new Map<Canal, number>()
  for (const p of personas) canales.set(p.canal, (canales.get(p.canal) ?? 0) + 1)

  return {
    total: personas.length,
    edadPromedio: edades.length ? Math.round(edades.reduce((a, b) => a + b, 0) / edades.length) : null,
    edadMediana: mediana(edades),
    sinEdad: personas.length - edades.length,
    servidores: personas.filter(p => p.esServidor).length,
    volvieron,
    seMatricularon,
    pctVolvieron: pct(volvieron, personas.length),
    pctSeMatricularon: pct(seMatricularon, personas.length),
    porCanal: (['charla', 'estudio', 'evento'] as Canal[])
      .map(canal => ({ canal, n: canales.get(canal) ?? 0 }))
      .filter(x => x.n > 0),
  }
}

export type FiltrosDeNuevos = {
  /** Origen exacto de la primera vez (la charla/sede). '' = todas. */
  origen?: string
  canal?: Canal | ''
  edadMin?: number | null
  edadMax?: number | null
  /** true = solo servidores, false = solo no servidores, null = todos. */
  servidor?: boolean | null
}

/**
 * Filtra el detalle. Sin fecha de nacimiento, un filtro de edad DEJA FUERA a la
 * persona: no se puede afirmar que tenga entre 18 y 25 si no se sabe. Se ve en
 * el conteo, que baja, y por eso el resumen reporta cuántos no tienen edad.
 */
export function filtrarNuevos(
  personas: readonly PersonaNueva[],
  f: FiltrosDeNuevos,
): PersonaNueva[] {
  return personas.filter(p => {
    if (f.origen && p.origen !== f.origen) return false
    if (f.canal && p.canal !== f.canal) return false
    if (f.servidor !== null && f.servidor !== undefined && p.esServidor !== f.servidor) return false
    if (f.edadMin != null || f.edadMax != null) {
      const edad = p.birth_date ? calcAge(p.birth_date) : 0
      if (!edad) return false
      if (f.edadMin != null && edad < f.edadMin) return false
      if (f.edadMax != null && edad > f.edadMax) return false
    }
    return true
  })
}

export type PuntoDeSerie = { periodo: string; etiqueta: string; n: number }

/** Los últimos `meses` meses, incluyendo los que no tuvieron a nadie: un hueco
 *  en el gráfico se lee como "no hay dato", y cero es un dato. */
export function serieMensual(
  filas: readonly { anio: number; mes: number; n: number }[],
  hasta: Date,
  meses = 24,
): PuntoDeSerie[] {
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
  const porClave = new Map<string, number>()
  for (const f of filas) {
    const k = `${f.anio}-${String(f.mes).padStart(2, '0')}`
    porClave.set(k, (porClave.get(k) ?? 0) + f.n)
  }
  const puntos: PuntoDeSerie[] = []
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth() - i, 1))
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    puntos.push({ periodo: k, etiqueta: `${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, n: porClave.get(k) ?? 0 })
  }
  return puntos
}

/** Por año, de menor a mayor. Solo los años que existen en los datos. */
export function serieAnual(
  filas: readonly { anio: number; n: number }[],
  desde = 2020,
): PuntoDeSerie[] {
  const porAnio = new Map<number, number>()
  for (const f of filas) {
    if (f.anio < desde) continue
    porAnio.set(f.anio, (porAnio.get(f.anio) ?? 0) + f.n)
  }
  return [...porAnio.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([anio, n]) => ({ periodo: String(anio), etiqueta: String(anio), n }))
}
