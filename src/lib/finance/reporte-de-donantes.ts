/**
 * DON-3 parte B · Donantes y montos, por mes, por año y por sede.
 *
 * VIVE EN FINANZAS Y NO EN /reportes, a propósito: los montos de donación son
 * confidenciales y /reportes lo abren roles de métricas. Acá el gate es
 * `FinanceGuard` — finanzas, dirección y admin.
 *
 * LAS TRES REGLAS QUE DEFINEN ESTE REPORTE:
 *
 * 1 · UN DONANTE ES UNA PERSONA, no una donación. Quien donó 30 veces en el
 *     año cuenta UNA vez. Es la diferencia entre «768 personas sostienen
 *     esto» y «1 980 depósitos entraron», y la primera es la que se usa para
 *     decidir.
 *
 * 2 · LOS TOTALES VAN POR MONEDA Y JAMÁS SUMADOS (INT-3). Un número que
 *     mezcle colones con euros no es un número: es un error con apariencia de
 *     número. Hay 23 donaciones en EUR en producción (medido el 2026-10-05).
 *
 * 3 · LOS DONANTES SIN SEDE SON UNA CATEGORÍA VISIBLE, no un residuo que se
 *     esconde. Son 250 de 1 882, y a Meli le interesa identificarlos
 *     justamente porque no aparecen por ninguna charla.
 *
 * LA SEDE ES LA CALCULADA DEL SISTEMA (`members.sede_id`), y su ventana —hoy,
 * asistencia del último año— NO se toca acá: está pendiente de revisión con
 * don Luis, y cambiarla de paso movería los números de todos los reportes.
 *
 * Módulo PURO: la base trae las filas y acá se cuentan.
 */

export type DonacionParaReporte = {
  member_id: string | null
  /** `YYYY-MM-DD`. */
  donation_date: string
  /** `null` cuando la donación no tiene monto registrado. */
  amount: number | null
  currency: string | null
  /** La sede calculada del donante; `null` si no tiene. */
  sede: string | null
}

/** Donantes sin sede: etiqueta única, para que no se confunda con una sede. */
export const SIN_SEDE = 'Sin sede'

/** Totales por moneda. Nunca un total único. */
export type PorMoneda = Record<string, number>

export type Agregado = {
  /** Personas distintas que donaron. */
  donantes: number
  /** Cuántas donaciones entraron. No es lo mismo que donantes. */
  donaciones: number
  totales: PorMoneda
  /**
   * Donaciones sin monto registrado.
   *
   * Cuenta las nulas Y LAS QUE VALEN CERO: una donación de ₡0 no es una
   * donación, es un dato sin cargar. Medido el 2026-10-05, en producción son
   * las 15 276 —los importes todavía no se importaron—, así que sin esto el
   * reporte diría «₡0» y se leería como «nadie donó».
   */
  sinMonto: number
}

const vacio = (): Agregado => ({ donantes: 0, donaciones: 0, totales: {}, sinMonto: 0 })

/** La moneda de una fila. Lo histórico sin moneda es CRC, que es lo que es. */
function monedaDe(d: DonacionParaReporte): string {
  return d.currency?.trim() || 'CRC'
}

/**
 * ¿Esta fila trae un monto de verdad?
 *
 * CERO NO CUENTA, y esto lo descubrí probando contra producción: las 15 276
 * donaciones tienen `amount = 0.00`, no `null`. Con el chequeo obvio
 * —`typeof amount === 'number'`— el reporte daba `hayMontos: true` y un
 * total de «₡0», que es exactamente la mentira que este módulo existe para
 * evitar. Los tests con datos inventados no lo agarraron porque yo escribí
 * `null` para «sin monto»; la base escribe `0`.
 *
 * Y una donación de cero colones no es una donación: donde hay un 0 lo que
 * hay es un dato que todavía no se cargó.
 */
function tieneMonto(d: DonacionParaReporte): boolean {
  return typeof d.amount === 'number' && d.amount > 0
}

