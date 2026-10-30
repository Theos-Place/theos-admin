/**
 * FIN-16 · Presupuestos de sedes (lo que generaliza FIN-12).
 *
 * Varios TIPOS de presupuesto por sede (comida, bienvenida, desechables…),
 * cada mes = saldo del mes anterior + depósito del mes, y la carga de los
 * depósitos desde el Excel de control de Andrés. Lo que se decide sin base
 * vive acá; la factura, el saldo y el cierre siguen en `adelantos.ts`.
 *
 * Módulo PURO.
 */

import { normSinArticulos } from '@/lib/servers/position-roles'
import { sedeDelArea, type SedeDelCatalogo } from '@/lib/finance/sede-del-area'

export type TipoDePresupuesto = {
  code: string
  nombre: string
  /** Títulos de puesto normalizados que lo ven; vacío = todos los de la sede. */
  puestos: string[]
  activo: boolean
  orden: number
}

/**
 * Qué tipos ve alguien de una sede, según sus puestos. `null` = finanzas, que
 * ve todos (incluidos los inactivos, para poder reactivarlos).
 */
export function tiposVisibles(catalogo: readonly TipoDePresupuesto[], puestos: readonly string[] | null): TipoDePresupuesto[] {
  const orden = [...catalogo].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
  if (puestos === null) return orden
  const mios = new Set(puestos.map(normSinArticulos))
  return orden.filter(t => t.activo && (t.puestos.length === 0 || t.puestos.some(p => mios.has(normSinArticulos(p)))))
}

/** «Coordinador Comida, Encargado de Logística» → títulos normalizados, sin repetir. */
export function puestosDesdeTexto(texto: string): string[] {
  return [...new Set(texto.split(',').map(s => normSinArticulos(s)).filter(Boolean))]
}

/** `Ideas especiales` → `ideas_especiales`. El código no cambia después: el nombre sí. */
export function codigoDeTipo(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
}

/**
 * Lo que pasa del mes anterior al siguiente.
 *
 * Solo lo que SOBRÓ, y solo cuando el mes anterior está CERRADO: el saldo de
 * un mes abierto todavía cambia con cada factura, y arrastrarlo haría que el
 * mes siguiente mintiera. Un sobregiro no se arrastra: se resuelve con el
 * reintegro (reglamento de FIN-12), no restándoselo al mes que viene.
 */
export function arrastreDelMesAnterior(anterior: { estado: string; saldo_final: number | null } | null): {
  monto: number
  /** false: hay un mes anterior abierto, así que el arrastre llega al cerrarlo. */
  confirmado: boolean
} {
  if (!anterior) return { monto: 0, confirmado: true }
  if (anterior.estado !== 'cerrado' || anterior.saldo_final == null) return { monto: 0, confirmado: false }
  return { monto: Math.max(0, Math.round(Number(anterior.saldo_final) * 100) / 100), confirmado: true }
}

export const mesAnterior = (m: string): string => {
  const [y, mm] = m.split('-').map(Number)
  return new Date(Date.UTC(y, mm - 2, 1)).toISOString().slice(0, 7)
}
export const mesSiguiente = (m: string): string => {
  const [y, mm] = m.split('-').map(Number)
  return new Date(Date.UTC(y, mm, 1)).toISOString().slice(0, 7)
}

/**
 * Los meses del selector, del más nuevo al más viejo: desde el mes siguiente
 * al actual (para abrir por adelantado) hasta `desde`. Pensado para varios
 * años: es una lista simple, no flechas de a un mes.
 */
export function mesesDelSelector(actual: string, desde = '2026-01'): string[] {
  const out: string[] = []
  for (let m = mesSiguiente(actual); m >= desde; m = mesAnterior(m)) out.push(m)
  return out
}

// ── Importar depósitos desde el Excel de control ─────────────────────────────

export type FilaDelExcel = { nombre: string; monto: number; fila: number }

