/**
 * FIN-11 · El expediente de viaje contra la base.
 *
 * El criterio (quién puede mover qué, cuánto suma el presupuesto) vive en
 * `lib/travel/*`, que es puro y tiene los tests. Acá está solo lo que
 * necesita la base de datos.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  puedeMover, esEditable, seLiquida, type Actor, type EstadoDeViaje,
} from '@/lib/travel/estados-del-viaje'
import {
  totales, revisarPresupuesto, anticipoCabe,
  type LineaDePresupuesto, type Moneda, type Rubro, type TotalPorMoneda,
} from '@/lib/travel/presupuesto'
import {
  saldos, revisarGastos, gastosFueraDeFecha,
  type GastoEjecutado, type SaldoDeLiquidacion,
} from '@/lib/travel/liquidacion'
import {
  kmTotales, montoAReconocer, revisarBitacora, avisosDeBitacora,
  faltaAprobacionDelJefe, TARIFA_POR_KM, type Tramo,
} from '@/lib/travel/kilometraje'

/**
 * `database.ts` se genera del esquema y todavía no conoce las tres tablas de
 * FIN-11. Es el mismo camino que ya usan leader-feedback y payment-reminders:
 * un cliente sin tipos para ESTAS consultas, con el tipado puesto a mano al
 * leer la fila. Cuando se regeneren los tipos, esto se borra y lo de abajo
 * sigue igual.
 */
const sinTipos = (): SupabaseClient => createAdminClient() as unknown as SupabaseClient

/** Un paso que la regla no permite. La ruta lo vuelve 409 con su motivo. */
export class PasoInvalido extends Error {
  constructor(mensaje: string) { super(mensaje); this.name = 'PasoInvalido' }
}
/** Datos que no pasan la revisión del anexo. La ruta lo vuelve 400. */
export class DatosInvalidos extends Error {
  constructor(mensaje: string, public detalles?: unknown) {
    super(mensaje); this.name = 'DatosInvalidos'
  }
}

export type ViajeFila = {
  id: string
  member_id: string
  member_name: string
  status: EstadoDeViaje
  tipo: 'trabajo' | 'capacitacion'
  alcance: 'nacional' | 'internacional'
  destino: string
  sale_at: string
  vuelve_at: string
  acompanantes: string | null
  objetivo: string
  agenda: string | null
  beneficio: string | null
  resultado_esperado: string | null
  financiamiento: string | null
  centro_costo: string | null
  anticipo_monto: number | null
  anticipo_moneda: Moneda | null
  monto_maximo_politica: number | null
  anticipo_recomendado: number | null
  disponibilidad_verificada: boolean
  notas_finanzas: string | null
  revisado_por_name: string | null
  revisado_at: string | null
  aprobado_por_name: string | null
  aprobado_at: string | null
  motivo_rechazo: string | null
  created_at: string
  // Fase B · liquidación
  anticipo_recibido_monto: number | null
  anticipo_recibido_moneda: Moneda | null
  anticipo_entregado_at: string | null
  declaracion_jurada_at: string | null
  liquidacion_enviada_at: string | null
  notas_liquidacion: string | null
  gastos: Array<GastoEjecutado & { id: string; sin_comprobante_motivo: string | null; orden: number }>
  saldos: SaldoDeLiquidacion[]
  // Fase C · bitácora de kilometraje
  tramos: Array<Tramo & { id: string; orden: number }>
  km_totales: number
  /** Con la tarifa congelada si ya se envió; con la vigente si no. */
  km_monto: number
  km_tarifa: number
  km_moneda: Moneda
  km_avisos: Array<{ indice: number; mensaje: string }>
  aprobacion_jefe_path: string | null
  /** Índices de gastos con fecha lejana al viaje: aviso para quien revisa. */
  gastos_con_fecha_rara: number[]
  lineas: Array<LineaDePresupuesto & { id: string; orden: number }>
  totales: TotalPorMoneda[]
  history: Array<{
    from_status: string | null; to_status: string
    notes: string | null; changed_by_name: string | null; created_at: string
  }>
}

