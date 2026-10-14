/**
 * FIN-12 · Adelantos de comida por sede, contra la base.
 *
 * El criterio (saldo, sobregiro, qué no se guarda, cuándo se cierra) vive en
 * `lib/finance/adelantos`; de qué sede es un comité, en
 * `lib/finance/sede-del-area`. Acá solo lo que necesita la base.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  saldo, porSemana, revisarFactura, sePuedeCerrar, esMesValido,
  type Factura, type Saldo, type Semana,
} from '@/lib/finance/adelantos'
import { sedesDeLasAreas, type SedeDelCatalogo } from '@/lib/finance/sede-del-area'

/** `database.ts` no conoce estas tablas (migración de hoy). Mismo camino que viáticos. */
const sinTipos = (): SupabaseClient => createAdminClient() as unknown as SupabaseClient

export class PasoInvalido extends Error { constructor(m: string) { super(m); this.name = 'PasoInvalido' } }
export class DatosInvalidos extends Error {
  constructor(m: string, public detalles?: unknown) { super(m); this.name = 'DatosInvalidos' }
}

export type FacturaFila = Factura & { id: string; registrado_por_name: string | null; created_at: string }

export type AdelantoFila = {
  id: string
  sede_code: string
  sede_name: string
  mes: string
  presupuesto: number
  moneda: string
  estado: 'abierto' | 'cerrado'
  saldo_final: number | null
  cerrado_por_name: string | null
  cerrado_at: string | null
  notas: string | null
  facturas: FacturaFila[]
  saldo: Saldo
  semanas: Semana[]
}

const nombre = (x: unknown): string | null => {
  const m = (Array.isArray(x) ? x[0] : x) as { first_name?: string; last_name?: string } | null
  const n = [m?.first_name, m?.last_name].filter(Boolean).join(' ').trim()
  return n || null
}

const SELECT = `
  id, sede_code, mes, presupuesto, moneda, estado, saldo_final, cerrado_at, notas,
  sede:sedes!sede_advances_sede_code_fkey(name),
  cerrador:members!sede_advances_cerrado_por_fkey(first_name, last_name),
  facturas:sede_advance_expenses(id, semana, encargado, fecha, proveedor, numero_factura, monto, estado, observaciones, receipt_path, created_at,
    autor:members!sede_advance_expenses_registrado_por_fkey(first_name, last_name))
`

function aFila(r: Record<string, unknown>): AdelantoFila {
  const facturas: FacturaFila[] = ((r.facturas ?? []) as Array<Record<string, unknown>>)
    .map(f => ({
      id: f.id as string,
      semana: f.semana as string,
      encargado: (f.encargado as string | null) ?? null,
      fecha: f.fecha as string,
      proveedor: f.proveedor as string,
      numero_factura: (f.numero_factura as string | null) ?? null,
      monto: Number(f.monto ?? 0),
      estado: f.estado as Factura['estado'],
      observaciones: (f.observaciones as string | null) ?? null,
      receipt_path: (f.receipt_path as string | null) ?? null,
      registrado_por_name: nombre(f.autor),
      created_at: f.created_at as string,
    }))
    .sort((a, b) => a.semana.localeCompare(b.semana) || a.fecha.localeCompare(b.fecha))
  const presupuesto = Number(r.presupuesto ?? 0)
  const sede = (Array.isArray(r.sede) ? r.sede[0] : r.sede) as { name?: string } | null
  return {
    id: r.id as string,
    sede_code: r.sede_code as string,
    sede_name: sede?.name ?? (r.sede_code as string),
    mes: r.mes as string,
    presupuesto,
    moneda: (r.moneda as string) ?? 'CRC',
    estado: r.estado as AdelantoFila['estado'],
    saldo_final: r.saldo_final == null ? null : Number(r.saldo_final),
    cerrado_por_name: nombre(r.cerrador),
    cerrado_at: (r.cerrado_at as string | null) ?? null,
    notas: (r.notas as string | null) ?? null,
    facturas,
    saldo: saldo(presupuesto, facturas),
    semanas: porSemana(facturas),
  }
}

/** Las sedes del catálogo que de verdad operan (activas y no zonas). */
export async function sedesOperativas(): Promise<SedeDelCatalogo[]> {
  const { data, error } = await sinTipos().from('sedes').select('code, name, is_active')
    .eq('is_active', true).eq('is_zone', false).order('name')
  if (error) throw error
  return (data ?? []) as SedeDelCatalogo[]
}

/**
 * Las sedes donde esta persona sirve como Colaborador Finanzas.
 *
 * volunteers (activo) → service_positions (título) → areas (nombre del
 * comité) → sede por nombre. Es el MISMO camino por el que el puesto le da
 * el rol, así que el rol y el alcance no pueden desalinearse.
 */
export async function sedesQueAtiende(memberId: string): Promise<string[]> {
  const sb = sinTipos()
  const { data, error } = await sb.from('volunteers')
    .select('status, position:service_positions!volunteers_position_id_fkey(title, area:areas!service_positions_area_id_fkey(name))')
    .eq('member_id', memberId).eq('status', 'active')
  if (error) throw error
  const areas: string[] = []
  for (const v of (data ?? []) as Array<Record<string, unknown>>) {
    const p = (Array.isArray(v.position) ? v.position[0] : v.position) as { title?: string; area?: unknown } | null
    const t = (p?.title ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\bde\b/g, '').replace(/\s+/g, ' ').trim()
    if (t !== 'colaborador finanzas') continue
    const a = (Array.isArray(p?.area) ? (p!.area as unknown[])[0] : p?.area) as { name?: string } | null
    if (a?.name) areas.push(a.name)
  }
  return sedesDeLasAreas(areas, await sedesOperativas())
}

