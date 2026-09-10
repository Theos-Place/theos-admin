/**
 * El detalle de UNA semana del reporte de asistencia.
 *
 * POR QUÉ. La pantalla muestra el año entero —gráfico semanal, promedio,
 * semana pico— y al tocar una semana no había forma de ver solo esa. La
 * pregunta real de quien mira el reporte es "¿cómo nos fue esta semana, sede
 * por sede?", y eso no se contesta con un acumulado.
 *
 * Los datos ya estaban: el agregado viene por (año, título, semana), y el
 * título ES la sede. Lo único que hubo que sumar a la base fue el corte
 * asistente/servidor (migración 20260910090000).
 *
 * Módulo PURO: acá vive la aritmética y las comparaciones, sin React ni
 * Supabase.
 */
import { sedeFromTitle, type CharlaAggRow } from '@/lib/reports/charla-attendance'

/** Fila del agregado con la calidad del check-in. */
export type FilaConCalidad = CharlaAggRow & { calidad?: string | null }

export type SedeEnLaSemana = {
  sede: string
  total: number
  asistentes: number
  servidores: number
}

export type Comparacion = {
  /** Total con el que se compara. null = no hay ese período en los datos. */
  total: number | null
  delta: number | null
  pct: number | null
}

export type DetalleDeSemana = {
  year: number
  week: number
  /** "2026-W37" — lo que va en la URL. */
  clave: string
  total: number
  asistentes: number
  servidores: number
  porSede: SedeEnLaSemana[]
  /** La semana anterior del MISMO año. */
  vsSemanaAnterior: Comparacion
  /** La misma semana del año pasado. */
  vsAnoPasado: Comparacion
  /**
   * La semana todavía no terminó. Se marca para que nadie compare media
   * semana contra semanas completas sin darse cuenta — es el mismo cuidado
   * que ya tiene el gráfico anual con sus semanas parciales.
   */
  enCurso: boolean
}

/** "2026-W37". Con el cero adelante para que ordene como texto. */
export function claveDeSemana(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Lee "2026-W37". null si no se entiende — la URL la escribe cualquiera. */
export function leerClaveDeSemana(clave: string | null | undefined): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec((clave ?? '').trim())
  if (!m) return null
  const year = Number(m[1])
  const week = Number(m[2])
  if (week < 1 || week > 53) return null
  return { year, week }
}

/** Semana ISO de una fecha, en hora de Costa Rica. */
export function semanaISO(fecha: Date): { year: number; week: number } {
  const cr = new Date(fecha.toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }))
  const d = new Date(Date.UTC(cr.getFullYear(), cr.getMonth(), cr.getDate()))
  // Jueves de esa semana: el año ISO es el año de su jueves.
  const dia = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dia)
  const eneUno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - eneUno.getTime()) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

function comparar(actual: number, otro: number | null): Comparacion {
  if (otro === null) return { total: null, delta: null, pct: null }
  const delta = actual - otro
  return { total: otro, delta, pct: otro === 0 ? null : Math.round((delta / otro) * 1000) / 10 }
}

/** Total de una semana, o null si esa semana no existe en los datos. */
function totalDe(filas: readonly FilaConCalidad[], year: number, week: number): number | null {
  const suyas = filas.filter(f => f.yr === year && f.wk === week)
  if (suyas.length === 0) return null
  return suyas.reduce((n, f) => n + Number(f.checkins), 0)
}

/**
 * @param sede  filtra a una sede, o 'all'.
 * @param hoy   para decidir si la semana está en curso.
 */
export function detalleDeSemana(
  filas: readonly FilaConCalidad[],
  year: number,
  week: number,
  opts: { sede?: string; hoy?: Date } = {},
): DetalleDeSemana | null {
  const sedeFiltro = opts.sede && opts.sede !== 'all' ? opts.sede : null
  const hoy = opts.hoy ?? new Date()

  const conSede = filas.map(f => ({ ...f, sede: sedeFromTitle(f.title) }))
  const delFiltro = sedeFiltro ? conSede.filter(f => f.sede === sedeFiltro) : conSede
  const suyas = delFiltro.filter(f => f.yr === year && f.wk === week)
  // Sin ninguna fila esa semana no existe en los datos: se devuelve null en
  // vez de una pantalla de ceros, que se leería como "no vino nadie".
  if (suyas.length === 0) return null

  const porSede = new Map<string, SedeEnLaSemana>()
  for (const f of suyas) {
    const e = porSede.get(f.sede) ?? { sede: f.sede, total: 0, asistentes: 0, servidores: 0 }
    const n = Number(f.checkins)
    e.total += n
    if (f.calidad === 'servidor') e.servidores += n
    else e.asistentes += n            // sin dato = asistente, igual que la base
    porSede.set(f.sede, e)
  }
  const lista = [...porSede.values()].sort((a, b) => b.total - a.total || a.sede.localeCompare(b.sede))
  const total = lista.reduce((n, s) => n + s.total, 0)

  const actual = semanaISO(hoy)
  const enCurso = year === actual.year && week === actual.week

  return {
    year, week, clave: claveDeSemana(year, week),
    total,
    asistentes: lista.reduce((n, s) => n + s.asistentes, 0),
    servidores: lista.reduce((n, s) => n + s.servidores, 0),
    porSede: lista,
    // La semana 1 no tiene "semana anterior" dentro del mismo año: se deja en
    // null en vez de buscar la 52 del año pasado, que es otra comparación.
    vsSemanaAnterior: comparar(total, week > 1 ? totalDe(delFiltro, year, week - 1) : null),
    vsAnoPasado: comparar(total, totalDe(delFiltro, year - 1, week)),
    enCurso,
  }
}