const SELECT = `
  id, member_id, status, tipo, alcance, destino, sale_at, vuelve_at, acompanantes,
  objetivo, agenda, beneficio, resultado_esperado, financiamiento, centro_costo,
  anticipo_monto, anticipo_moneda, monto_maximo_politica, anticipo_recomendado,
  disponibilidad_verificada, notas_finanzas, revisado_at, aprobado_at,
  motivo_rechazo, created_at,
  solicitante:members!travel_requests_member_id_fkey(first_name, last_name),
  revisor:members!travel_requests_revisado_por_fkey(first_name, last_name),
  autoridad:members!travel_requests_aprobado_por_fkey(first_name, last_name),
  anticipo_recibido_monto, anticipo_recibido_moneda, anticipo_entregado_at,
  declaracion_jurada_at, liquidacion_enviada_at, notas_liquidacion,
  lineas:travel_budget_items(id, rubro, descripcion, cantidad, tarifa, moneda, orden),
  gastos:travel_expenses(id, fecha, rubro, proveedor, numero_comprobante, monto, moneda, receipt_path, sin_comprobante_motivo, orden),
  tramos:travel_mileage_legs(id, fecha, origen, destino, hora_salida, hora_regreso, km_inicial, km_final, orden),
  aprobacion_jefe_path, tarifa_km_aplicada, tarifa_km_moneda,
  history:travel_request_status_history(
    from_status, to_status, notes, created_at,
    autor:members!travel_request_status_history_changed_by_fkey(first_name, last_name)
  )
`

const nombre = (x: unknown): string | null => {
  const m = (Array.isArray(x) ? x[0] : x) as { first_name?: string; last_name?: string } | null
  const n = [m?.first_name, m?.last_name].filter(Boolean).join(' ').trim()
  return n || null
}

