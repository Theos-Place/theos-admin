/**
 * FIN-12 · Adelantos de comida por sede, contra la base.
 *
 * El criterio (saldo, sobregiro, qué no se guarda, cuándo se cierra) vive en
 * `lib/finance/adelantos`; de qué sede es un comité, en
 * `lib/finance/sede-del-area`. Acá solo lo que necesita la base.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { esPuestoDeAdelantos } from '@/lib/servers/position-roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { PAYMENT_RECEIPTS_BUCKET } from '@/lib/supabase/queries/payments'
import {
  saldo, porSemana, revisarFactura, sePuedeCerrar, esMesValido,
  type Factura, type Saldo, type Semana,
} from '@/lib/finance/adelantos'
import { sedesDeLasAreas, type SedeDelCatalogo } from '@/lib/finance/sede-del-area'
import {
  arrastreDelMesAnterior, depositoAlAbrir, mesAnterior, mesSiguiente, type TipoDePresupuesto,
} from '@/lib/finance/presupuestos-de-sedes'

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
  /** FIN-16 · El tipo de presupuesto (comida, bienvenida…). */
  tipo: string
  tipo_nombre: string
  mes: string
  /** = saldo_anterior + deposito: lo disponible del mes. */
  presupuesto: number
  /** FIN-16 · Lo que sobró del mes anterior (cerrado). */
  saldo_anterior: number
  /** FIN-16 · Lo que se depositó este mes. */
  deposito: number
  /** FIN-16 · false: el mes anterior sigue abierto y su sobrante llega al cerrarlo. */
  arrastre_confirmado: boolean
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
  id, sede_code, tipo, mes, presupuesto, deposito, saldo_anterior, moneda, estado, saldo_final, cerrado_at, notas,
  sede:sedes!sede_advances_sede_code_fkey(name),
  tipo_info:sede_budget_types!sede_advances_tipo_fkey(nombre),
  cerrador:members!sede_advances_cerrado_por_fkey(first_name, last_name),
  facturas:sede_advance_expenses(id, semana, encargado, fecha, proveedor, numero_factura, monto, estado, observaciones, receipt_path, created_at,
    autor:members!sede_advance_expenses_registrado_por_fkey(first_name, last_name))