export async function presupuestos(): Promise<Record<string, { monto: number; moneda: string }>> {
  const { data, error } = await sinTipos().from('sede_advance_budgets').select('sede_code, monto, moneda')
  if (error) throw error
  const out: Record<string, { monto: number; moneda: string }> = {}
  for (const b of (data ?? []) as Array<{ sede_code: string; monto: number; moneda: string }>) out[b.sede_code] = { monto: Number(b.monto), moneda: b.moneda }
  return out
}

export async function fijarPresupuesto(sedeCode: string, monto: number, porMemberId: string | null): Promise<void> {
  const { error } = await sinTipos().from('sede_advance_budgets')
    .upsert({ sede_code: sedeCode, monto, moneda: 'CRC', updated_by: porMemberId, updated_at: new Date().toISOString() })
  if (error) throw error
}

/** Los adelantos de un mes, de las sedes pedidas (o de todas). */
export async function listarAdelantos(mes: string, sedes: string[] | null): Promise<AdelantoFila[]> {
  if (!esMesValido(mes)) throw new DatosInvalidos('Mes inválido.')
  let q = sinTipos().from('sede_advances').select(SELECT).eq('mes', mes)
  if (sedes) q = q.in('sede_code', sedes)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(aFila)
    .sort((a, b) => a.sede_name.localeCompare(b.sede_name))
}

export async function verAdelanto(id: string): Promise<AdelantoFila | null> {
  const { data, error } = await sinTipos().from('sede_advances').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? aFila(data as unknown as Record<string, unknown>) : null
}

/**
 * Abrir el mes de una sede. Idempotente: si ya existe, lo devuelve.
 *
 * El presupuesto se COPIA del vigente al abrir: subirlo en noviembre no
 * reescribe el saldo de octubre. Sin presupuesto fijado no se abre — un
 * adelanto de ₡0 es un error que se descubre cuando ya hay facturas.
 */
export async function abrirMes(sedeCode: string, mes: string): Promise<AdelantoFila> {
  if (!esMesValido(mes)) throw new DatosInvalidos('Mes inválido.')
  const sb = sinTipos()
  const { data: existe } = await sb.from('sede_advances').select('id').eq('sede_code', sedeCode).eq('mes', mes).maybeSingle()
  if (existe) return (await verAdelanto((existe as { id: string }).id))!
  const p = (await presupuestos())[sedeCode]
  if (!p) throw new PasoInvalido('Esta sede no tiene presupuesto fijado. Finanzas lo pone primero.')
  const { data, error } = await sb.from('sede_advances')
    .insert({ sede_code: sedeCode, mes, presupuesto: p.monto, moneda: p.moneda }).select('id').single()
  if (error) throw error
  return (await verAdelanto((data as { id: string }).id))!
}

export async function agregarFactura(id: string, mes: string, estado: string, f: Factura, porMemberId: string | null): Promise<void> {
  if (estado === 'cerrado') throw new PasoInvalido('Este mes ya está cerrado.')
  const problemas = revisarFactura(f, mes)
  if (problemas.length) throw new DatosInvalidos('La factura tiene errores.', problemas)
  const { error } = await sinTipos().from('sede_advance_expenses').insert({
    advance_id: id, semana: f.semana, encargado: f.encargado?.trim() || null, fecha: f.fecha,
    proveedor: f.proveedor.trim(), numero_factura: f.numero_factura?.trim() || null, monto: f.monto,
    estado: f.estado, observaciones: f.observaciones?.trim() || null, receipt_path: f.receipt_path ?? null,
    registrado_por: porMemberId,
  })
  if (error) throw error
}

export async function editarFactura(id: string, mes: string, estado: string, facturaId: string, f: Factura): Promise<void> {
  if (estado === 'cerrado') throw new PasoInvalido('Este mes ya está cerrado.')
  const problemas = revisarFactura(f, mes)
  if (problemas.length) throw new DatosInvalidos('La factura tiene errores.', problemas)
  const { error } = await sinTipos().from('sede_advance_expenses').update({
    semana: f.semana, encargado: f.encargado?.trim() || null, fecha: f.fecha,
    proveedor: f.proveedor.trim(), numero_factura: f.numero_factura?.trim() || null, monto: f.monto,
    estado: f.estado, observaciones: f.observaciones?.trim() || null, receipt_path: f.receipt_path ?? null,
  }).eq('id', facturaId).eq('advance_id', id)
  if (error) throw error
}

export async function quitarFactura(id: string, estado: string, facturaId: string): Promise<void> {
  if (estado === 'cerrado') throw new PasoInvalido('Este mes ya está cerrado.')
  const { error } = await sinTipos().from('sede_advance_expenses').delete().eq('id', facturaId).eq('advance_id', id)
  if (error) throw error
}

/** Cerrar el mes: el saldo final queda ESCRITO, que es lo que decide la reposición. */
export async function cerrarMes(id: string, porMemberId: string | null, notas: string | null): Promise<AdelantoFila> {
  const a = await verAdelanto(id)
  if (!a) throw new PasoInvalido('No se encontró el adelanto.')
  const v = sePuedeCerrar(a.estado, a.facturas)
  if (!v.ok) throw new PasoInvalido(v.motivo)
  const { data, error } = await sinTipos().from('sede_advances').update({
    estado: 'cerrado', saldo_final: a.saldo.restante, cerrado_por: porMemberId,
    cerrado_at: new Date().toISOString(), notas,
  }).eq('id', id).eq('estado', 'abierto').select('id')
  if (error) throw error
  if ((data ?? []).length === 0) throw new PasoInvalido('Alguien más cerró este mes mientras tanto.')
  return (await verAdelanto(id))!
}
