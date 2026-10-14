/**
 * FIN-11 · El presupuesto del viaje (ANX-02).
 *
 * Una tabla de rubros con cantidad × tarifa, y UN TOTAL POR MONEDA.
 *
 * LO QUE ESTE MÓDULO EXISTE PARA IMPEDIR es un total único. Un viaje
 * internacional tiene los pasajes en dólares y los peajes en colones, y
 * «₡180.000 + $340» no es un número: cualquier suma entre monedas inventa un
 * tipo de cambio que nadie autorizó (INT-3). Por eso `totales()` devuelve una
 * lista y no un número, y por eso no hay —ni se le agrega— una función que
 * convierta.
 *
 * Módulo PURO.
 */

/**
 * Los rubros del anexo, en su orden.
 *
 * `km` es el único que no se llena a mano: sale de la bitácora de kilometraje
 * (ANX-05, fase C) multiplicando los kilómetros por la tarifa autorizada.
 * Queda declarado desde ahora para que la fase C no tenga que tocar el CHECK.
 */
export const RUBROS = [
  'pasajes',
  'transporte_local',
  'hospedaje',
  'alimentacion',
  'inscripcion',
  'seguro',
  'peajes',
  'combustible',
  'km',
  'otros',
] as const

export type Rubro = (typeof RUBROS)[number]

export const NOMBRE_DEL_RUBRO: Readonly<Record<Rubro, string>> = {
  pasajes: 'Pasajes',
  transporte_local: 'Transporte local',
  hospedaje: 'Hospedaje',
  alimentacion: 'Alimentación',
  inscripcion: 'Inscripción',
  seguro: 'Seguro',
  peajes: 'Peajes',
  combustible: 'Combustible',
  km: 'Kilometraje',
  otros: 'Otros',
}

/**
 * Las monedas que el sistema maneja hoy. Es una lista corta a propósito:
 * aceptar texto libre acá es cómo terminan conviviendo «USD», «usd» y «$»
 * como si fueran tres monedas.
 */
export const MONEDAS = ['CRC', 'USD'] as const
export type Moneda = (typeof MONEDAS)[number]

/**
 * La tarifa por kilómetro, como PARÁMETRO y no como número suelto.
 *
 * El reglamento está en versión 1.0 y Floriana avisó que los montos pueden
 * cambiar en la versión final. Vive acá, con nombre, para que cambiarla sea
 * una línea y no una cacería; cuando haya pantalla de configuración, esto
 * pasa a ser el valor por defecto.
 */
export const TARIFA_POR_KM_CRC = 0

export type LineaDePresupuesto = {
  rubro: Rubro
  descripcion?: string | null
  cantidad: number
  tarifa: number
  moneda: Moneda
}

/**
 * El subtotal de una línea.
 *
 * Redondea a dos decimales porque `cantidad * tarifa` con flotantes deja
 * 170999.99999999997, y ese número termina impreso en un anexo que alguien
 * firma.
 */
export const subtotal = (l: Pick<LineaDePresupuesto, 'cantidad' | 'tarifa'>): number =>
  Math.round(Number(l.cantidad || 0) * Number(l.tarifa || 0) * 100) / 100

export type TotalPorMoneda = { moneda: Moneda; total: number; lineas: number }

/**
 * Los totales, uno por moneda, en el orden de `MONEDAS` y sin las monedas que
 * no se usaron. Nunca un número solo.
 */
export function totales(lineas: readonly LineaDePresupuesto[]): TotalPorMoneda[] {
  const acc = new Map<Moneda, { total: number; lineas: number }>()
  for (const l of lineas) {
    const prev = acc.get(l.moneda) ?? { total: 0, lineas: 0 }
    acc.set(l.moneda, { total: prev.total + subtotal(l), lineas: prev.lineas + 1 })
  }
  return MONEDAS
    .filter(m => acc.has(m))
    .map(m => ({ moneda: m, total: Math.round(acc.get(m)!.total * 100) / 100, lineas: acc.get(m)!.lineas }))
}

export type ProblemaDeLinea = { indice: number; mensaje: string }

/**
 * Qué hace que un presupuesto no se pueda enviar.
 *
 * Son errores del formulario, no del sistema: el mensaje lo lee quien está
 * llenando el anexo, así que dice qué arreglar y en cuál fila.
 */
export function revisarPresupuesto(lineas: readonly LineaDePresupuesto[]): ProblemaDeLinea[] {
  const problemas: ProblemaDeLinea[] = []
  lineas.forEach((l, i) => {
    if (!RUBROS.includes(l.rubro)) problemas.push({ indice: i, mensaje: 'Rubro desconocido.' })
    if (!MONEDAS.includes(l.moneda)) problemas.push({ indice: i, mensaje: 'Moneda desconocida.' })
    if (!(Number(l.cantidad) > 0)) problemas.push({ indice: i, mensaje: 'La cantidad tiene que ser mayor que cero.' })
    // La tarifa SÍ puede ser cero (un pasaje donado, un hospedaje que presta
    // la iglesia que recibe): lo que no puede es ser negativa, que sería
    // restar del total por la puerta de atrás.
    if (Number(l.tarifa) < 0) problemas.push({ indice: i, mensaje: 'La tarifa no puede ser negativa.' })
    if (!Number.isFinite(Number(l.cantidad)) || !Number.isFinite(Number(l.tarifa))) {
      problemas.push({ indice: i, mensaje: 'Cantidad y tarifa tienen que ser números.' })
    }
  })
  return problemas
}

/**
 * ¿El anticipo que se pide cabe en el presupuesto?
 *
 * Se compara contra el total DE SU MISMA MONEDA. Pedir $300 de anticipo en un
 * viaje presupuestado en colones no es un anticipo grande: es un error de
 * captura, y sin esta comparación pasaría como válido porque «300 < 180.000».
 */
export function anticipoCabe(
  anticipo: { monto: number; moneda: Moneda } | null,
  lineas: readonly LineaDePresupuesto[],
): Veredicto {
  if (!anticipo || !(anticipo.monto > 0)) return { ok: true }
  const t = totales(lineas).find(x => x.moneda === anticipo.moneda)
  if (!t) {
    return { ok: false, motivo: `El anticipo está en ${anticipo.moneda} y el presupuesto no tiene nada en esa moneda.` }
  }
  if (anticipo.monto > t.total) {
    return { ok: false, motivo: 'El anticipo no puede ser mayor que el presupuesto de su moneda.' }
  }
  return { ok: true }
}

export type Veredicto = { ok: true } | { ok: false; motivo: string }
