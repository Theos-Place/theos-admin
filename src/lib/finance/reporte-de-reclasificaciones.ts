/**
 * FIN-9 · El reporte de RECLASIFICACIONES.
 *
 * POR QUÉ EXISTE. Cada crédito emitido al congelar una matrícula es, en
 * contabilidad, una reclasificación: la plata ya entró en un rubro —la
 * matrícula de un estudio— y va a salir en otro, el día que la persona la
 * use. Sin este reporte, finanzas ve dos movimientos sueltos que no se
 * pueden emparejar, y en QuickBooks quedan como un ingreso y un descuento
 * que no cuadran con nada.
 *
 * LA FILA ES EL VIAJE COMPLETO, que fue lo que pidió Meli: persona, pago de
 * origen, rubro de origen, crédito, dónde y cuándo se usó, rubro destino.
 * Un crédito sin usar también sale —con el destino vacío— porque es plata
 * que Theos tiene y debe.
 *
 * Módulo PURO: arma y resume. Quien lee la base es la query.
 */

export type FilaDeReclasificacion = {
  persona: string
  /** Cuándo se emitió el crédito (YYYY-MM-DD, hora de Costa Rica). */
  emitido: string
  monto: number
  currency: string
  /** De qué pago salió. */
  pago_origen: string | null
  /** El rubro de donde salió: el estudio o la actividad que se congeló. */
  rubro_origen: string
  motivo: string
  /** YYYY-MM-DD, o null si todavía no lo usó. */
  usado: string | null
  /** Dónde lo usó. Null mientras no lo use. */
  rubro_destino: string | null
  /** 'active' | 'used' | 'revoked'. */
  estado: string
  vence: string | null
}

/** El estado en palabras, para la columna que lee finanzas. */
export function situacionDelCredito(f: Pick<FilaDeReclasificacion, 'estado' | 'usado' | 'vence'>, hoy: string): string {
  if (f.estado === 'revoked') return 'Anulado'
  if (f.estado === 'used' || f.usado) return 'Usado'
  if (f.vence && f.vence.slice(0, 10) < hoy.slice(0, 10)) return 'Vencido sin usar'
  return 'Pendiente de usar'
}

export type ResumenDeReclasificaciones = {
  /** Por MONEDA, nunca sumadas entre sí (INT-3). */
  porMoneda: Array<{
    currency: string
    emitido: number
    usado: number
    /** Lo que Theos todavía DEBE: emitido y sin usar, sin vencer. */
    pendiente: number
    vencido: number
  }>
  creditos: number
}

/**
 * Los totales, SIEMPRE por moneda.
 *
 * Sumar colones con dólares da un número que no significa nada, y en un
 * reporte contable ese número se copia a otro lado (INT-3).
 */
export function resumirReclasificaciones(
  filas: readonly FilaDeReclasificacion[],
  hoy: string,
): ResumenDeReclasificaciones {
  const m = new Map<string, { currency: string; emitido: number; usado: number; pendiente: number; vencido: number }>()
  for (const f of filas) {
    const e = m.get(f.currency) ?? { currency: f.currency, emitido: 0, usado: 0, pendiente: 0, vencido: 0 }
    const monto = Number(f.monto) || 0
    e.emitido += monto
    const situacion = situacionDelCredito(f, hoy)
    if (situacion === 'Usado') e.usado += monto
    else if (situacion === 'Vencido sin usar') e.vencido += monto
    else if (situacion === 'Pendiente de usar') e.pendiente += monto
    m.set(f.currency, e)
  }
  return {
    porMoneda: [...m.values()].sort((a, z) => a.currency.localeCompare(z.currency)),
    creditos: filas.length,
  }
}

/** El rango de un mes o de un año, en hora de Costa Rica. */
export function rangoDelPeriodo(input: { anio: number; mes?: number | null }): { desde: string; hasta: string } {
  const { anio, mes } = input
  if (mes && mes >= 1 && mes <= 12) {
    const fin = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
    const mm = String(mes).padStart(2, '0')
    return {
      desde: `${anio}-${mm}-01T00:00:00.000-06:00`,
      hasta: `${anio}-${mm}-${String(fin).padStart(2, '0')}T23:59:59.999-06:00`,
    }
  }
  return {
    desde: `${anio}-01-01T00:00:00.000-06:00`,
    hasta: `${anio}-12-31T23:59:59.999-06:00`,
  }
}
