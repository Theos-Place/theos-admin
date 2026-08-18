// BLQ-1 · Geometría del calendario anual de bloques. Puro: la vista solo pinta
// lo que sale de acá, y esto se puede testear sin DOM.
//
// Las fechas y los hitos NO se recalculan: salen de bloqueMilestones (bloques.ts),
// que es donde vive la regla (preliminar = apertura − 3 semanas, confirmación =
// apertura − 2 semanas, final = cierre de matrícula).
import { bloqueMilestones, bloqueCierre, type BloqueMilestone } from '@/lib/studies/bloques'

export const MESES_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const

export type BloqueLite = {
  id: string
  nombre: string
  anio: number
  fecha_apertura: string
  fecha_cierre_matricula: string
}

/** Días del año (366 en bisiesto): el ancho de la línea de tiempo. */
export function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365
}

/** Día del año (0-based) de una fecha YYYY-MM-DD. null si no es válida. */
export function dayOfYear(iso: string, year: number): number | null {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const inicio = new Date(`${year}-01-01T00:00:00`)
  return Math.round((d.getTime() - inicio.getTime()) / 86_400_000)
}

/** Posición 0–100 de una fecha sobre la línea del año. Fuera del año devuelve
 *  null: lo que no cae en el año no se pinta (no se estira ni se recorta a 0). */
export function positionInYear(iso: string, year: number): number | null {
  const dia = dayOfYear(iso, year)
  if (dia == null) return null
  const total = daysInYear(year)
  if (dia < 0 || dia > total) return null
  return (dia / total) * 100
}

/** Inicio de cada mes en porcentaje, para dibujar la grilla. */
export function monthTicks(year: number): Array<{ mes: string; pct: number }> {
  const total = daysInYear(year)
  return MESES_ES.map((mes, i) => ({
    mes,
    pct: ((dayOfYear(`${year}-${String(i + 1).padStart(2, '0')}-01`, year) ?? 0) / total) * 100,
  }))
}

export type BloqueBar = {
  id: string
  nombre: string
  /** Extremos de la barra en % del año, ya recortados al año visible. */
  leftPct: number
  widthPct: number
  /** true = el bloque empieza antes / termina después del año que se mira. */
  cortadoAlInicio: boolean
  cortadoAlFinal: boolean
  /** Ventana de matrícula (primer folleto → cierre) DENTRO de la barra, en %
   *  relativos a la barra (0–100). null si no toca el año visible. */
  matricula: { leftPct: number; widthPct: number } | null
  hitos: Array<{ key: BloqueMilestone | 'apertura' | 'cierre_bloque'; label: string; fecha: string; pct: number }>
}

const HITO_LABEL: Record<BloqueMilestone | 'apertura' | 'cierre_bloque', string> = {
  preliminar: 'Folleto preliminar',
  confirmacion: 'Folleto de confirmación',
  apertura: 'Apertura del bloque',
  final: 'Cierre de matrícula (folleto final)',
  cierre_bloque: 'Cierre del bloque',
}

/** La barra de un bloque sobre el año: del PRIMER hito (folleto preliminar,
 *  3 semanas antes de abrir) al CIERRE DEL BLOQUE (cierre de matrícula +
 *  3 meses — el bloque dura ~3.5 meses). La ventana de matrícula
 *  (preliminar → cierre de matrícula) sale aparte, como tramo resaltado.
 *  Devuelve null si el bloque no toca el año que se está viendo. */
export function bloqueBar(b: BloqueLite, year: number): BloqueBar | null {
  const hitos = bloqueMilestones(b.fecha_apertura, b.fecha_cierre_matricula)
  const inicio = hitos.preliminar
  const fin = bloqueCierre(b.fecha_cierre_matricula)

  const iniDia = dayOfYear(inicio, year)
  const finDia = dayOfYear(fin, year)
  if (iniDia == null || finDia == null) return null
  const total = daysInYear(year)
  // Sin intersección con el año → no se pinta.
  if (finDia < 0 || iniDia > total) return null

  const desde = Math.max(0, iniDia)
  const hasta = Math.min(total, finDia)
  const leftPct = (desde / total) * 100
  // Ancho mínimo visible: un bloque de pocos días igual tiene que verse.
  const widthPct = Math.max(((hasta - desde) / total) * 100, 0.8)

  // Ventana de matrícula recortada al año, en % RELATIVOS a la barra.
  let matricula: BloqueBar['matricula'] = null
  const matIni = dayOfYear(inicio, year)
  const matFin = dayOfYear(b.fecha_cierre_matricula, year)
  if (matIni != null && matFin != null && matFin >= 0 && matIni <= total && hasta > desde) {
    const mDesde = Math.max(desde, matIni)
    const mHasta = Math.min(hasta, matFin)
    if (mHasta > mDesde) {
      matricula = {
        leftPct: ((mDesde - desde) / (hasta - desde)) * 100,
        widthPct: ((mHasta - mDesde) / (hasta - desde)) * 100,
      }
    }
  }

  const marcas: BloqueBar['hitos'] = []
  for (const [key, fecha] of [
    ['preliminar', hitos.preliminar],
    ['confirmacion', hitos.confirmacion],
    ['apertura', b.fecha_apertura],
    ['final', hitos.final],
    ['cierre_bloque', fin],
  ] as Array<[BloqueMilestone | 'apertura' | 'cierre_bloque', string]>) {
    const pct = positionInYear(fecha, year)
    if (pct != null) marcas.push({ key, label: HITO_LABEL[key], fecha, pct })
  }

  return {
    id: b.id,
    nombre: b.nombre,
    leftPct,
    widthPct,
    cortadoAlInicio: iniDia < 0,
    cortadoAlFinal: finDia > total,
    matricula,
    hitos: marcas,
  }
}

/** Años con al menos un bloque, más el año actual, de mayor a menor. Es lo que
 *  ofrece el selector: años sin nada no se ofrecen. */
export function availableYears(bloques: Array<{ anio: number }>, currentYear: number): number[] {
  const set = new Set<number>([currentYear, ...bloques.map(b => b.anio)])
  return [...set].sort((a, b) => b - a)
}

/** Colores de barra, en orden estable: el mismo bloque conserva su color entre
 *  recargas porque el índice sale del orden por fecha. */
export const BAR_COLORS = [
  { bar: 'bg-coral/70', border: 'border-coral', text: 'text-coral-deep' },
  { bar: 'bg-teal-deep/60', border: 'border-teal-deep', text: 'text-teal-deep' },
  { bar: 'bg-navy/60', border: 'border-navy', text: 'text-navy' },
  { bar: 'bg-amber-400/70', border: 'border-amber-500', text: 'text-amber-700' },
] as const

export function colorFor(index: number) {
  return BAR_COLORS[index % BAR_COLORS.length]
}

/** Ventanas de matrícula de los grupos (GRU-1) que caen en el año. Se pintan en
 *  su propio carril, debajo de los bloques. */
export type VentanaGrupo = {
  id: string
  nombre: string
  desde: string
  hasta: string
}

export function ventanaBar(v: VentanaGrupo, year: number): { leftPct: number; widthPct: number } | null {
  const ini = dayOfYear(v.desde, year)
  const fin = dayOfYear(v.hasta, year)
  if (ini == null || fin == null) return null
  const total = daysInYear(year)
  if (fin < 0 || ini > total) return null
  const desde = Math.max(0, ini)
  const hasta = Math.min(total, fin)
  return {
    leftPct: (desde / total) * 100,
    widthPct: Math.max(((hasta - desde) / total) * 100, 0.5),
  }
}
