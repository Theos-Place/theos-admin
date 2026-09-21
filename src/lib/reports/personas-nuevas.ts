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
import { SEMANAS_DE_CORTE } from '@/lib/reports/abandonos'

/**
 * Cuántas semanas se le dan a alguien para volver.
 *
 * Es EL MISMO corte que usa REP-5 para decir que alguien dejó de venir
 * (decisión del usuario 2026-09-21: eran 8 y pasaron a 5). Se importa en vez de
 * escribir el número: los dos reportes se miran juntos y dos ventanas distintas
 * para la misma idea obligan a recordar cuál aplica en cuál pantalla.
 *
 * El 35 correspondiente vive en la función `report_personas_nuevas` — SQL no
 * puede importar esto, así que el comentario de la migración apunta acá.
 */
export const SEMANAS_PARA_VOLVER = SEMANAS_DE_CORTE

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
  /** Volvió a una charla dentro de las `SEMANAS_PARA_VOLVER` siguientes. */
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

export type FilaDeSerie = { anio: number; mes: number; canal: string; origen: string | null; n: number }

export type PuntoDeSerie = { periodo: string; etiqueta: string; n: number }

/**
 * REP-10 · El filtro de charla/sede se aplica acá, sobre la MISMA serie que
 * alimenta los dos gráficos.
 *
 * Antes el filtro solo llegaba a la tabla de detalle, porque el agregado de los
 * gráficos no tenía la dimensión del origen: al filtrar cambiaba la tabla y los
 * gráficos se quedaban igual, mostrando dos universos distintos en la misma
 * pantalla.
 */
export function filtrarSerie(
  filas: readonly FilaDeSerie[],
  f: { origen?: string; canal?: Canal | '' } = {},
): FilaDeSerie[] {
  return filas.filter(x => {
    if (f.origen && x.origen !== f.origen) return false
    if (f.canal && x.canal !== f.canal) return false
    return true
  })
}

/** Los orígenes que existen en la serie, para el selector. Solo los de CHARLA:
 *  los estudios los cubre el selector de canal con una sola opción. */
export function origenesDeCharla(filas: readonly FilaDeSerie[]): string[] {
  return [...new Set(filas.filter(x => x.canal === 'charla').map(x => x.origen).filter((o): o is string => !!o))]
    .sort((a, b) => a.localeCompare(b, 'es'))
}

export type BarraAnualPorCanal = {
  periodo: string
  etiqueta: string
  n: number
  charla: number
  estudio: number
  evento: number
}

/** Por año y partido por canal de entrada, para las barras apiladas. */
export function serieAnualPorCanal(
  filas: readonly FilaDeSerie[],
  desde = 2020,
): BarraAnualPorCanal[] {
  const porAnio = new Map<number, BarraAnualPorCanal>()
  for (const f of filas) {
    if (f.anio < desde) continue
    const ya = porAnio.get(f.anio) ?? {
      periodo: String(f.anio), etiqueta: String(f.anio), n: 0, charla: 0, estudio: 0, evento: 0,
    }
    ya.n += f.n
    if (f.canal === 'estudio') ya.estudio += f.n
    else if (f.canal === 'evento') ya.evento += f.n
    // Cualquier cosa que no sea estudio ni evento cuenta como charla: es el
    // canal por defecto y un valor raro no debe desaparecer del gráfico.
    else ya.charla += f.n
    porAnio.set(f.anio, ya)
  }
  return [...porAnio.values()].sort((a, b) => Number(a.periodo) - Number(b.periodo))
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

/** Los años que aparecen en los datos, del más nuevo al más viejo. */
export function aniosDeLaSerie(filas: readonly { anio: number }[], desde = 2020): number[] {
  return [...new Set(filas.map(f => f.anio).filter(a => a >= desde))].sort((a, b) => b - a)
}

/**
 * Los 12 meses de UN año, incluidos los que no tuvieron a nadie.
 *
 * Un hueco en el gráfico se lee como "no hay dato", y cero es un dato. Los doce
 * van siempre aunque el año esté en curso: ver que octubre, noviembre y
 * diciembre están vacíos porque todavía no llegaron es parte de leer el año.
 */
export function serieDelAnio(
  filas: readonly { anio: number; mes: number; n: number }[],
  anio: number,
): PuntoDeSerie[] {
  const porMes = new Map<number, number>()
  for (const f of filas) {
    if (f.anio !== anio) continue
    porMes.set(f.mes, (porMes.get(f.mes) ?? 0) + f.n)
  }
  return MESES_CORTOS.map((etiqueta, i) => ({
    periodo: `${anio}-${String(i + 1).padStart(2, '0')}`,
    etiqueta,
    n: porMes.get(i + 1) ?? 0,
  }))
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
