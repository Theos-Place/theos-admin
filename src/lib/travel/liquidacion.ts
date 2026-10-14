/**
 * FIN-11 · La liquidación del viaje (ANX-03), fase B.
 *
 * Al volver: qué se gastó de verdad, contra qué anticipo se recibió, y quién
 * le debe a quién.
 *
 * LA CUENTA ES POR MONEDA Y NO SE NEGOCIA. Alguien que recibió $200 de
 * anticipo y gastó ₡150.000 no «quedó debiendo ₡50.000 menos»: debe los $200
 * y la Asociación le debe los ₡150.000, cada cosa por su lado. Mezclarlas
 * inventa un tipo de cambio que nadie autorizó (INT-3) y deja un asiento
 * contable que no cuadra con el estado de cuenta.
 *
 * Módulo PURO.
 */
import { MONEDAS, type Moneda, type Rubro } from './presupuesto'

export type GastoEjecutado = {
  fecha: string
  rubro: Rubro
  proveedor?: string | null
  numero_comprobante?: string | null
  monto: number
  moneda: Moneda
  /** Ruta del comprobante en el bucket privado. */
  receipt_path?: string | null
}

export type SaldoDeLiquidacion = {
  moneda: Moneda
  gastado: number
  anticipo: number
  /** > 0 → la persona devuelve; < 0 → la Asociación le reembolsa; 0 → a mano. */
  diferencia: number
  /** Lo mismo dicho en palabras, que es lo que lee quien no hace la resta. */
  resultado: 'reintegrar' | 'reembolsar' | 'cuadra'
}

// El `+ 0` normaliza el CERO NEGATIVO. `Math.round(-0.000001 * 100) / 100` da
// -0, y una liquidación que cuadra mostraría «-0» en la pantalla y en el
// anexo impreso. `-0 + 0` es 0.
const r2 = (n: number) => Math.round(n * 100) / 100 + 0

/**
 * El saldo, una fila por moneda.
 *
 * Aparece una moneda si hubo gasto EN ella o anticipo EN ella: un anticipo en
 * dólares que no se gastó tiene que salir en la cuenta, no desaparecer porque
 * no hubo tiquetes en esa moneda.
 */
export function saldos(
  gastos: readonly GastoEjecutado[],
  anticipo: { monto: number; moneda: Moneda } | null,
): SaldoDeLiquidacion[] {
  const porMoneda = new Map<Moneda, { gastado: number; anticipo: number }>()
  const tocar = (m: Moneda) => {
    if (!porMoneda.has(m)) porMoneda.set(m, { gastado: 0, anticipo: 0 })
    return porMoneda.get(m)!
  }
  for (const g of gastos) tocar(g.moneda).gastado += Number(g.monto || 0)
  if (anticipo && anticipo.monto > 0) tocar(anticipo.moneda).anticipo += Number(anticipo.monto)

  return MONEDAS.filter(m => porMoneda.has(m)).map(m => {
    const { gastado, anticipo: ant } = porMoneda.get(m)!
    const diferencia = r2(ant - gastado)
    return {
      moneda: m,
      gastado: r2(gastado),
      anticipo: r2(ant),
      diferencia,
      resultado: diferencia > 0 ? 'reintegrar' : diferencia < 0 ? 'reembolsar' : 'cuadra',
    }
  })
}

/** Cuánto hay que devolver y cuánto reembolsar, ya separado para la pantalla. */
export const aReintegrar = (s: readonly SaldoDeLiquidacion[]) =>
  s.filter(x => x.resultado === 'reintegrar').map(x => ({ moneda: x.moneda, monto: x.diferencia }))

export const aReembolsar = (s: readonly SaldoDeLiquidacion[]) =>
  s.filter(x => x.resultado === 'reembolsar').map(x => ({ moneda: x.moneda, monto: -x.diferencia }))

export type ProblemaDeGasto = { indice: number; mensaje: string }

/**
 * Qué impide enviar la liquidación.
 *
 * EL COMPROBANTE ES OBLIGATORIO, y es la regla que más se va a querer saltar:
 * sin él la liquidación es la palabra de quien viajó, que es exactamente lo
 * que el anexo existe para no tener que aceptar. El reglamento contempla
 * gastos sin factura (un taxi, un parqueo de barrio); para esos está
 * `sin_comprobante`, que obliga a escribir por qué y deja la excepción
 * visible en vez de escondida en un monto.
 */
export function revisarGastos(
  gastos: readonly GastoEjecutado[],
  opts: { sinComprobante?: Record<number, string | null | undefined> } = {},
): ProblemaDeGasto[] {
  const problemas: ProblemaDeGasto[] = []
  if (gastos.length === 0) problemas.push({ indice: -1, mensaje: 'La liquidación no puede ir vacía.' })
  gastos.forEach((g, i) => {
    if (!g.fecha) problemas.push({ indice: i, mensaje: 'Falta la fecha del gasto.' })
    if (!(Number(g.monto) > 0)) problemas.push({ indice: i, mensaje: 'El monto tiene que ser mayor que cero.' })
    if (!MONEDAS.includes(g.moneda)) problemas.push({ indice: i, mensaje: 'Moneda desconocida.' })
    const justifica = (opts.sinComprobante?.[i] ?? '').toString().trim()
    if (!g.receipt_path && !justifica) {
      problemas.push({ indice: i, mensaje: 'Falta el comprobante, o decir por qué no hay.' })
    }
  })
  return problemas
}

/**
 * Las fechas de los gastos contra las del viaje.
 *
 * No bloquea: un pasaje se compra semanas antes y un parqueo se paga al
 * volver. Es un AVISO para quien revisa, que es quien puede juzgarlo.
 */
export function gastosFueraDeFecha(
  gastos: readonly GastoEjecutado[],
  viaje: { sale_at: string; vuelve_at: string },
  diasDeGracia = 30,
): number[] {
  const dia = 86_400_000
  const desde = new Date(viaje.sale_at).getTime() - diasDeGracia * dia
  const hasta = new Date(viaje.vuelve_at).getTime() + diasDeGracia * dia
  const fuera: number[] = []
  gastos.forEach((g, i) => {
    const t = new Date(g.fecha).getTime()
    if (!Number.isFinite(t)) return
    if (t < desde || t > hasta) fuera.push(i)
  })
  return fuera
}

/**
 * El texto de la declaración jurada, con el que la persona firma.
 *
 * Vive acá y no en el JSX porque es texto del reglamento: si se cambia, se
 * cambia a propósito y en un solo lugar.
 */
export const TEXTO_DECLARACION_JURADA =
  'Declaro bajo fe de juramento que los gastos detallados corresponden a '
  + 'erogaciones reales y necesarias del viaje autorizado, que los comprobantes '
  + 'adjuntos son auténticos y no han sido presentados en otra liquidación, y '
  + 'que no he recibido reembolso de estos montos por ninguna otra vía.'
