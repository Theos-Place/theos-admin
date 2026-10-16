// EST-29 · Lo que toca la base para la pantalla de demanda declarada.
//
// Las reglas viven en `@/lib/studies/demanda-declarada` (puras). Acá se juntan
// las tres fuentes, se sacan las vencidas y las de prueba, y se arma la
// disponibilidad de cada dirigente con la MISMA regla del reporte de
// dirigentes (`disponibilidadEfectiva` + «dirigiendo» derivado de sus grupos).
import { createAdminClient } from '@/lib/supabase/admin'
import { estaVencida, type BloqueMatricula } from '@/lib/studies/request-expiry'
import { disponibilidadEfectiva, ocupaAlDirigente } from '@/lib/leaders/esta-dirigiendo'
import { dirigeAhora } from '@/lib/studies/dirigente-activo'
import {
  agruparDemanda, dirigentesParaCluster, tendenciaSemanal, zonasDeSolicitud, UMBRAL_ACCIONABLE,
  type Solicitud, type DirigenteParaDemanda, type SedeConocida, type Cluster,
} from '@/lib/studies/demanda-declarada'

/** Estados que todavía son demanda. `en_espera` también: la persona sigue esperando un grupo. */
const ESTADOS_ABIERTOS = ['open', 'in_review', 'en_espera']

