/**
 * DIR-7 / REP-14 · Las consultas de «los que dejaron de venir».
 *
 * Todo el peso va en SQL (`report_exalumnos_perdidos`,
 * `report_recurrentes_perdidos`): son 175 061 check-ins a charla y traerlos
 * al cliente para contarlos no es una opción. Acá solo se adapta la forma.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sedeFromTitle } from '@/lib/reports/charla-attendance'
import {
  MESES_SIN_VENIR, MINIMO_CHECKINS_RECURRENTE, anioEnQueDejoDeIr,
  type EstadoDeContacto, type AQueVuelve,
} from '@/lib/reports/no-volvieron'

// ── DIR-7 ───────────────────────────────────────────────────────────────────

export type ExalumnoPerdido = {
  member_id: string
  nombre: string
  telefono: string | null
  grupo: string
  anio: number | null
  /** El dato del cierre: aprobado / reprobado / retirado / sin resultado. */
  resultado: string | null
  ultimaSenal: string | null
  /** Lo último que se marcó en el seguimiento, si hay. */
  ultimoEstado: EstadoDeContacto | null
  ultimoContacto: string | null
}

/** Los exalumnos de ESTE dirigente que dejaron de venir. */
export async function getExalumnosPerdidos(leaderId: string): Promise<ExalumnoPerdido[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('report_exalumnos_perdidos', {
    p_leader_id: leaderId,
    p_meses: MESES_SIN_VENIR,
  })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map(r => ({
    member_id: r.member_id as string,
    nombre: (r.nombre as string) ?? 'Sin nombre',
    telefono: (r.telefono as string) ?? null,
    grupo: (r.grupo as string) ?? 'Sin grupo',
    anio: (r.anio_del_grupo as number) ?? null,
    resultado: (r.resultado as string) ?? null,
    // `epoch` es el centinela de «nunca tuvo una señal» que usa la función:
    // devolverlo como fecha haría que la pantalla dijera «última vez: 1970».
    ultimaSenal: esEpoch(r.ultima_senal) ? null : ((r.ultima_senal as string) ?? null),
    ultimoEstado: (r.ultimo_estado as EstadoDeContacto) ?? null,
    ultimoContacto: (r.ultimo_contacto as string) ?? null,
  }))
}

/** La función usa 'epoch' para «nunca»; acá se traduce a null. */
function esEpoch(v: unknown): boolean {
  return typeof v === 'string' && v.startsWith('1970-01-01')
}

/** ¿Esta persona dirige o dirigió algún grupo? Abre DIR-7 acotado a lo suyo. */
export async function esDirigenteConHistorico(memberId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from('study_groups')
    .select('id', { count: 'exact', head: true })
    .eq('leader_id', memberId)
  if (error) throw error
  return (count ?? 0) > 0
}

/** Los dirigentes que tienen grupos, para el selector de los roles amplios. */
export async function getDirigentesConGrupos(): Promise<Array<{ id: string; nombre: string }>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_groups')
    .select('leader:members!study_groups_leader_id_fkey(id, first_name, last_name)')
    .not('leader_id', 'is', null)
  if (error) throw error
  const porId = new Map<string, string>()
  for (const fila of (data ?? []) as Array<Record<string, unknown>>) {
    const l = (Array.isArray(fila.leader) ? fila.leader[0] : fila.leader) as
      { id: string; first_name: string; last_name: string } | null
    if (l?.id) porId.set(l.id, `${l.first_name} ${l.last_name}`.trim())
  }
  return [...porId.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * Registra un contacto. SIEMPRE inserta: el historial es el punto.
 *
 * Sobreescribir borraría la historia que importa — «le escribí y no contestó»
 * seguido de «quiere volver» es justamente lo que hay que poder leer.
 */
export async function registrarContacto(input: {
  memberId: string
  marcadoPor: string | null
  estado: EstadoDeContacto
  aQueVuelve?: AQueVuelve | null
  iglesia?: string | null
  nota?: string | null
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('contact_followups').insert({
    member_id: input.memberId,
    marked_by: input.marcadoPor,
    estado: input.estado,
    // Los campos condicionales se guardan SOLO con su estado: una iglesia
    // colgando de un «no quiere volver» sería un dato que nadie escribió.
    a_que_vuelve: input.estado === 'quiere_volver' ? (input.aQueVuelve ?? null) : null,
    iglesia: input.estado === 'cambio_de_iglesia' ? (input.iglesia?.trim() || null) : null,
    nota: input.nota?.trim() || null,
  })
  if (error) throw error
}

export type ContactoRegistrado = {
  estado: EstadoDeContacto
  aQueVuelve: AQueVuelve | null
  iglesia: string | null
  nota: string | null
  fecha: string
  marcadoPor: string | null
}

/** El historial completo de una persona, del más nuevo al más viejo. */
export async function getHistorialDeContacto(memberId: string): Promise<ContactoRegistrado[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('contact_followups')
    .select('estado, a_que_vuelve, iglesia, nota, created_at, marcado:members!contact_followups_marked_by_fkey(first_name, last_name)')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map(r => {
    const m = (Array.isArray(r.marcado) ? r.marcado[0] : r.marcado) as
      { first_name: string; last_name: string } | null
    return {
      estado: r.estado as EstadoDeContacto,
      aQueVuelve: (r.a_que_vuelve as AQueVuelve) ?? null,
      iglesia: (r.iglesia as string) ?? null,
      nota: (r.nota as string) ?? null,
      fecha: r.created_at as string,
      marcadoPor: m ? `${m.first_name} ${m.last_name}`.trim() : null,
    }
  })
}

// ── REP-14 ──────────────────────────────────────────────────────────────────

export type RecurrentePerdido = {
  member_id: string
  nombre: string
  telefono: string | null
  email: string | null
  /** La charla a la que más fue, ya unificada (REP-13). */
  sede: string
  totalAsistencias: number
  ultimoCheckin: string
  /** Los años en que asistió; aparece en cada uno. */
  anios: number[]
  anioEnQueDejoDeIr: number | null
  llevoEstudio: boolean
  ultimoEstudio: string | null
  dirigente: string | null
}

export async function getRecurrentesPerdidos(): Promise<RecurrentePerdido[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('report_recurrentes_perdidos', {
    p_min_checkins: MINIMO_CHECKINS_RECURRENTE,
    p_meses: MESES_SIN_VENIR,
  })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map(r => {
    const ultimo = r.ultimo_checkin as string
    return {
      member_id: r.member_id as string,
      nombre: (r.nombre as string) ?? 'Sin nombre',
      telefono: (r.telefono as string) ?? null,
      email: (r.email as string) ?? null,
      // REP-13 · La unificación la hace el MISMO `sedeFromTitle` que el resto
      // de los reportes. La función SQL devuelve el título crudo a propósito:
      // repetir el diccionario de alias en SQL garantizaría que se
      // desincronice del de TypeScript.
      sede: r.sede_titulo ? sedeFromTitle(r.sede_titulo as string) : 'Sin sede',
      totalAsistencias: Number(r.total_asistencias ?? 0),
      ultimoCheckin: ultimo,
      anios: ((r.anios as number[]) ?? []).map(Number),
      anioEnQueDejoDeIr: anioEnQueDejoDeIr(ultimo),
      llevoEstudio: !!r.llevo_estudio,
      ultimoEstudio: (r.ultimo_estudio as string) ?? null,
      dirigente: (r.dirigente as string) ?? null,
    }
  })
}