`

function aFila(r: Record<string, unknown>, abiertosAntes: ReadonlySet<string> = new Set()): AdelantoFila {
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
  const tipo = (Array.isArray(r.tipo_info) ? r.tipo_info[0] : r.tipo_info) as { nombre?: string } | null
  return {
    id: r.id as string,
    sede_code: r.sede_code as string,
    sede_name: sede?.name ?? (r.sede_code as string),
    tipo: (r.tipo as string) ?? 'comida',
    tipo_nombre: tipo?.nombre ?? (r.tipo as string) ?? 'Comida',
    mes: r.mes as string,
    presupuesto,
    saldo_anterior: Number(r.saldo_anterior ?? 0),
    deposito: Number(r.deposito ?? presupuesto),
    arrastre_confirmado: !abiertosAntes.has(`${r.sede_code}:${r.tipo}`),
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
export async function atencionDe(memberId: string): Promise<{ sedes: string[]; puestos: string[] }> {
  const sb = sinTipos()
  const { data, error } = await sb.from('volunteers')
    .select('status, position:service_positions!volunteers_position_id_fkey(title, area:areas!service_positions_area_id_fkey(name))')
    .eq('member_id', memberId).eq('status', 'active')
  if (error) throw error
  const areas: string[] = []
  const puestos: string[] = []
  for (const v of (data ?? []) as Array<Record<string, unknown>>) {
    const p = (Array.isArray(v.position) ? v.position[0] : v.position) as { title?: string; area?: unknown } | null
    // La MISMA lista que da el rol (position-roles): si difirieran, alguien
    // tendría el rol sin sede, o la sede sin rol.
    if (!esPuestoDeAdelantos(p?.title ?? '')) continue
    puestos.push(p?.title ?? '')
    const a = (Array.isArray(p?.area) ? (p!.area as unknown[])[0] : p?.area) as { name?: string } | null
    if (a?.name) areas.push(a.name)
  }
  return { sedes: sedesDeLasAreas(areas, await sedesOperativas()), puestos }
}

/** FIN-16 · El catálogo de tipos de presupuesto. */
export async function listarTipos(): Promise<TipoDePresupuesto[]> {
  const { data, error } = await sinTipos().from('sede_budget_types').select('code, nombre, puestos, activo, orden').order('orden')
  if (error) throw error
  return ((data ?? []) as TipoDePresupuesto[]).map(t => ({ ...t, puestos: t.puestos ?? [] }))
}

export async function guardarTipo(t: { code: string; nombre: string; puestos: string[]; activo: boolean; orden?: number }): Promise<void> {
  const sb = sinTipos()
  const { data: existe } = await sb.from('sede_budget_types').select('orden').eq('code', t.code).maybeSingle()
  let orden = t.orden ?? (existe as { orden: number } | null)?.orden
  if (orden == null) {
    const { data: ult } = await sb.from('sede_budget_types').select('orden').order('orden', { ascending: false }).limit(1).maybeSingle()
    orden = ((ult as { orden: number } | null)?.orden ?? 0) + 1
  }
  const { error } = await sb.from('sede_budget_types').upsert({ code: t.code, nombre: t.nombre.trim(), puestos: t.puestos, activo: t.activo, orden })
  if (error) throw error
}

/** El link temporal a la foto de una factura (bucket privado). */
export async function urlDeFoto(path: string): Promise<string | null> {
  const { data } = await createAdminClient().storage.from(PAYMENT_RECEIPTS_BUCKET).createSignedUrl(path, 600)
  return data?.signedUrl ?? null
}

/** Presupuesto mensual vigente, por `sede:tipo`. */
export async function presupuestos(): Promise<Record<string, { monto: number; moneda: string }>> {
  const { data, error } = await sinTipos().from('sede_advance_budgets').select('sede_code, tipo, monto, moneda')
  if (error) throw error
  const out: Record<string, { monto: number; moneda: string }> = {}
  for (const b of (data ?? []) as Array<{ sede_code: string; tipo: string; monto: number; moneda: string }>) {
    out[`${b.sede_code}:${b.tipo ?? 'comida'}`] = { monto: Number(b.monto), moneda: b.moneda }
  }
  return out
}

export async function fijarPresupuesto(sedeCode: string, tipo: string, monto: number, porMemberId: string | null): Promise<void> {
  const { error } = await sinTipos().from('sede_advance_budgets')
    .upsert({ sede_code: sedeCode, tipo, monto, moneda: 'CRC', updated_by: porMemberId, updated_at: new Date().toISOString() })
  if (error) throw error
}

/** Los `sede:tipo` cuyo mes ANTERIOR a `mes` sigue abierto. */
async function abiertosElMesAnterior(mes: string, sedes: string[] | null): Promise<Set<string>> {
  let q = sinTipos().from('sede_advances').select('sede_code, tipo').eq('mes', mesAnterior(mes)).eq('estado', 'abierto')
  if (sedes) q = q.in('sede_code', sedes)
  const { data } = await q
  return new Set(((data ?? []) as Array<{ sede_code: string; tipo: string }>).map(r => `${r.sede_code}:${r.tipo}`))
}

/** Los adelantos de un mes, de las sedes pedidas (o de todas). */
export async function listarAdelantos(mes: string, sedes: string[] | null, tipos: string[] | null = null): Promise<AdelantoFila[]> {
  if (!esMesValido(mes)) throw new DatosInvalidos('Mes inválido.')
  let q = sinTipos().from('sede_advances').select(SELECT).eq('mes', mes)
  if (sedes) q = q.in('sede_code', sedes)
  if (tipos) q = q.in('tipo', tipos)
  const [{ data, error }, abiertos] = await Promise.all([q, abiertosElMesAnterior(mes, sedes)])
  if (error) throw error
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(r => aFila(r, abiertos))
    .sort((a, b) => a.sede_name.localeCompare(b.sede_name) || a.tipo_nombre.localeCompare(b.tipo_nombre))
}

export async function verAdelanto(id: string): Promise<AdelantoFila | null> {
  const { data, error } = await sinTipos().from('sede_advances').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as unknown as Record<string, unknown>
  return aFila(r, await abiertosElMesAnterior(r.mes as string, [r.sede_code as string]))
}

/** El sobrante que trae un mes, leído del mes anterior de esa sede y tipo. */
async function arrastrePara(sedeCode: string, tipo: string, mes: string): Promise<number> {
  const { data } = await sinTipos().from('sede_advances').select('estado, saldo_final')
    .eq('sede_code', sedeCode).eq('tipo', tipo).eq('mes', mesAnterior(mes)).maybeSingle()
  return arrastreDelMesAnterior((data as { estado: string; saldo_final: number | null } | null) ?? null).monto
}

/**
 * Abrir el mes de una sede. Idempotente: si ya existe, lo devuelve.
 *
 * El presupuesto se COPIA del vigente al abrir: subirlo en noviembre no
 * reescribe el saldo de octubre. Sin presupuesto fijado no se abre — un
 * adelanto de ₡0 es un error que se descubre cuando ya hay facturas.
 */
export async function abrirMes(sedeCode: string, tipo: string, mes: string): Promise<AdelantoFila> {
  if (!esMesValido(mes)) throw new DatosInvalidos('Mes inválido.')
  const sb = sinTipos()
  const { data: existe } = await sb.from('sede_advances').select('id').eq('sede_code', sedeCode).eq('tipo', tipo).eq('mes', mes).maybeSingle()
  if (existe) return (await verAdelanto((existe as { id: string }).id))!
  const p = (await presupuestos())[`${sedeCode}:${tipo}`]
  if (!p) throw new PasoInvalido('Esta sede no tiene presupuesto fijado para ese tipo. Finanzas lo pone primero.')
  // FIN-16 · Lo que sobró el mes pasado se resta del depósito (el disponible
  // queda igual al presupuesto); un sobregiro se resta del disponible.
  const saldoAnterior = await arrastrePara(sedeCode, tipo, mes)
  const deposito = depositoAlAbrir(p.monto, saldoAnterior)
  const { data, error } = await sb.from('sede_advances')
    .insert({ sede_code: sedeCode, tipo, mes, deposito, saldo_anterior: saldoAnterior, presupuesto: deposito + saldoAnterior, moneda: p.moneda })
    .select('id').single()
  if (error) throw error
  return (await verAdelanto((data as { id: string }).id))!
}

/**
 * FIN-16 · Fijar el DEPÓSITO del mes (lo que hace la carga del Excel de
 * Andrés). Si el mes no existe se abre con ese depósito; si está cerrado no
 * se toca. Devuelve qué pasó, para el resumen de la carga.
 */
export async function fijarDeposito(sedeCode: string, tipo: string, mes: string, deposito: number): Promise<'abierto' | 'actualizado' | 'sin_cambio' | 'cerrado'> {
  if (!esMesValido(mes)) throw new DatosInvalidos('Mes inválido.')
  const sb = sinTipos()
  const { data: existe } = await sb.from('sede_advances').select('id, estado, deposito, saldo_anterior')
    .eq('sede_code', sedeCode).eq('tipo', tipo).eq('mes', mes).maybeSingle()
  const e = existe as { id: string; estado: string; deposito: number; saldo_anterior: number } | null
  if (e?.estado === 'cerrado') return 'cerrado'
  if (e) {
    if (Number(e.deposito) === deposito) return 'sin_cambio'
    const { error } = await sb.from('sede_advances')
      .update({ deposito, presupuesto: deposito + Number(e.saldo_anterior ?? 0) }).eq('id', e.id).eq('estado', 'abierto')
    if (error) throw error
    return 'actualizado'
  }
  const saldoAnterior = await arrastrePara(sedeCode, tipo, mes)
  const { error } = await sb.from('sede_advances')
    .insert({ sede_code: sedeCode, tipo, mes, deposito, saldo_anterior: saldoAnterior, presupuesto: deposito + saldoAnterior, moneda: 'CRC' })
  if (error) throw error
  return 'abierto'
}

/** Los depósitos ya puestos de un mes y tipo, por sede (para el dry-run). */
export async function depositosDelMes(mes: string, tipo: string): Promise<Record<string, { deposito: number; estado: string }>> {
  const { data, error } = await sinTipos().from('sede_advances').select('sede_code, deposito, estado').eq('mes', mes).eq('tipo', tipo)
  if (error) throw error
  const out: Record<string, { deposito: number; estado: string }> = {}
  for (const r of (data ?? []) as Array<{ sede_code: string; deposito: number; estado: string }>) out[r.sede_code] = { deposito: Number(r.deposito), estado: r.estado }
  return out
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
  // FIN-16 · Si el mes siguiente ya está abierto, recibe ahora el sobrante.
  const arrastre = arrastreDelMesAnterior({ estado: 'cerrado', saldo_final: a.saldo.restante }).monto
  const sb = sinTipos()
  const { data: sig } = await sb.from('sede_advances').select('id, deposito')
    .eq('sede_code', a.sede_code).eq('tipo', a.tipo).eq('mes', mesSiguiente(a.mes)).eq('estado', 'abierto').maybeSingle()
  const s2 = sig as { id: string; deposito: number } | null
  if (s2) {
    await sb.from('sede_advances').update({ saldo_anterior: arrastre, presupuesto: Number(s2.deposito) + arrastre }).eq('id', s2.id)
  }
  return (await verAdelanto(id))!
}