function aFila(r: Record<string, unknown>): ViajeFila {
  const lineas = ((r.lineas ?? []) as Array<Record<string, unknown>>)
    .map(l => ({
      id: l.id as string,
      rubro: l.rubro as Rubro,
      descripcion: (l.descripcion as string | null) ?? null,
      cantidad: Number(l.cantidad ?? 0),
      tarifa: Number(l.tarifa ?? 0),
      moneda: l.moneda as Moneda,
      orden: Number(l.orden ?? 0),
    }))
    .sort((a, b) => a.orden - b.orden)
  const gastos = ((r.gastos ?? []) as Array<Record<string, unknown>>)
    .map(g => ({
      id: g.id as string,
      fecha: g.fecha as string,
      rubro: g.rubro as Rubro,
      proveedor: (g.proveedor as string | null) ?? null,
      numero_comprobante: (g.numero_comprobante as string | null) ?? null,
      monto: Number(g.monto ?? 0),
      moneda: g.moneda as Moneda,
      receipt_path: (g.receipt_path as string | null) ?? null,
      sin_comprobante_motivo: (g.sin_comprobante_motivo as string | null) ?? null,
      orden: Number(g.orden ?? 0),
    }))
    .sort((a, b) => a.orden - b.orden)
  // El anticipo que cuenta para la liquidación es el RECIBIDO, no el pedido:
  // finanzas puede entregar menos de lo que se solicitó.
  const anticipoReal = r.anticipo_recibido_monto != null && r.anticipo_recibido_moneda
    ? { monto: Number(r.anticipo_recibido_monto), moneda: r.anticipo_recibido_moneda as Moneda }
    : null
  const tramos = ((r.tramos ?? []) as Array<Record<string, unknown>>)
    .map(t => ({
      id: t.id as string,
      fecha: t.fecha as string,
      origen: t.origen as string,
      destino: t.destino as string,
      hora_salida: (t.hora_salida as string | null) ?? null,
      hora_regreso: (t.hora_regreso as string | null) ?? null,
      km_inicial: Number(t.km_inicial ?? 0),
      km_final: Number(t.km_final ?? 0),
      orden: Number(t.orden ?? 0),
    }))
    .sort((a, b) => a.orden - b.orden)
  // La tarifa CONGELADA manda sobre la vigente. Si no, una liquidación ya
  // pagada cambiaría de monto el día que suba el reglamento.
  const kmTarifa = r.tarifa_km_aplicada != null ? Number(r.tarifa_km_aplicada) : TARIFA_POR_KM.monto
  const kmMoneda = (r.tarifa_km_moneda as Moneda | null) ?? TARIFA_POR_KM.moneda
  const km = kmTotales(tramos)
  return {
    id: r.id as string,
    member_id: r.member_id as string,
    tramos,
    km_totales: km,
    km_tarifa: kmTarifa,
    km_moneda: kmMoneda,
    km_monto: montoAReconocer(km, kmTarifa),
    km_avisos: avisosDeBitacora(tramos),
    aprobacion_jefe_path: (r.aprobacion_jefe_path as string | null) ?? null,
    anticipo_recibido_monto: r.anticipo_recibido_monto == null ? null : Number(r.anticipo_recibido_monto),
    anticipo_recibido_moneda: (r.anticipo_recibido_moneda as Moneda | null) ?? null,
    anticipo_entregado_at: (r.anticipo_entregado_at as string | null) ?? null,
    declaracion_jurada_at: (r.declaracion_jurada_at as string | null) ?? null,
    liquidacion_enviada_at: (r.liquidacion_enviada_at as string | null) ?? null,
    notas_liquidacion: (r.notas_liquidacion as string | null) ?? null,
    gastos,
    // El kilometraje reconocido entra en la cuenta: es plata que se le debe.
    saldos: saldos(gastos, anticipoReal, [{ monto: montoAReconocer(km, kmTarifa), moneda: kmMoneda }]),
    gastos_con_fecha_rara: gastosFueraDeFecha(gastos, {
      sale_at: r.sale_at as string, vuelve_at: r.vuelve_at as string,
    }),
    member_name: nombre(r.solicitante) ?? '—',
    status: r.status as EstadoDeViaje,
    tipo: r.tipo as ViajeFila['tipo'],
    alcance: r.alcance as ViajeFila['alcance'],
    destino: r.destino as string,
    sale_at: r.sale_at as string,
    vuelve_at: r.vuelve_at as string,
    acompanantes: (r.acompanantes as string | null) ?? null,
    objetivo: r.objetivo as string,
    agenda: (r.agenda as string | null) ?? null,
    beneficio: (r.beneficio as string | null) ?? null,
    resultado_esperado: (r.resultado_esperado as string | null) ?? null,
    financiamiento: (r.financiamiento as string | null) ?? null,
    centro_costo: (r.centro_costo as string | null) ?? null,
    anticipo_monto: r.anticipo_monto == null ? null : Number(r.anticipo_monto),
    anticipo_moneda: (r.anticipo_moneda as Moneda | null) ?? null,
    monto_maximo_politica: r.monto_maximo_politica == null ? null : Number(r.monto_maximo_politica),
    anticipo_recomendado: r.anticipo_recomendado == null ? null : Number(r.anticipo_recomendado),
    disponibilidad_verificada: r.disponibilidad_verificada === true,
    notas_finanzas: (r.notas_finanzas as string | null) ?? null,
    revisado_por_name: nombre(r.revisor),
    revisado_at: (r.revisado_at as string | null) ?? null,
    aprobado_por_name: nombre(r.autoridad),
    aprobado_at: (r.aprobado_at as string | null) ?? null,
    motivo_rechazo: (r.motivo_rechazo as string | null) ?? null,
    created_at: r.created_at as string,
    lineas,
    totales: totales(lineas),
    history: ((r.history ?? []) as Array<Record<string, unknown>>)
      .map(h => ({
        from_status: (h.from_status as string | null) ?? null,
        to_status: h.to_status as string,
        notes: (h.notes as string | null) ?? null,
        changed_by_name: nombre(h.autor),
        created_at: h.created_at as string,
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }
}

/** Los viajes que esta persona puede ver: los suyos, o todos si revisa. */
export async function listarViajes(opts: {
  memberId: string | null
  verTodos: boolean
  soloAbiertos?: boolean
}): Promise<ViajeFila[]> {
  const supabase = sinTipos()
  let q = supabase.from('travel_requests').select(SELECT).order('created_at', { ascending: false })
  if (!opts.verTodos) {
    if (!opts.memberId) return []
    q = q.eq('member_id', opts.memberId)
  } else {
    // Quien revisa NO ve los borradores ajenos: un borrador es un papel a
    // medio llenar y mostrarlo invita a opinar sobre algo que nadie mandó.
    q = q.neq('status', 'borrador')
  }
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(aFila)
}

export async function verViaje(id: string): Promise<ViajeFila | null> {
  const supabase = sinTipos()
  const { data, error } = await supabase.from('travel_requests').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? aFila(data as unknown as Record<string, unknown>) : null
}

export type DatosDelViaje = {
  tipo: string; alcance: string; destino: string
  sale_at: string; vuelve_at: string; acompanantes?: string | null
  objetivo: string; agenda?: string | null; beneficio?: string | null
  resultado_esperado?: string | null
  financiamiento?: string | null; centro_costo?: string | null
  anticipo_monto?: number | null; anticipo_moneda?: Moneda | null
  lineas: LineaDePresupuesto[]
}

/** Lo que tiene que cumplir el expediente, venga de crear o de editar. */
function revisarDatos(d: DatosDelViaje) {
  if (new Date(d.vuelve_at) < new Date(d.sale_at)) {
    throw new DatosInvalidos('La fecha de regreso no puede ser antes de la de salida.')
  }
  const problemas = revisarPresupuesto(d.lineas)
  if (problemas.length) throw new DatosInvalidos('El presupuesto tiene errores.', problemas)
  const v = anticipoCabe(
    d.anticipo_monto && d.anticipo_moneda ? { monto: d.anticipo_monto, moneda: d.anticipo_moneda } : null,
    d.lineas,
  )
  if (!v.ok) throw new DatosInvalidos(v.motivo)
}

export async function crearViaje(memberId: string, d: DatosDelViaje): Promise<{ id: string }> {
  revisarDatos(d)
  const supabase = sinTipos()
  const { data, error } = await supabase.from('travel_requests').insert({
    member_id: memberId, status: 'borrador',
    tipo: d.tipo, alcance: d.alcance, destino: d.destino,
    sale_at: d.sale_at, vuelve_at: d.vuelve_at, acompanantes: d.acompanantes ?? null,
    objetivo: d.objetivo, agenda: d.agenda ?? null, beneficio: d.beneficio ?? null,
    resultado_esperado: d.resultado_esperado ?? null,
    financiamiento: d.financiamiento ?? null, centro_costo: d.centro_costo ?? null,
    anticipo_monto: d.anticipo_monto ?? null, anticipo_moneda: d.anticipo_moneda ?? null,
  }).select('id').single()
  if (error) throw error
  const id = (data as { id: string }).id
  await guardarLineas(id, d.lineas)
  return { id }
}

export async function editarViaje(id: string, estado: EstadoDeViaje, d: DatosDelViaje): Promise<void> {
  // El candado que importa: una vez enviada no se edita, o se aprueba una
  // cosa y queda guardada otra.
  if (!esEditable(estado)) throw new PasoInvalido('Este viaje ya no se puede editar.')
  revisarDatos(d)
  const supabase = sinTipos()
  const { error } = await supabase.from('travel_requests').update({
    tipo: d.tipo, alcance: d.alcance, destino: d.destino,
    sale_at: d.sale_at, vuelve_at: d.vuelve_at, acompanantes: d.acompanantes ?? null,
    objetivo: d.objetivo, agenda: d.agenda ?? null, beneficio: d.beneficio ?? null,
    resultado_esperado: d.resultado_esperado ?? null,
    financiamiento: d.financiamiento ?? null, centro_costo: d.centro_costo ?? null,
    anticipo_monto: d.anticipo_monto ?? null, anticipo_moneda: d.anticipo_moneda ?? null,
  }).eq('id', id)
  if (error) throw error
  await guardarLineas(id, d.lineas)
}

/** Las líneas se reemplazan enteras: la pantalla manda la tabla completa. */
async function guardarLineas(id: string, lineas: LineaDePresupuesto[]): Promise<void> {
  const supabase = sinTipos()
  const { error: errDel } = await supabase.from('travel_budget_items').delete().eq('travel_request_id', id)
  if (errDel) throw errDel
  if (lineas.length === 0) return
  const { error } = await supabase.from('travel_budget_items').insert(
    lineas.map((l, i) => ({
      travel_request_id: id, rubro: l.rubro, descripcion: l.descripcion ?? null,
      cantidad: l.cantidad, tarifa: l.tarifa, moneda: l.moneda, orden: i,
    })),
  )
  if (error) throw error
}

/** Lo que finanzas llena al revisar (ANX-02, validación financiera). */
export async function anotarRevisionFinanciera(id: string, d: {
  monto_maximo_politica?: number | null
  anticipo_recomendado?: number | null
  disponibilidad_verificada?: boolean
  notas_finanzas?: string | null
}): Promise<void> {
  const supabase = sinTipos()
  const { error } = await supabase.from('travel_requests').update({
    monto_maximo_politica: d.monto_maximo_politica ?? null,
    anticipo_recomendado: d.anticipo_recomendado ?? null,
    disponibilidad_verificada: d.disponibilidad_verificada === true,
    notas_finanzas: d.notas_finanzas ?? null,
  }).eq('id', id)
  if (error) throw error
}

/**
 * Mover el expediente. Un solo camino para todos los pasos: tener un
 * `aprobar()`, un `rechazar()` y un `devolver()` sueltos es cómo tres de
 * ellos terminan sin escribir el historial.
 */
export async function moverViaje(input: {
  id: string
  de: EstadoDeViaje
  a: EstadoDeViaje
  /** Todos los papeles de quien lo intenta; basta con que uno sirva. */
  actores: readonly Actor[]
  quienMemberId: string | null
  nota: string | null
}): Promise<void> {
  const v = puedeMover(input.de, input.a, input.actores, input.nota)
  if (!v.ok) throw new PasoInvalido(v.motivo)

  const supabase = sinTipos()
  const patch: Record<string, unknown> = { status: input.a }
  if (input.a === 'en_revision') {
    patch.revisado_por = input.quienMemberId
    patch.revisado_at = new Date().toISOString()
  }
  if (input.a === 'aprobada') {
    patch.aprobado_por = input.quienMemberId
    patch.aprobado_at = new Date().toISOString()
  }
  if (input.a === 'rechazada') patch.motivo_rechazo = input.nota

  // El `eq('status', de)` es el que evita que dos personas resuelvan el mismo
  // expediente al mismo tiempo y la segunda pise a la primera.
  const { data, error } = await supabase
    .from('travel_requests').update(patch)
    .eq('id', input.id).eq('status', input.de).select('id')
  if (error) throw error
  if ((data ?? []).length === 0) {
    throw new PasoInvalido('Alguien más movió este viaje mientras tanto. Recargá la página.')
  }

  const { error: errH } = await supabase.from('travel_request_status_history').insert({
    request_id: input.id, from_status: input.de, to_status: input.a,
    changed_by: input.quienMemberId, notes: input.nota,
  })
  if (errH) throw errH
}

/**
 * FIN-11 fase B · Guardar los gastos de la liquidación.
 *
 * Se reemplazan enteros, igual que el presupuesto: la pantalla manda la tabla
 * completa. El `seLiquida` es el candado —y es DISTINTO de `esEditable`: ese
 * habla del presupuesto, que se congela al enviar la solicitud—.
 */
export async function guardarGastos(
  id: string,
  estado: EstadoDeViaje,
  gastos: Array<GastoEjecutado & { sin_comprobante_motivo?: string | null }>,
): Promise<void> {
  if (!seLiquida(estado)) throw new PasoInvalido('Este viaje no está en liquidación.')
  const problemas = revisarGastos(gastos, {
    sinComprobante: Object.fromEntries(gastos.map((g, i) => [i, g.sin_comprobante_motivo])),
  })
  if (problemas.length) throw new DatosInvalidos('La liquidación tiene errores.', problemas)

  const supabase = sinTipos()
  const { error: errDel } = await supabase.from('travel_expenses').delete().eq('travel_request_id', id)
  if (errDel) throw errDel
  const { error } = await supabase.from('travel_expenses').insert(
    gastos.map((g, i) => ({
      travel_request_id: id, fecha: g.fecha, rubro: g.rubro,
      proveedor: g.proveedor ?? null, numero_comprobante: g.numero_comprobante ?? null,
      monto: g.monto, moneda: g.moneda, receipt_path: g.receipt_path ?? null,
      sin_comprobante_motivo: (g.sin_comprobante_motivo ?? '').trim() || null,
      orden: i,
    })),
  )
  if (error) throw error
}

/** Finanzas anota cuánto anticipo entregó de verdad. */
export async function anotarAnticipoEntregado(
  id: string, monto: number | null, moneda: Moneda | null,
): Promise<void> {
  const supabase = sinTipos()
  const { error } = await supabase.from('travel_requests').update({
    anticipo_recibido_monto: monto,
    anticipo_recibido_moneda: monto == null ? null : moneda,
    anticipo_entregado_at: monto == null ? null : new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
}

/**
 * Firmar la declaración jurada y mandar la liquidación.
 *
 * La firma se guarda ANTES de mover el estado, y con quién y cuándo: un
 * booleano «firmada» no le sirve a nadie dentro de seis meses. Si el paso
 * después falla, queda una firma sin liquidación enviada, que es visible y
 * se arregla; al revés —liquidación enviada sin firma— no.
 */
export async function firmarYEnviarLiquidacion(input: {
  id: string
  estado: EstadoDeViaje
  memberId: string | null
  notas: string | null
}): Promise<void> {
  if (!seLiquida(input.estado)) throw new PasoInvalido('Este viaje no está en liquidación.')
  const viaje = await verViaje(input.id)
  if (!viaje) throw new PasoInvalido('No se encontró el viaje.')
  // Que no se mande una liquidación vacía por la puerta de atrás.
  const problemas = revisarGastos(viaje.gastos, {
    sinComprobante: Object.fromEntries(viaje.gastos.map((g, i) => [i, g.sin_comprobante_motivo])),
  })
  if (problemas.length) throw new DatosInvalidos('La liquidación tiene errores.', problemas)

  // FASE C · Si hay bitácora de kilometraje, la aprobación del jefe es
  // REQUISITO (minuta del 2026-09-29). No la reemplaza la declaración
  // jurada: esa la firma quien viajó y esta la firma quien lo autorizó.
  if (viaje.tramos.length > 0 && faltaAprobacionDelJefe(viaje.aprobacion_jefe_path)) {
    throw new DatosInvalidos(
      'Falta adjuntar la aprobación del jefe o supervisor del viaje, que es requisito para el kilometraje.',
    )
  }
  const problemasBitacora = viaje.tramos.length > 0 ? revisarBitacora(viaje.tramos) : []
  if (problemasBitacora.length) throw new DatosInvalidos('La bitácora tiene errores.', problemasBitacora)

  const supabase = sinTipos()
  const { error } = await supabase.from('travel_requests').update({
    declaracion_jurada_at: new Date().toISOString(),
    declaracion_jurada_por: input.memberId,
    liquidacion_enviada_at: new Date().toISOString(),
    notas_liquidacion: input.notas,
    // LA TARIFA SE CONGELA ACÁ y solo si hay bitácora. Desde este momento el
    // expediente vale lo que valía hoy, aunque el reglamento suba la tarifa
    // el año que viene: lo que alguien ya recibió no puede dejar de coincidir
    // con lo que el sistema dice que se le reconoció.
    ...(viaje.tramos.length > 0 ? {
      tarifa_km_aplicada: TARIFA_POR_KM.monto,
      tarifa_km_moneda: TARIFA_POR_KM.moneda,
    } : {}),
  }).eq('id', input.id)
  if (error) throw error

  await moverViaje({
    id: input.id, de: input.estado, a: 'liquidada', actores: ['solicitante'],
    quienMemberId: input.memberId, nota: null,
  })
}

/**
 * FIN-11 fase C · Guardar la bitácora de kilometraje.
 *
 * Mismo candado que los gastos: solo mientras se liquida. La aprobación del
 * jefe NO se exige para guardar —se junta de a poco— sino para enviar la
 * liquidación, que es donde cuenta.
 */
export async function guardarBitacora(
  id: string, estado: EstadoDeViaje, tramos: Tramo[],
): Promise<void> {
  if (!seLiquida(estado)) throw new PasoInvalido('Este viaje no está en liquidación.')
  const problemas = revisarBitacora(tramos)
  if (problemas.length) throw new DatosInvalidos('La bitácora tiene errores.', problemas)

  const supabase = sinTipos()
  const { error: errDel } = await supabase.from('travel_mileage_legs').delete().eq('travel_request_id', id)
  if (errDel) throw errDel
  const { error } = await supabase.from('travel_mileage_legs').insert(
    tramos.map((t, i) => ({
      travel_request_id: id, fecha: t.fecha, origen: t.origen.trim(), destino: t.destino.trim(),
      hora_salida: t.hora_salida || null, hora_regreso: t.hora_regreso || null,
      km_inicial: t.km_inicial, km_final: t.km_final, orden: i,
    })),
  )
  if (error) throw error
}

/** Adjuntar (o quitar) la aprobación del jefe. */
export async function guardarAprobacionDelJefe(id: string, path: string | null): Promise<void> {
  const supabase = sinTipos()
  const { error } = await supabase.from('travel_requests')
    .update({ aprobacion_jefe_path: path }).eq('id', id)
  if (error) throw error
}