const textoDeCelda = (v: unknown): string => {
  if (v == null) return ''
  if (typeof v === 'object') {
    const o = v as { text?: unknown; result?: unknown; richText?: Array<{ text: string }> }
    if (Array.isArray(o.richText)) return o.richText.map(r => r.text).join('')
    if (o.result != null) return String(o.result)
    if (o.text != null) return String(o.text)
  }
  return String(v)
}

/** «₡ 125.000,50», «125,000.50», 125000 → número; null si no es un monto. */
export function montoDeCelda(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = textoDeCelda(v).replace(/[₡$\s]/g, '').replace(/CRC|USD/gi, '')
  if (!s) return null
  const coma = s.lastIndexOf(','), punto = s.lastIndexOf('.')
  // El separador que aparece ÚLTIMO es el decimal si deja 1 o 2 cifras.
  const dec = Math.max(coma, punto)
  if (dec >= 0 && s.length - dec - 1 <= 2 && s.length - dec - 1 > 0) {
    s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1)
  } else {
    s = s.replace(/[.,]/g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Las filas «sede + monto» de la hoja. Busca un encabezado con «sede» y con
 * «depósito» o «monto»; sin encabezado, usa las dos primeras columnas. Las
 * filas sin nombre o sin monto se saltan (totales, notas, líneas vacías).
 */
export function filasDelExcel(matriz: readonly (readonly unknown[])[]): FilaDelExcel[] {
  let colSede = 0, colMonto = 1, inicio = 0
  for (let i = 0; i < Math.min(matriz.length, 15); i++) {
    const celdas = matriz[i].map(c => textoDeCelda(c).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())
    const s = celdas.findIndex(c => /\bsede\b/.test(c))
    const m = celdas.findIndex(c => /deposit|monto/.test(c))
    if (s >= 0 && m >= 0) { colSede = s; colMonto = m; inicio = i + 1; break }
  }
  const out: FilaDelExcel[] = []
  for (let i = inicio; i < matriz.length; i++) {
    const nombre = textoDeCelda(matriz[i][colSede]).trim()
    const monto = montoDeCelda(matriz[i][colMonto])
    if (!nombre || monto == null || monto < 0) continue
    if (/^total/i.test(nombre)) continue
    out.push({ nombre, monto, fila: i + 1 })
  }
  return out
}

export type Emparejamiento = {
  coincidencias: Array<{ sede_code: string; sede_name: string; nombre_en_excel: string; monto: number; fila: number }>
  /** Nombres que no casan con ninguna sede, o casan con dos: no se tocan. */
  sinSede: FilaDelExcel[]
  /** La misma sede en dos filas: no se elige, se reporta. */
  repetidas: string[]
}

/**
 * Cada fila del Excel con su sede, por NOMBRE o por código. Nunca por
 * parecido: «Pedregal» solo no es ninguna de las tres sedes de Pedregal (la
 * regla de AGENTS.md para cruces por nombre: exactamente una o nada).
 */
export function emparejarSedes(filas: readonly FilaDelExcel[], sedes: readonly SedeDelCatalogo[]): Emparejamiento {
  const porSede = new Map<string, Array<FilaDelExcel & { sede: SedeDelCatalogo }>>()
  const sinSede: FilaDelExcel[] = []
  for (const f of filas) {
    const sede = sedeDelArea(f.nombre, sedes) ?? sedes.find(s => s.code === f.nombre.trim().toLowerCase()) ?? null
    if (!sede) { sinSede.push(f); continue }
    porSede.set(sede.code, [...(porSede.get(sede.code) ?? []), { ...f, sede }])
  }
  const coincidencias: Emparejamiento['coincidencias'] = []
  const repetidas: string[] = []
  for (const [, fs] of porSede) {
    if (fs.length > 1) { repetidas.push(fs[0].sede.name); continue }
    const f = fs[0]
    coincidencias.push({ sede_code: f.sede.code, sede_name: f.sede.name, nombre_en_excel: f.nombre, monto: f.monto, fila: f.fila })
  }
  coincidencias.sort((a, b) => a.sede_name.localeCompare(b.sede_name))
  return { coincidencias, sinSede, repetidas }
}
