/**
 * FIN-12 · Adelantos de comida por sede.
 *
 * Cada sede recibe un adelanto mensual con presupuesto; el Colaborador de
 * Finanzas registra las facturas de cada semana y el sistema RESTA en vivo.
 * Reemplaza los Excels mensuales (el de Liberia de setiembre es el modelo:
 * la unidad es la SEMANA, por fecha de charla, con su encargado).
 *
 * Acá vive lo que se puede probar sin base: cuánto queda, si se pasó, qué
 * no se deja guardar. Un sobregiro NO bloquea —el reglamento dice «hay que
 * identificar por qué y decidir el reintegro»—, se marca.
 *
 * Módulo PURO.
 */
import type { Moneda } from '@/lib/travel/presupuesto'

export type EstadoDeFactura = 'pendiente' | 'liquidada'

export type Factura = {
  /** La fecha de la CHARLA de esa semana (YYYY-MM-DD). */
  semana: string
  encargado?: string | null
  fecha: string
  proveedor: string
  numero_factura?: string | null
  monto: number
  estado: EstadoDeFactura
  observaciones?: string | null
  receipt_path?: string | null
}

const r2 = (n: number) => Math.round(n * 100) / 100 + 0

export type Saldo = {
  presupuesto: number
  gastado: number
  /** Lo pendiente de liquidar también se resta: está comprometido. */
  pendiente: number
  restante: number
  sobregiro: boolean
  porcentaje: number
}

/**
 * «Te quedan ₡X de ₡Y».
 *
 * Las facturas PENDIENTES también restan: la plata ya está comprometida
 * aunque la factura no haya llegado, y un saldo que no las cuenta invita a
 * gastar lo que ya se debe.
 */
export function saldo(presupuesto: number, facturas: readonly Factura[]): Saldo {
  const gastado = r2(facturas.filter(f => f.estado === 'liquidada').reduce((a, f) => a + Number(f.monto || 0), 0))
  const pendiente = r2(facturas.filter(f => f.estado === 'pendiente').reduce((a, f) => a + Number(f.monto || 0), 0))
  const restante = r2(Number(presupuesto || 0) - gastado - pendiente)
  return {
    presupuesto: r2(presupuesto),
    gastado, pendiente, restante,
    sobregiro: restante < 0,
    porcentaje: presupuesto > 0 ? Math.min(100, Math.round(((gastado + pendiente) / presupuesto) * 100)) : 0,
  }
}

export type Semana = { semana: string; encargado: string | null; facturas: Factura[]; total: number }

/** Las facturas agrupadas por semana (fecha de charla), como en el Excel. */
export function porSemana(facturas: readonly Factura[]): Semana[] {
  const m = new Map<string, Semana>()
  for (const f of facturas) {
    if (!m.has(f.semana)) m.set(f.semana, { semana: f.semana, encargado: f.encargado ?? null, facturas: [], total: 0 })
    const s = m.get(f.semana)!
    s.facturas.push(f)
    s.total = r2(s.total + Number(f.monto || 0))
    if (!s.encargado && f.encargado) s.encargado = f.encargado
  }
  return [...m.values()].sort((a, b) => a.semana.localeCompare(b.semana))
}

export type ProblemaDeFactura = { campo: keyof Factura; mensaje: string }

/** Qué no se deja guardar. El resto es asunto de quien revisa. */
export function revisarFactura(f: Factura, mes: string): ProblemaDeFactura[] {
  const p: ProblemaDeFactura[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.semana)) p.push({ campo: 'semana', mensaje: 'Falta la fecha de la charla.' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) p.push({ campo: 'fecha', mensaje: 'Falta la fecha de la factura.' })
  if (!(f.proveedor ?? '').trim()) p.push({ campo: 'proveedor', mensaje: 'Falta el proveedor.' })
  if (!(Number(f.monto) > 0)) p.push({ campo: 'monto', mensaje: 'El monto tiene que ser mayor que cero.' })
  // La semana tiene que ser del mes del adelanto: una factura de octubre en
  // el adelanto de setiembre descuadra los dos meses.
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.semana) && !f.semana.startsWith(mes)) {
    p.push({ campo: 'semana', mensaje: `La semana no es del mes ${mes}.` })
  }
  if (f.estado !== 'pendiente' && f.estado !== 'liquidada') p.push({ campo: 'estado', mensaje: 'Estado desconocido.' })
  return p
}

export const esMesValido = (mes: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)

/** `2026-10` → `Octubre 2026`. */
export function nombreDelMes(mes: string): string {
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const m = mes.match(/^(\d{4})-(\d{2})$/)
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : mes
}

/** El mes de hoy en hora de Costa Rica, sin Date de medianoche UTC. */
export function mesActual(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 6 * 3600_000).toISOString().slice(0, 7)
}

export type Veredicto = { ok: true } | { ok: false; motivo: string }

/**
 * ¿Se puede cerrar el mes? Con facturas PENDIENTES no: cerrar con plata
 * comprometida sin factura deja el saldo final mintiendo, y ese número es el
 * que decide la reposición.
 */
export function sePuedeCerrar(estado: string, facturas: readonly Factura[]): Veredicto {
  if (estado === 'cerrado') return { ok: false, motivo: 'Este mes ya está cerrado.' }
  const pendientes = facturas.filter(f => f.estado === 'pendiente').length
  if (pendientes > 0) {
    return { ok: false, motivo: `Hay ${pendientes} factura${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'}: liquidalas o quitalas antes de cerrar.` }
  }
  return { ok: true }
}

export const MONEDA_DEL_ADELANTO: Moneda = 'CRC'