function acumular(a: Agregado, d: DonacionParaReporte, personas: Set<string>): void {
  a.donaciones += 1
  if (d.member_id) personas.add(d.member_id)
  if (tieneMonto(d)) {
    const m = monedaDe(d)
    a.totales[m] = (a.totales[m] ?? 0) + (d.amount as number)
  } else {
    a.sinMonto += 1
  }
}

/** Agrupa por una llave cualquiera, contando donantes únicos dentro de cada grupo. */
function agrupar(
  filas: readonly DonacionParaReporte[],
  llave: (d: DonacionParaReporte) => string | null,
): Map<string, Agregado> {
  const acc = new Map<string, { a: Agregado; personas: Set<string> }>()
  for (const d of filas) {
    const k = llave(d)
    if (k === null) continue
    const e = acc.get(k) ?? { a: vacio(), personas: new Set<string>() }
    acumular(e.a, d, e.personas)
    acc.set(k, e)
  }
  const out = new Map<string, Agregado>()
  for (const [k, e] of acc) out.set(k, { ...e.a, donantes: e.personas.size })
  return out
}

export type FilaDePeriodo = { periodo: string } & Agregado
export type FilaDeSede = { sede: string } & Agregado

/**
 * OJO AL LEER ESTE REPORTE: los DONANTES de los grupos NO suman el total.
 *
 * Una persona que donó en marzo y en agosto cuenta en los dos meses, y una
 * sola vez en el total. Es correcto —son donantes únicos POR grupo— pero
 * invita a restar y encontrar un descuadre que no existe. Los MONTOS sí
 * suman; los donantes no.
 */
export type ReporteDeDonantes = {
  /** El total del rango completo. */
  total: Agregado
  /** Por año, del más nuevo al más viejo. */
  porAnio: FilaDePeriodo[]
  /** Por mes (`YYYY-MM`), del más nuevo al más viejo. */
  porMes: FilaDePeriodo[]
  /** Por sede del donante, de mayor a menor. «Sin sede» va al final. */
  porSede: FilaDeSede[]
  /** ¿Hay AL MENOS un monto registrado en todo el rango? */
  hayMontos: boolean
}

export function construirReporteDeDonantes(
  filas: readonly DonacionParaReporte[],
): ReporteDeDonantes {
  const personas = new Set<string>()
  const total = vacio()
  for (const d of filas) acumular(total, d, personas)
  total.donantes = personas.size

  const aFilas = (m: Map<string, Agregado>): FilaDePeriodo[] =>
    [...m.entries()]
      .map(([periodo, a]) => ({ periodo, ...a }))
      .sort((x, y) => y.periodo.localeCompare(x.periodo))

  const porSede = [...agrupar(filas, d => d.sede?.trim() || SIN_SEDE).entries()]
    .map(([sede, a]) => ({ sede, ...a }))
    // «Sin sede» SIEMPRE al final aunque sea el grupo más grande: es una
    // categoría de otro tipo, no una sede más, y mezclarla en el orden la
    // haría parecer una.
    .sort((a, b) => {
      if (a.sede === SIN_SEDE) return 1
      if (b.sede === SIN_SEDE) return -1
      return b.donantes - a.donantes || a.sede.localeCompare(b.sede, 'es')
    })

  return {
    total,
    porAnio: aFilas(agrupar(filas, d => d.donation_date?.slice(0, 4) || null)),
    porMes: aFilas(agrupar(filas, d => d.donation_date?.slice(0, 7) || null)),
    porSede,
    hayMontos: Object.keys(total.totales).length > 0,
  }
}

/**
 * Los totales en una línea: «₡1.250.000 + €300».
 *
 * Nunca produce un total único. Si no hay ningún monto devuelve cadena vacía
 * para que la pantalla diga que faltan, en vez de escribir un «₡0» que se
 * leería como que no entró plata.
 */
export function totalesEnTexto(
  totales: PorMoneda,
  formato: (monto: number, moneda: string) => string,
): string {
  return Object.entries(totales)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moneda, monto]) => formato(monto, moneda))
    .join(' + ')
}