type MiembroEmbebido = { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null

const esDePrueba = (m: MiembroEmbebido) =>
  !!m && ((m.first_name ?? '').startsWith('[prueba]') || /@prueba\./i.test(m.email ?? ''))

const nombreDe = (m: MiembroEmbebido) => `${m?.first_name ?? ''} ${m?.last_name ?? ''}`.trim() || 'Sin nombre'

export type ClusterConOferta = Cluster & {
  dirigentes: Array<Pick<DirigenteParaDemanda, 'memberId' | 'nombre'>>
}

export type DemandaDeclarada = {
  clusters: ClusterConOferta[]
  totalSolicitudes: number
  /** Cuántas no se pudieron ubicar en una zona (van a «Otra zona»). */
  sinZona: number
  umbral: number
  planes: Record<string, string>
  zonas: Record<string, string>
  gruposPropuestos: Record<string, string>
  tendencia: ReturnType<typeof tendenciaSemanal>
}

export async function getDemandaDeclarada(ahora = new Date()): Promise<DemandaDeclarada> {
  const supabase = createAdminClient()

  const [sedesR, bloquesR, planesR, reqR, becasR] = await Promise.all([
    supabase.from('sedes').select('code, name'),
    supabase.from('capacitacion_bloques').select('id, nombre, fecha_cierre_matricula'),
    supabase.from('study_plans').select('id, code, name'),
    supabase.from('study_requests')
      .select(`id, member_id, request_type, status, created_at, reactivated_at, plan_id, needed_study_code,
               proposed_zones, proposed_location, proposed_days, proposed_time, grupo_propuesto_id,
               member:members!study_requests_member_id_fkey(first_name, last_name, email, phone)`)
      .in('status', ESTADOS_ABIERTOS).limit(2000),
    supabase.from('finance_requests')
      .select(`id, member_id, status, created_at, plan_id,
               member:members!finance_requests_member_id_fkey(first_name, last_name, email, phone)`)
      .eq('request_type', 'scholarship').eq('status', 'por_modificar').limit(2000),
  ])
  for (const r of [sedesR, bloquesR, planesR, reqR, becasR]) if (r.error) throw r.error

  const sedes = (sedesR.data ?? []) as SedeConocida[]
  const bloques = (bloquesR.data ?? []) as BloqueMatricula[]
  const planes = (planesR.data ?? []) as Array<{ id: string; code: string; name: string }>
  const codigoDePlan = new Map(planes.map(p => [p.id, p.code]))

  const solicitudes: Solicitud[] = []
  for (const r of (reqR.data ?? []) as unknown as Array<Record<string, unknown>>) {
    const m = (Array.isArray(r.member) ? r.member[0] : r.member) as MiembroEmbebido
    if (esDePrueba(m)) continue
    // Las vencidas no son demanda, aunque el cron (3 veces al año) todavía no las haya marcado.
    if (estaVencida({ id: r.id as string, status: r.status as string, created_at: r.created_at as string, reactivated_at: r.reactivated_at as string | null }, bloques, ahora)) continue
    const esReubicacion = r.request_type === 'relocation'
    const planCode = esReubicacion ? (r.needed_study_code as string | null) : codigoDePlan.get(r.plan_id as string)
    if (!planCode) continue
    const { zonas, texto } = zonasDeSolicitud(r as { proposed_zones: string[] | null; proposed_location: string | null }, sedes)
    solicitudes.push({
      id: r.id as string,
      fuente: esReubicacion ? 'reubicacion' : 'interes',
      memberId: r.member_id as string, nombre: nombreDe(m), email: m?.email ?? null, telefono: m?.phone ?? null,
      planCode, zonas, zonaTexto: texto,
      dias: ((r.proposed_days as string[] | null) ?? []),
      franja: (r.proposed_time as string | null) || null,
      creada: r.created_at as string, estado: r.status as string,
      grupoPropuestoId: (r.grupo_propuesto_id as string | null) ?? null,
    })
  }
  for (const r of (becasR.data ?? []) as unknown as Array<Record<string, unknown>>) {
    const m = (Array.isArray(r.member) ? r.member[0] : r.member) as MiembroEmbebido
    const planCode = codigoDePlan.get(r.plan_id as string)
    if (esDePrueba(m) || !planCode) continue
    solicitudes.push({
      id: r.id as string, fuente: 'beca', memberId: r.member_id as string, nombre: nombreDe(m), email: m?.email ?? null, telefono: m?.phone ?? null,
      planCode, zonas: [], zonaTexto: null, dias: [], franja: null,
      creada: r.created_at as string, estado: 'por_modificar', grupoPropuestoId: null,
    })
  }

  const dirigentes = await dirigentesParaDemanda()
  const clusters = agruparDemanda(solicitudes).map(c => ({
    ...c,
    dirigentes: dirigentesParaCluster(c, dirigentes).map(d => ({ memberId: d.memberId, nombre: d.nombre })),
  }))

  // La tendencia mira TODAS las que entraron en las últimas 12 semanas, de cualquier estado.
  const desde = new Date(ahora); desde.setUTCDate(desde.getUTCDate() - 7 * 12)
  const { data: recientes, error: eRec } = await supabase.from('study_requests')
    .select('request_type, plan_id, needed_study_code, created_at, member:members!study_requests_member_id_fkey(first_name, email)')
    .gte('created_at', desde.toISOString()).limit(5000)
  if (eRec) throw eRec
  const creadas = ((recientes ?? []) as unknown as Array<Record<string, unknown>>)
    .filter(r => !esDePrueba((Array.isArray(r.member) ? r.member[0] : r.member) as MiembroEmbebido))
    .map(r => ({ planCode: (r.request_type === 'relocation' ? r.needed_study_code : codigoDePlan.get(r.plan_id as string)) as string, creada: r.created_at as string }))
    .filter(r => !!r.planCode)

  const idsPropuestos = [...new Set(solicitudes.map(s => s.grupoPropuestoId).filter((x): x is string => !!x))]
  const gruposPropuestos: Record<string, string> = {}
  if (idsPropuestos.length) {
    const { data, error } = await supabase.from('study_groups').select('id, name').in('id', idsPropuestos)
    if (error) throw error
    for (const g of (data ?? []) as Array<{ id: string; name: string }>) gruposPropuestos[g.id] = g.name
  }

  return {
    clusters,
    totalSolicitudes: solicitudes.length,
    sinZona: solicitudes.filter(s => !s.zonas.length && s.fuente !== 'beca').length,
    umbral: UMBRAL_ACCIONABLE,
    planes: Object.fromEntries(planes.map(p => [p.code, p.name])),
    zonas: Object.fromEntries(sedes.map(s => [s.code, s.name])),
    gruposPropuestos,
    tendencia: tendenciaSemanal(creadas, ahora),
  }
}

/** Disponibilidad efectiva de cada dirigente: activo, disponible y sin un grupo que lo ocupe. */
async function dirigentesParaDemanda(): Promise<DirigenteParaDemanda[]> {
  const supabase = createAdminClient()
  const filas: Array<Record<string, unknown>> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('study_leaders')
      .select('member_id, estado_base, disponibilidad, razon_no_disponible, qualified_study_codes, zone_preference, member:members!study_leaders_member_id_fkey(first_name, last_name)')
      .order('member_id').range(from, from + 999)
    if (error) throw error
    const lote = (data ?? []) as unknown as Array<Record<string, unknown>>
    filas.push(...lote)
    if (lote.length < 1000) break
  }
  // «Dirigiendo» no está en la ficha: se deriva de los grupos, como en el reporte (DIR-9).
  const ocupados = new Set<string>()
  for (const col of ['leader_id', 'co_leader_id'] as const) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('study_groups')
        .select(`${col}, status, plan:study_plans(code)`).not(col, 'is', null).in('status', ['en_curso', 'en_matricula'])
        .order(col).range(from, from + 999)
      if (error) throw error
      const lote = (data ?? []) as unknown as Array<Record<string, unknown>>
      for (const g of lote) {
        const plan = (Array.isArray(g.plan) ? g.plan[0] : g.plan) as { code: string | null } | null
        if (dirigeAhora([g.status as string]) && ocupaAlDirigente(plan?.code)) ocupados.add(g[col] as string)
      }
      if (lote.length < 1000) break
    }
  }
  return filas.map(f => {
    const m = (Array.isArray(f.member) ? f.member[0] : f.member) as { first_name: string | null; last_name: string | null } | null
    const efectiva = disponibilidadEfectiva({
      estado: { estado_base: f.estado_base as string | null, disponibilidad: f.disponibilidad as string | null, razon_no_disponible: f.razon_no_disponible as string | null },
      dirigiendo: ocupados.has(f.member_id as string),
    })
    return {
      memberId: f.member_id as string,
      nombre: `${m?.first_name ?? ''} ${m?.last_name ?? ''}`.trim(),
      disponible: f.estado_base === 'activo' && efectiva.disponibilidad === 'disponible',
      puedeDar: (f.qualified_study_codes as string[] | null) ?? [],
      zonas: (f.zone_preference as string[] | null) ?? [],
    }
  })
}

/**
 * EST-29 · Vincula las solicitudes de un clúster al grupo que se abrió para
 * ellas. Solo las que siguen abiertas (open, in_review, en_espera): una ya
 * resuelta o rechazada no se toca. No las resuelve ni matricula a nadie.
 * Devuelve cuántas quedaron vinculadas.
 */
export async function vincularSolicitudesAGrupo(ids: readonly string[], grupoId: string, actorId: string | null): Promise<number> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('study_requests')
    .update({ grupo_propuesto_id: grupoId, updated_at: new Date().toISOString() } as never)
    .in('id', [...ids]).in('status', ESTADOS_ABIERTOS).select('id')
  if (error) throw error
  const vinculadas = (data ?? []) as Array<{ id: string }>
  if (vinculadas.length) {
    await supabase.from('audit_log').insert(vinculadas.map(v => ({
      actor_id: actorId, action: 'UPDATE', entity_type: 'study_requests', entity_id: v.id,
      new_data: { grupo_propuesto_id: grupoId, origen: 'EST-29 abrir grupo desde la demanda' },
    })))
  }
  return vinculadas.length
}
