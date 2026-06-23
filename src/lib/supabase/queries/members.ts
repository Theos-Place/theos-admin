import { createAdminClient, type TableName } from '@/lib/supabase/admin'
import type { MemberRole } from '@/types/member'
import type { FilterCondition } from '@/types/filters'
import { getInitials } from '@/lib/format'
import { getAreaNameMap, parentAreaName } from '@/lib/supabase/queries/_area-map'
import { esComiteDirigentes } from '@/lib/dirigentes'
import { canonicalCharlaTitle } from '@/lib/sedes-canonical'

// NOTA: usamos createAdminClient (service role key) porque la app todavía
// corre con mock auth — sin JWT de Supabase, RLS bloquearía todas las reads.
// Cuando migremos a Supabase Auth real, cambiar a createClient de server.ts
// y dejar que RLS haga su trabajo.

// ── Tipos ──────────────────────────────────────────────────

/** Fila cruda de la tabla `members` en Supabase. Para el tipo de dominio completo
 *  ver `Member` en `@/types/member`. Usar `toDomainMember()` en `@/lib/members/adapter` para convertir. */
export type DbMember = {
  id: string
  cedula: string | null
  first_name: string
  last_name: string
  birth_date: string | null
  gender: 'M' | 'F' | 'otro' | null
  marital_status: string | null
  phone: string | null
  email: string | null
  province: string | null
  canton: string | null
  district: string | null
  address: string | null
  occupation: string | null
  workplace: string | null
  allergies: string | null
  medications: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  photo_url: string | null
  is_donor: boolean
  is_active: boolean
  deactivation_reason: string | null
  deactivated_at: string | null
  sede_id: string | null
  field_updated_at: Record<string, string> | null
  created_at: string
  updated_at: string
}

/** DbMember + datos relacionados que se traen en una sola query para el list view. */
export type DbMemberEnriched = DbMember & {
  sede: { code: string; name: string } | null
  roles: MemberRole[]
  /** Sub-estado del rol 'dirigente' activo (null si no es dirigente). */
  estado_dirigente: 'activo' | 'en_descanso' | 'disponible' | null
  /** Tiene registro de dirigente (fila en study_leaders) o está activo en el
   *  comité Dirigentes. Incluye dirigentes inactivos. Join, no consulta por fila. */
  is_dirigente: boolean
  is_server: boolean
  current_study: string | null
  current_study_week?: number | null
  completed_studies: string[]
  attendance_months?: string[]
  active_service: {
    position: string
    committee: string
    area: string
    from: string | null
  } | null
}

export type MemberFilters = {
  search?: string
  province?: string
  is_active?: boolean
  is_donor?: boolean
  is_server?: boolean
  active_attendance?: boolean
  gender?: string
  ids?: string[]
  /** Condiciones de los filtros avanzados (se resuelven server-side). */
  conditions?: FilterCondition[]
  /** Interno: no aplicar el filtro de is_active (los ids ya vienen filtrados). */
  any_active?: boolean
  page?: number
  pageSize?: number
}

/** member_ids con al menos un voluntariado activo (mismo criterio que la página de servidores). */
export async function getServerMemberIds(): Promise<string[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('volunteers').select('member_id').eq('status', 'active')
    if (error) {
      console.warn('getServerMemberIds:', error.message)
      return []
    }
    return Array.from(new Set((data ?? []).map((r) => (r as { member_id: string }).member_id)))
  } catch (e) {
    console.warn('getServerMemberIds:', e)
    return []
  }
}

/** UUID v4 (o cualquier UUID): para validar input antes de interpolarlo en
 *  sintaxis de filtro PostgREST (.or), donde comas/paréntesis inyectan. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Ventanas del criterio de asistencia activa — fuente única en @/lib/attendance
// (módulo puro, importable desde cliente). Re-exportadas para los consumidores server.
export { ATTENDANCE_MONTHS_GENERAL, ATTENDANCE_MONTHS_STUDIES } from '@/lib/attendance'
import { ATTENDANCE_MONTHS_GENERAL } from '@/lib/attendance'

/** Últimos N meses calendario COMPLETOS (YYYY-MM), excluyendo el mes en curso:
 *  incluirlo dejaría a todo el mundo afuera los primeros días de cada mes. */
export function lastCompleteMonthsKeys(n = ATTENDANCE_MONTHS_GENERAL, now = new Date()): string[] {
  const out: string[] = []
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1) // mes anterior
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

/** Criterio de asistencia activa: dado el set de meses (YYYY-MM) con al menos un
 *  check-in de CHARLA, exige cobertura de los últimos `months` meses completos.
 *  `months` default = GENERAL (12); estudios pasa STUDIES (6). */
export function attendanceMonthsSatisfyCriteria(monthsSet: Iterable<string>, months = ATTENDANCE_MONTHS_GENERAL, now = new Date()): boolean {
  const set = monthsSet instanceof Set ? monthsSet : new Set(monthsSet)
  return lastCompleteMonthsKeys(months, now).every((m) => set.has(m))
}

/** Ids de miembros con asistencia activa: ≥1 check-in de CHARLA en cada uno de
 *  los últimos `months` meses completos. Default GENERAL (12); estudios pasa 6.
 *  Devuelve [] si falla — nunca lanza. */
export async function getActiveAttendanceMemberIds(months = ATTENDANCE_MONTHS_GENERAL): Promise<string[]> {
  try {
    const supabase = createAdminClient()
    const monthsKeys = lastCompleteMonthsKeys(months)
    const oldest = `${monthsKeys[monthsKeys.length - 1]}-01` // inicio del mes más viejo
    const byMember = new Map<string, Set<string>>()
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('event_checkins')
        .select('member_id, checked_in_at, events!inner(event_type)')
        .eq('events.event_type', 'charla')
        .gte('checked_in_at', oldest)
        .order('id')
        .range(from, from + 999)
      if (error) {
        console.warn('getActiveAttendanceMemberIds:', error.message)
        return []
      }
      for (const r of (data ?? []) as Array<{ member_id: string | null; checked_in_at: string | null }>) {
        if (!r?.member_id || !r?.checked_in_at) continue
        const mo = r.checked_in_at.slice(0, 7)
        if (!byMember.has(r.member_id)) byMember.set(r.member_id, new Set())
        byMember.get(r.member_id)!.add(mo)
      }
      if ((data ?? []).length < 1000) break
    }
    const out: string[] = []
    for (const [id, set] of byMember) {
      if (attendanceMonthsSatisfyCriteria(set, months)) out.push(id)
    }
    return out
  } catch (e) {
    console.warn('getActiveAttendanceMemberIds:', e)
    return []
  }
}

export type MemberCounts = {
  total: number
  donadores: number
  servidores: number
  activos_asistencia: number
}

/** Conteos para los chips/header. Mismas definiciones que las páginas de cada módulo. */
export async function getMemberCounts(): Promise<MemberCounts> {
  const supabase = createAdminClient()
  const countWhere = async (col: string, val: boolean) => {
    try {
      const { count } = await supabase.from('members').select('id', { count: 'exact', head: true }).eq(col, val)
      return count ?? 0
    } catch (e) {
      console.warn(`getMemberCounts(${col}):`, e)
      return 0
    }
  }
  const totalP = (async () => {
    try {
      const { count } = await supabase.from('members').select('id', { count: 'exact', head: true }).eq('is_active', true)
      return count ?? 0
    } catch (e) {
      console.warn('getMemberCounts(total):', e)
      return 0
    }
  })()
  const [total, donadores, serverIds, attendanceIds] = await Promise.all([
    totalP,
    countWhere('is_donor', true),
    getServerMemberIds(),          // ya resiliente (devuelve [])
    getActiveAttendanceMemberIds(),// ya resiliente (devuelve [])
  ])
  return { total, donadores, servidores: serverIds.length, activos_asistencia: attendanceIds.length }
}

/** Quita acentos/diacríticos (NFD + corta los combining marks). */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Aplica búsqueda de texto sobre miembros contra la columna normalizada
 *  `search_text` (nombre+apellido+cédula+email+teléfono, sin acentos, minúscula).
 *  Tokeniza por espacios — cada palabra debe aparecer (AND entre palabras), así
 *  "Juan Pérez" matchea nombre+apellido. Insensible a tildes/ñ (buscar "munoz"
 *  encuentra "Muñoz" y viceversa). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyMemberSearch<T extends { ilike: (col: string, pattern: string) => any }>(query: T, search: string): T {
  let q = query
  for (const tok of search.trim().split(/\s+/)) {
    const s = stripAccents(tok).toLowerCase().replace(/[%,()]/g, '')
    if (!s) continue
    q = q.ilike('search_text', `%${s}%`)
  }
  return q
}


// ── Filtros avanzados server-side ─────────────────────────────────────────────
// Cada condición se traduce a un set de member_ids y se intersecan en AND.
// TODO: grupos OR del QueryBar (hoy se aplica AND entre todas las condiciones,
// el mínimo viable); condiciones 'form' y los refinamientos de 'attendance'
// (cantidad, rango de fechas, tipo de evento) quedan pendientes.

type ConditionResolution = {
  include: Array<Set<string>>
  exclude: Array<Set<string>>
  isActiveOverride?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pagedIds(build: (q: any) => any, table: TableName, select: string, orderCol = 'member_id'): Promise<Set<string>> {
  const supabase = createAdminClient()
  const out = new Set<string>()
  for (let from = 0; ; from += 1000) {
    // orderCol: en `members` la columna real es `id` (member_id ahí es alias del
    // select); en volunteers/event_checkins sí existe member_id.
    let q = supabase.from(table).select(select).order(orderCol).range(from, from + 999)
    q = build(q)
    const { data, error } = await q
    if (error) throw error
    for (const r of (data ?? []) as unknown as Array<{ member_id: string | null }>) {
      if (r.member_id) out.add(r.member_id)
    }
    if ((data ?? []).length < 1000) break
  }
  return out
}

/** Base de fecha para el rango de un filtro de estudio:
 *  - 'completion': fecha de finalización (graduación) del enrollment.
 *  - 'start':      fecha de inicio (para "en progreso").
 *  La fecha se resuelve con el mismo fallback que el perfil (study_history):
 *  finalización = completed_at ?? fecha del grupo ?? enrolled_at;
 *  inicio       = fecha del grupo ?? enrolled_at. */
type EnrollDateBasis = 'completion' | 'start'
type EnrollRange = { from: string | null; to: string | null; basis: EnrollDateBasis }

/** Fila mínima de enrollment para resolver la fecha en memoria. */
type EnrollDateRow = { member_id: string | null; completed_at: string | null; enrolled_at: string | null; group_starts: string | null }

/** ¿La fecha resuelta del enrollment cae dentro del rango [from, to] (YYYY-MM-DD,
 *  ambos inclusivos)? Sin rango → siempre true. */
function enrollmentInRange(r: EnrollDateRow, range: EnrollRange | undefined): boolean {
  if (!range || (!range.from && !range.to)) return true
  const d = range.basis === 'start'
    ? (r.group_starts ?? r.enrolled_at)
    : (r.completed_at ?? r.group_starts ?? r.enrolled_at)
  if (!d) return false // sin fecha resoluble → no entra a un filtro por fecha
  const day = d.slice(0, 10)
  if (range.from && day < range.from) return false
  if (range.to && day > range.to) return false
  return true
}

/** member_ids con inscripción en un plan (por code) con esos estados, opcionalmente
 *  acotados a un rango de fecha que se evalúa contra el MISMO enrollment (fecha de
 *  finalización o de inicio según `range.basis`) — no como un filtro de fecha
 *  independiente.
 *  Dos fuentes: inscripciones CON grupo (plan vía study_groups) e inscripciones
 *  SIN grupo (plan_id directo, migración 032 — así vino el histórico: ~19k
 *  completados sin grupo que el join !inner descartaba). */
async function idsByEnrollment(planCode: string, statuses: string[], range?: EnrollRange): Promise<Set<string>> {
  const supabase = createAdminClient()
  const { data: plan } = await supabase
    .from('study_plans').select('id').eq('code', planCode).maybeSingle()
  const planId = (plan as { id: string } | null)?.id

  const out = new Set<string>()

  // Fuente 1: enrollments CON grupo (la fecha del grupo es starts_at del grupo).
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('study_enrollments')
      .select('member_id, completed_at, enrolled_at, grp:study_groups!study_enrollments_group_id_fkey!inner(starts_at, plan:study_plans!inner(code))')
      .in('status', statuses)
      .eq('grp.plan.code', planCode)
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    const rows = (data ?? []) as unknown as Array<{ member_id: string | null; completed_at: string | null; enrolled_at: string | null; grp: { starts_at: string | null } | null }>
    for (const r of rows) {
      if (!r.member_id) continue
      if (enrollmentInRange({ member_id: r.member_id, completed_at: r.completed_at, enrolled_at: r.enrolled_at, group_starts: r.grp?.starts_at ?? null }, range)) {
        out.add(r.member_id)
      }
    }
    if (rows.length < 1000) break
  }

  // Fuente 2: enrollments SIN grupo (plan_id directo); la fecha es del enrollment.
  if (planId) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('study_enrollments')
        .select('member_id, completed_at, enrolled_at')
        .in('status', statuses)
        .eq('plan_id', planId)
        .is('group_id', null)
        .order('id')
        .range(from, from + 999)
      if (error) throw error
      const rows = (data ?? []) as unknown as Array<{ member_id: string | null; completed_at: string | null; enrolled_at: string | null }>
      for (const r of rows) {
        if (!r.member_id) continue
        if (enrollmentInRange({ member_id: r.member_id, completed_at: r.completed_at, enrolled_at: r.enrolled_at, group_starts: null }, range)) {
          out.add(r.member_id)
        }
      }
      if (rows.length < 1000) break
    }
  }

  return out
}

/** Resuelve las condiciones avanzadas a sets de inclusión/exclusión. */
export async function resolveAdvancedConditions(conditions: FilterCondition[]): Promise<ConditionResolution> {
  const supabase = createAdminClient()
  const res: ConditionResolution = { include: [], exclude: [] }

  for (const c of conditions) {
    switch (c.type) {
      case 'study': {
        const statuses = c.status === 'completed' ? ['completed']
          : c.status === 'in_progress' ? ['enrolled']
          : ['completed', 'enrolled']
        // El rango de fecha se evalúa contra el MISMO enrollment del plan: para
        // "completado" → fecha de finalización; para "en progreso" → fecha de
        // inicio. Así "Nivel 1 completado + rango" devuelve solo a quienes
        // finalizaron Nivel 1 dentro del rango (no un filtro de fecha aparte).
        const basis: EnrollDateBasis = c.status === 'in_progress' ? 'start' : 'completion'
        res.include.push(await idsByEnrollment(c.study, statuses, { from: c.from, to: c.to, basis }))
        break
      }
      case 'service': {
        // El dropdown de áreas manda el UUID real del área (catálogo /api/org).
        // La jerarquía es área → comités hijos → puestos: el puesto puede colgar
        // del área directamente (area_id = área) o de un comité (parent_id = área).
        res.include.push(await pagedIds(q => {
          // 'active' y 'on_leave' cuentan como servicio activo.
          if (c.status === 'active') q = q.in('status', ['active', 'on_leave'])
          else if (c.status === 'historical') q = q.not('status', 'in', '(active,on_leave)')
          if (c.committee) q = q.eq('position.area.name', c.committee)
          if (c.position) q = q.eq('position.title', c.position)
          // c.area viene del input del usuario (filtros avanzados): solo se
          // interpola si es un UUID válido (anti filter-injection, auditoría S4).
          if (c.area && UUID_RE.test(c.area)) q = q.or(`id.eq.${c.area},parent_id.eq.${c.area}`, { referencedTable: 'position.area' })
          return q
        }, 'volunteers', 'member_id, position:service_positions!inner(title, area:areas!service_positions_area_id_fkey!inner(id, name, parent_id))'))
        break
      }
      case 'donor': {
        // is_donor es el flag derivado de donador activo (criterio por trimestres).
        const set = await pagedIds(q => q.eq('is_donor', true), 'members', 'member_id:id', 'id')
        if (c.value === 'yes') res.include.push(set)
        else res.exclude.push(set)
        break
      }
      case 'attendance': {
        // Sin refinamiento → criterio de asistencia activa (charlas mensuales).
        const hasRefine = !!(c.eventType || c.from || c.to || (c.sedes && c.sedes.length) || c.camp || (c.qtyOp && c.qtyOp !== 'any'))
        if (!hasRefine) {
          res.include.push(new Set(await getActiveAttendanceMemberIds()))
          break
        }
        // Cuenta asistencias por miembro filtrando por tipo de evento (id real de
        // la BD), sede(s), nombre de campamento y rango de fechas; luego aplica el
        // operador de cantidad. Dos fuentes según attendanceType:
        //   participante → event_checkins (rango sobre checked_in_at)
        //   servidor     → event_volunteers (rango sobre la fecha del evento)
        //   cualquiera   → suma de ambas
        // event_volunteers hoy está vacía, pero queda previsto para cuando se use.
        const campLike = c.camp ? c.camp.replace(/[%,()*\\]/g, '') : ''
        // c.sedes trae CÓDIGOS de sede (el catálogo usa code como id); events.sede_id
        // es uuid. Resolver code→uuid; si ninguno existe → resultado vacío (no 500).
        let sedeUuids: string[] = []
        if (c.sedes && c.sedes.length) {
          const { data: sd } = await supabase.from('sedes').select('id, code').in('code', c.sedes)
          sedeUuids = ((sd ?? []) as Array<{ id: string }>).map(s => s.id)
          if (sedeUuids.length === 0) { res.include.push(new Set()); break }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const applyEventFilters = (q: any) => {
          if (c.eventType) q = q.eq('events.event_type', c.eventType)
          if (sedeUuids.length) q = q.in('events.sede_id', sedeUuids)
          if (campLike) q = q.ilike('events.title', `%${campLike}%`)
          return q
        }
        const countFrom = async (
          table: 'event_checkins' | 'event_volunteers',
          dateField: string, // columna (o ruta embebida) para el rango de fechas
        ): Promise<Map<string, number>> => {
          const m = new Map<string, number>()
          for (let from = 0; ; from += 1000) {
            let q = supabase
              .from(table)
              .select('member_id, events!inner(event_type, sede_id, title, starts_at)')
              .not('member_id', 'is', null)
              .order('id')
              .range(from, from + 999)
            q = applyEventFilters(q)
            if (c.from) q = q.gte(dateField, c.from)
            if (c.to) q = q.lte(dateField, `${c.to}T23:59:59.999Z`)
            const { data, error } = await q
            if (error) throw error
            const rows = (data ?? []) as Array<{ member_id: string | null }>
            for (const r of rows) if (r.member_id) m.set(r.member_id, (m.get(r.member_id) ?? 0) + 1)
            if (rows.length < 1000) break
          }
          return m
        }

        let counts: Map<string, number>
        if (c.attendanceType === 'server') {
          counts = await countFrom('event_volunteers', 'events.starts_at')
        } else if (c.attendanceType === 'participant') {
          counts = await countFrom('event_checkins', 'checked_in_at')
        } else {
          counts = await countFrom('event_checkins', 'checked_in_at')
          const serv = await countFrom('event_volunteers', 'events.starts_at')
          for (const [id, n2] of serv) counts.set(id, (counts.get(id) ?? 0) + n2)
        }
        const n = parseInt(c.qty) || 0
        const passes = (count: number) =>
          c.qtyOp === 'gte' ? count >= n
          : c.qtyOp === 'lte' ? count <= n
          : c.qtyOp === 'eq' ? count === n
          : count >= 1 // 'any'
        const set = new Set<string>()
        for (const [id, count] of counts) if (passes(count)) set.add(id)
        res.include.push(set)
        break
      }
      case 'status': {
        res.isActiveOverride = c.value === 'active'
        break
      }
      case 'age': {
        const now = new Date()
        const set = await pagedIds(q => {
          if (c.min) q = q.lte('birth_date', new Date(now.getFullYear() - parseInt(c.min), now.getMonth(), now.getDate()).toISOString().slice(0, 10))
          if (c.max) q = q.gte('birth_date', new Date(now.getFullYear() - parseInt(c.max) - 1, now.getMonth(), now.getDate() + 1).toISOString().slice(0, 10))
          return q.not('birth_date', 'is', null)
        }, 'members', 'member_id:id', 'id')
        res.include.push(set)
        break
      }
      case 'leader': {
        // Dirigente activo = servidor activo en el comité Dirigentes.
        const set = await pagedIds(
          q => q.eq('status', 'active').ilike('position.area.name', '%dirigente%'),
          'volunteers',
          'member_id, position:service_positions!inner(area:areas!service_positions_area_id_fkey!inner(name))',
        )
        if (c.value === 'yes') res.include.push(set)
        else res.exclude.push(set)
        break
      }
      case 'marital': {
        res.include.push(await pagedIds(q => q.eq('marital_status', c.value), 'members', 'member_id:id', 'id'))
        break
      }
      case 'created': {
        res.include.push(await pagedIds(q => {
          if (c.from) q = q.gte('created_at', c.from)
          if (c.to) q = q.lte('created_at', `${c.to}T23:59:59.999Z`)
          return q
        }, 'members', 'member_id:id', 'id'))
        break
      }
      case 'form': {
        // Mismo contrato que el filtro client-side (useMemberFilters):
        // 'not_filled' excluye a quien tenga CUALQUIER respuesta al formulario
        // (sin aplicar fechas/campo); 'filled'/'any' incluyen a quien tenga al
        // menos una respuesta que pase fechas y campo=valor.
        if (!c.formId || !UUID_RE.test(c.formId)) break
        if (c.status === 'not_filled') {
          res.exclude.push(await pagedIds(
            q => q.eq('form_id', c.formId), 'form_responses', 'member_id',
          ))
          break
        }
        const byField = Boolean(c.field && c.fieldVal)
        res.include.push(await pagedIds(q => {
          q = q.eq('form_id', c.formId)
          // Comparación de fechas con la misma semántica que el cliente
          // (submitted_at >= from; to inclusivo hasta el fin del día).
          if (c.from) q = q.gte('submitted_at', c.from)
          if (c.to) q = q.lte('submitted_at', `${c.to}T23:59:59.999Z`)
          if (byField) {
            // Coincidencia completa case-insensitive con comodín '*' (como el
            // cliente). Solo aplica a respuestas de texto (value_text); las
            // compuestas (checkbox/escala) viven en value_json y no se filtran.
            const pattern = c.fieldVal.replace(/([%_\\])/g, '\\$1').replace(/\*/g, '%')
            q = q.eq('vals.field_id', c.field).ilike('vals.value_text', pattern)
          }
          return q
        }, 'form_responses', byField
          ? 'member_id, vals:form_response_values!inner(field_id, value_text)'
          : 'member_id'))
        break
      }
    }
  }
  void supabase
  return res
}

/** Trae miembros enriquecidos por ids en chunks (evita URLs gigantes en .in). */
export async function getMembersByIds(allIds: string[], chunk = 100): Promise<DbMemberEnriched[]> {
  const out: DbMemberEnriched[] = []
  for (let i = 0; i < allIds.length; i += chunk) {
    const slice = allIds.slice(i, i + chunk)
    const { members } = await getMembers({ ids: slice, any_active: true, pageSize: slice.length })
    out.push(...members)
  }
  return out
}

/** Solo los IDs (y total) que coinciden con los filtros, sin paginar. Liviano:
 *  select('id'). Sirve para guardar listas / acciones sobre "todos los resultados". */
export async function getMemberIds(filters: MemberFilters = {}): Promise<{ ids: string[]; total: number }> {
  const supabase = createAdminClient()
  const { search, is_donor, is_server, active_attendance, conditions, province, gender, ids: explicitIds } = filters
  let { is_active = true } = filters

  // Filtros avanzados → sets de inclusión/exclusión (AND entre condiciones).
  let resolution: Awaited<ReturnType<typeof resolveAdvancedConditions>> | null = null
  if (conditions?.length) {
    resolution = await resolveAdvancedConditions(conditions)
    if (resolution.isActiveOverride !== undefined) is_active = resolution.isActiveOverride
  }

  // Sets que se intersectan EN MEMORIA tras el escaneo de ids — nunca como un
  // .in('id', [...]) en la query (un array de cientos/miles revienta la URL).
  const intersectSets: Array<Set<string>> = []
  if (active_attendance) {
    const aids = await getActiveAttendanceMemberIds()
    if (aids.length === 0) return { ids: [], total: 0 }
    intersectSets.push(new Set(aids))
  }
  if (explicitIds) {
    if (explicitIds.length === 0) return { ids: [], total: 0 }
    intersectSets.push(new Set(explicitIds))
  }

  // PostgREST corta cada respuesta en ~1000 filas (db-max-rows), así que un
  // range gigante trunca silenciosamente: paginamos hasta agotar, con orden
  // estable para que las páginas no se solapen. El Set dedup ids repetidos
  // por el inner join con volunteers.
  const pageSize = 1000
  const ids = new Set<string>()
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('members')
      .select(is_server ? 'id, volunteers!inner(status)' : 'id')
      .eq('is_active', is_active)
      .order('id')
      .range(from, from + pageSize - 1)

    if (search) {
      query = applyMemberSearch(query, search)
    }
    if (is_donor !== undefined) query = query.eq('is_donor', is_donor)
    if (is_server) query = query.eq('volunteers.status', 'active')
    if (province) query = query.eq('province', province)
    if (gender) query = query.eq('gender', gender)

    const { data, error } = await query
    if (error) throw error
    const rows = (data ?? []) as unknown as Array<{ id: string }>
    rows.forEach((r) => ids.add(r.id))
    if (rows.length < pageSize) break
  }

  let finalIds = Array.from(ids)
  for (const set of intersectSets) finalIds = finalIds.filter(id => set.has(id))
  if (resolution) {
    for (const inc of resolution.include) finalIds = finalIds.filter(id => inc.has(id))
    for (const exc of resolution.exclude) finalIds = finalIds.filter(id => !exc.has(id))
  }
  return { ids: finalIds, total: finalIds.length }
}

export type UserAccessRow = {
  id: string
  member_id: string
  member_name: string
  member_email: string
  member_initials: string
  roles: string[]
  granted_by: string
  granted_at: string
  last_login: string | null
  is_active: boolean
}

/** Miembros que tienen al menos un rol asignado en member_roles (gestión de accesos). */
export async function getUserAccess(): Promise<UserAccessRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('member_roles')
    .select('member_id, role, is_active, granted_at, member:members!member_roles_member_id_fkey(first_name, last_name, email)')
    .order('granted_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as Array<{
    member_id: string
    role: string
    is_active: boolean
    granted_at: string | null
    member: { first_name: string | null; last_name: string | null; email: string | null } | null
  }>

  const byMember = new Map<string, UserAccessRow>()
  for (const r of rows) {
    if (!r.member_id) continue
    const name = `${r.member?.first_name ?? ''} ${r.member?.last_name ?? ''}`.trim() || (r.member?.email ?? '')
    const initials = getInitials(name)
    let entry = byMember.get(r.member_id)
    if (!entry) {
      entry = {
        id: r.member_id,
        member_id: r.member_id,
        member_name: name,
        member_email: r.member?.email ?? '',
        member_initials: initials,
        roles: [],
        granted_by: 'Sistema',
        granted_at: r.granted_at ?? new Date().toISOString(),
        last_login: null,
        is_active: false,
      }
      byMember.set(r.member_id, entry)
    }
    if (r.is_active && !entry.roles.includes(r.role)) entry.roles.push(r.role)
    if (r.is_active) entry.is_active = true
  }
  // Solo miembros con al menos un rol activo.
  return Array.from(byMember.values()).filter(u => u.roles.length > 0)
}

/** Asigna (o reactiva) un rol a un miembro en member_roles. */
export async function assignMemberRole(memberId: string, role: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('member_roles').select('id').eq('member_id', memberId).eq('role', role).maybeSingle()
  if (existing) {
    const { error } = await supabase.from('member_roles')
      .update({ is_active: true, revoked_at: null }).eq('id', (existing as { id: string }).id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('member_roles')
      .insert({ member_id: memberId, role, is_active: true })
    if (error) throw error
  }
}

/** Revoca un rol (is_active=false, conserva el historial). */
export async function revokeMemberRole(memberId: string, role: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('member_roles')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('member_id', memberId).eq('role', role)
  if (error) throw error
}

// ── Queries ────────────────────────────────────────────────

/** Lista paginada de miembros con datos relacionados ligeros para el list view.
 *  Incluye: sede, roles activos, flag is_server, estudio actual/completados, servicio activo. */
export async function getMembers(filters: MemberFilters = {}): Promise<{ members: DbMemberEnriched[]; total: number }> {
  // Con filtros avanzados o asistencia activa: resolver primero los ids
  // (server-side) y traer solo la página pedida por ids — así el conteo y la
  // paginación reflejan los filtros y nunca pasamos miles de uuids en un .in()
  // (URL gigante → "fetch failed"). El criterio de asistencia puede devolver
  // cientos/miles de ids, por eso también entra por acá.
  if (filters.conditions?.length || filters.active_attendance) {
    const { ids: allIds, total } = await getMemberIds(filters)
    const page = filters.page ?? 1
    const pageSize = filters.pageSize ?? 50
    const pageIds = allIds.slice((page - 1) * pageSize, page * pageSize)
    if (pageIds.length === 0) return { members: [], total }
    const members = await getMembersByIds(pageIds)
    return { members, total }
  }

  const supabase = createAdminClient()
  const {
    search,
    province,
    is_active = true,
    is_donor,
    is_server,
    gender,
    ids,
    page = 1,
    pageSize = 50,
  } = filters

  // ids explícitos: solo una página ya resuelta (p. ej. desde getMembersByIds,
  // chunks ≤100). active_attendance/conditions se resuelven y paginan arriba
  // (vía getMemberIds) para no pasar miles de ids en un .in() → URL gigante.
  let idFilter: string[] | null = null
  if (ids) {
    if (ids.length === 0) return { members: [], total: 0 }
    idFilter = ids
  }

  // is_server: inner join a volunteers activos (evita listas de ids enormes en la URL).
  const volunteersEmbed = is_server
    ? `volunteers!inner(status, start_date, service_positions(title, area:areas!service_positions_area_id_fkey(id, name)))`
    : `volunteers(status, start_date, service_positions(title, area:areas!service_positions_area_id_fkey(id, name)))`

  let query = supabase
    .from('members')
    .select(
      `
      *,
      sede:sedes(code, name),
      member_roles!member_roles_member_id_fkey(role, is_active, status_detail),
      ${volunteersEmbed},
      study_enrollments(
        status,
        study_groups!study_enrollments_group_id_fkey(plan:study_plans(name))
      ),
      study_leaders(member_id),
      event_checkins(checked_in_at)
    `,
      { count: 'exact' },
    )
    .order('last_name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (!filters.any_active) query = query.eq('is_active', is_active)

  if (is_server) query = query.eq('volunteers.status', 'active')

  if (search) {
    query = applyMemberSearch(query, search)
  }
  if (province) query = query.eq('province', province)
  if (is_donor !== undefined) query = query.eq('is_donor', is_donor)
  if (gender) query = query.eq('gender', gender)
  if (idFilter) query = query.in('id', idFilter)

  const { data, error, count } = await query

  if (error) throw error

  // Área padre del comité de servicio: resuelta vía mapa (el embed parent del
  // self-FK no es fiable en PostgREST).
  const areaMap = await getAreaNameMap(supabase)

  // ─── Aplanar las relaciones a un shape simple ───
  // Supabase devuelve arrays para todas las relaciones. Las agrupamos / pickeamos acá.
  const enriched: DbMemberEnriched[] = (data ?? []).map((row: Record<string, unknown>) => {
    const memberRoles = (row.member_roles as Array<{
      role: MemberRole
      is_active: boolean
      status_detail: 'activo' | 'en_descanso' | 'disponible' | null
    }> | null) ?? []
    const volunteers = (row.volunteers as Array<{
      status: string
      start_date: string | null
      service_positions: {
        title: string
        area: { id: string; name: string } | null
      } | null
    }> | null) ?? []
    const enrollments = (row.study_enrollments as Array<{
      status: string
      study_groups: { plan: { name: string } | null } | null
    }> | null) ?? []

    const activeRoles = memberRoles.filter(r => r.is_active).map(r => r.role)
    const activeDirigente = memberRoles.find(r => r.is_active && r.role === 'dirigente')
    const estadoDirigente = activeDirigente?.status_detail ?? null
    const activeVolunteer = volunteers.find(v => v.status === 'active') ?? null

    const completedStudies = enrollments
      .filter(e => e.status === 'completed' && e.study_groups?.plan?.name)
      .map(e => e.study_groups!.plan!.name)

    const currentStudy = enrollments
      .find(e => e.status === 'enrolled' && e.study_groups?.plan?.name)
      ?.study_groups?.plan?.name ?? null

    const sede = (row.sede as { code: string; name: string } | null) ?? null

    // Meses (YYYY-MM) con al menos una asistencia — para el filtro "Activo (asistencia)".
    const checkins = (row.event_checkins as Array<{ checked_in_at: string | null }> | null) ?? []
    const attendanceMonths = Array.from(new Set(
      checkins.map(c => (c.checked_in_at ?? '').slice(0, 7)).filter(Boolean),
    ))

    // Dirigente = tiene registro en study_leaders (activo o inactivo) o está
    // activo en el comité Dirigentes. Join, no consulta por fila.
    const hasLeaderRecord = ((row.study_leaders as unknown[] | null)?.length ?? 0) > 0
    const isDirigente = hasLeaderRecord
      || esComiteDirigentes(activeVolunteer?.service_positions?.area?.name)

    return {
      ...(row as DbMember),
      sede,
      roles: activeRoles,
      estado_dirigente: estadoDirigente,
      is_dirigente: isDirigente,
      is_server: volunteers.some(v => v.status === 'active'),
      current_study: currentStudy,
      completed_studies: completedStudies,
      attendance_months: attendanceMonths,
      active_service: activeVolunteer && activeVolunteer.service_positions
        ? {
            position: activeVolunteer.service_positions.title,
            committee: activeVolunteer.service_positions.area?.name ?? '',
            area: parentAreaName(areaMap, activeVolunteer.service_positions.area?.id)
              || activeVolunteer.service_positions.area?.name
              || '',
            from: activeVolunteer.start_date,
          }
        : null,
    }
  })

  return { members: enriched, total: count ?? 0 }
}

export async function getMemberById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as DbMember
}

// ── Helpers para detail view ──────────────────────────────────────────────────

type AdminSupabase = ReturnType<typeof createAdminClient>

async function loadFamily(supabase: AdminSupabase, memberId: string): Promise<DbFamilyMember[]> {
  // 1. family_unit_id donde el miembro tiene vínculos
  const { data: ownLinks, error: e1 } = await supabase
    .from('family_members')
    .select('family_unit_id')
    .eq('member_id', memberId)
  if (e1) throw e1

  const unitIds = (ownLinks ?? []).map(r => r.family_unit_id).filter(Boolean) as string[]
  if (unitIds.length === 0) return []

  // 2. Otros miembros en esos family units
  const { data: links, error: e2 } = await supabase
    .from('family_members')
    .select(`
      relation,
      member:members!family_members_member_id_fkey(id, first_name, last_name, is_active)
    `)
    .in('family_unit_id', unitIds)
    .neq('member_id', memberId)
  if (e2) throw e2

  return (links ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const m = row.member as { id: string; first_name: string; last_name: string; is_active: boolean } | null
    return {
      id: m?.id ?? '',
      name: m ? `${m.first_name} ${m.last_name}` : '',
      relation: (row.relation as string) ?? '',
      is_active: m?.is_active ?? false,
    }
  }).filter(f => f.id)
}

// ── Detail view: trae miembro + todo el histórico relacionado ─────────────────

export type DbAttendance = {
  event_name: string
  event_type: string
  event_date: string
  was_volunteer: boolean
}

export type DbService = {
  position: string
  committee: string
  area: string
  from: string | null
  to: string | null
  status: 'active' | 'inactive' | 'on_leave' | 'pending'
}

export type DbDonation = {
  date: string
  amount: number
  description: string
  category: string
}

export type DbFormResponse = {
  form_id: string
  form_slug: string | null
  form_title: string
  submitted_at: string
  answers: Record<string, string>
}

export type DbFamilyMember = {
  id: string
  name: string
  relation: string
  is_active: boolean
}

export type DbMemberFull = DbMemberEnriched & {
  /** Sede calculada por asistencia a charlas (últimos 12 meses). null = sin sede. */
  attendance_sede: { name: string; count: number } | null
  study_history: Array<{ group_id: string | null; code: string; name: string; date: string | null; year: number | null; weeks: number | null; status: string }>
  attendance: DbAttendance[]
  service_history: DbService[]
  donations: DbDonation[]
  form_responses: DbFormResponse[]
  family: DbFamilyMember[]
  wallet_pass_id: string | null
  attendance_active: boolean
  last_charla_checkin: string | null
  /** Grupos activos (en_matricula/en_curso) donde el miembro es dirigente o co-dirigente. */
  led_groups: Array<{ group_id: string; group_name: string; plan_code: string | null; plan_name: string | null }>
  led_studies: Array<{ group_id: string; group_name: string; plan_code: string | null; plan_name: string | null; role: 'Dirigente' | 'Co-dirigente'; status: string; date: string | null }>
}

/** Devuelve un miembro con TODO su histórico relacionado. Para el detail view. */
export async function getMemberFullById(id: string): Promise<DbMemberFull | null> {
  const supabase = createAdminClient()

  // 1. Miembro + relaciones livianas (mismo shape que list view)
  const { data: memberRow, error: mErr } = await supabase
    .from('members')
    .select(`
      *,
      sede:sedes(code, name),
      member_roles!member_roles_member_id_fkey(role, is_active, status_detail),
      volunteers(
        status,
        start_date,
        end_date,
        service_positions(
          title,
          area:areas!service_positions_area_id_fkey(id, name)
        )
      ),
      study_enrollments(
        status, completed_at, enrolled_at,
        study_groups!study_enrollments_group_id_fkey(id, current_week, starts_at, leader_id, co_leader_id, plan:study_plans(code, name, duration_weeks)),
        plan_direct:study_plans!study_enrollments_plan_id_fkey(code, name, duration_weeks)
      ),
      study_leaders(member_id)
    `)
    .eq('id', id)
    .maybeSingle()

  if (mErr) throw mErr
  if (!memberRow) return null

  // Grupos activos que la persona dirige (dos .eq en vez de .or() para no
  // interpolar el id de la URL en sintaxis PostgREST).
  const ledGroupSelect = 'id, name, status, starts_at, plan:study_plans(code, name)'
  // 2. Queries en paralelo para histórico pesado
  const [
    checkinsRes,
    volunteersRes,
    paymentsRes,
    donationsRes,
    formsRes,
    leadsRes,
    coLeadsRes,
  ] = await Promise.all([
    supabase
      .from('event_checkins')
      .select(`
        event_id,
        checked_in_at,
        events(title, event_type, starts_at)
      `)
      .eq('member_id', id)
      .order('checked_in_at', { ascending: false }),

    supabase
      .from('event_volunteers')
      .select('event_id')
      .eq('member_id', id),

    supabase
      .from('payments')
      .select(`
        amount,
        payment_date,
        description,
        category:payment_categories(name, is_donation)
      `)
      .eq('member_id', id)
      .eq('status', 'paid') // estados reales de payments (014): paid/pending/refunded/…
      .order('payment_date', { ascending: false }),

    supabase
      .from('donations')
      .select('donation_date, amount, source_file')
      .eq('member_id', id)
      .order('donation_date', { ascending: false }),

    supabase
      .from('form_responses')
      .select(`
        form_id,
        submitted_at,
        forms(title, slug),
        form_response_values(
          value_text,
          form_fields(label)
        )
      `)
      .eq('member_id', id)
      .order('submitted_at', { ascending: false }),

    // TODOS los grupos liderados (cualquier estado): led_groups filtra los activos
    // (D9) y led_studies los lista todos como dirigente (D10).
    supabase
      .from('study_groups')
      .select(ledGroupSelect)
      .eq('leader_id', id),

    supabase
      .from('study_groups')
      .select(ledGroupSelect)
      .eq('co_leader_id', id),
  ])

  if (checkinsRes.error)   throw checkinsRes.error
  if (volunteersRes.error) throw volunteersRes.error
  if (paymentsRes.error)   throw paymentsRes.error
  if (donationsRes.error)  throw donationsRes.error
  if (formsRes.error)      throw formsRes.error
  if (leadsRes.error)      throw leadsRes.error
  if (coLeadsRes.error)    throw coLeadsRes.error

  type LedGroupRow = { id: string; name: string | null; status: string; starts_at: string | null; plan: { code: string | null; name: string | null } | null }
  const allLed = [
    ...((leadsRes.data ?? []) as LedGroupRow[]).map(g => ({ ...g, role: 'Dirigente' as const })),
    ...((coLeadsRes.data ?? []) as LedGroupRow[]).map(g => ({ ...g, role: 'Co-dirigente' as const })),
  ].filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i)

  // D9: estudios en curso que dirige (activos) para el resumen.
  const ledGroups = allLed
    .filter(g => g.status === 'en_matricula' || g.status === 'en_curso')
    .map(g => ({
      group_id: g.id,
      group_name: g.name ?? '',
      plan_code: g.plan?.code ?? null,
      plan_name: g.plan?.name ?? null,
    }))

  // D10: TODOS los estudios dados como dirigente (cualquier estado) para el perfil.
  const ledStudies = allLed
    .map(g => ({
      group_id: g.id,
      group_name: g.name ?? '',
      plan_code: g.plan?.code ?? null,
      plan_name: g.plan?.name ?? null,
      role: g.role,
      status: g.status,
      date: g.starts_at,
    }))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  // Set de event_ids donde el miembro sirvió como voluntario
  const volunteerEventIds = new Set(
    (volunteersRes.data ?? []).map((v) => (v as { event_id: string }).event_id),
  )

  // 3. Aplanar relaciones del miembro (sede, roles, volunteers, studies)
  const memberRoles = (memberRow.member_roles ?? []) as Array<{
    role: MemberRole
    is_active: boolean
    status_detail: 'activo' | 'en_descanso' | 'disponible' | null
  }>
  const volunteers = (memberRow.volunteers ?? []) as Array<{
    status: 'active' | 'inactive' | 'on_leave' | 'pending'
    start_date: string | null
    end_date: string | null
    service_positions: {
      title: string
      area: { id: string; name: string } | null
    } | null
  }>
  type PlanEmbed = { code: string | null; name: string | null; duration_weeks: number | null } | null
  const enrollments = (memberRow.study_enrollments ?? []) as Array<{
    status: string
    completed_at: string | null
    enrolled_at: string | null
    study_groups: { id: string; current_week: number | null; starts_at: string | null; leader_id: string | null; co_leader_id: string | null; plan: PlanEmbed } | null
    plan_direct: PlanEmbed
  }>

  const activeRoles = memberRoles.filter(r => r.is_active).map(r => r.role)
  const activeDirigente = memberRoles.find(r => r.is_active && r.role === 'dirigente')
  const estadoDirigente = activeDirigente?.status_detail ?? null
  const activeVolunteer = volunteers.find(v => v.status === 'active') ?? null
  // El plan puede venir del grupo o, si el estudio no tuvo grupo (sistema no
  // existía), directo de la inscripción (plan_direct). Excluimos lo que la
  // persona dirigió (solo aplica a estudios con grupo).
  const planOf = (e: typeof enrollments[number]) => e.study_groups?.plan ?? e.plan_direct
  const ledByMember = (e: typeof enrollments[number]) =>
    !!e.study_groups && (e.study_groups.leader_id === id || e.study_groups.co_leader_id === id)
  const completedStudies = enrollments
    .filter(e => e.status === 'completed' && planOf(e)?.name && !ledByMember(e))
    .map(e => planOf(e)!.name as string)
  // Historial de estudios con fecha real (del grupo si existe; si no, de la inscripción).
  const studyHistory = enrollments
    .filter(e => planOf(e)?.code && !ledByMember(e))
    .map(e => {
      const plan = planOf(e)!
      // completed_at trae la fecha precisa del histórico (PCO); si falta (ej.
      // inscripción activa), caemos a la fecha de inicio del grupo o enrolled_at.
      const d = e.completed_at ?? e.study_groups?.starts_at ?? e.enrolled_at ?? null
      return {
        group_id: e.study_groups?.id ?? null,
        code: plan.code as string,
        name: plan.name ?? '',
        date: d ? d.slice(0, 10) : null,
        year: d ? Number(d.slice(0, 4)) : null,
        weeks: plan.duration_weeks ?? null,
        status: e.status,
      }
    })
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')) // más reciente primero (igual que eventos y donaciones)
  const currentEnrollment = enrollments
    .find(e => e.status === 'enrolled' && e.study_groups?.plan?.name)
  const currentStudy = currentEnrollment?.study_groups?.plan?.name ?? null
  const currentStudyWeek = currentEnrollment?.study_groups?.current_week ?? null
  const sede = (memberRow.sede as { code: string; name: string } | null) ?? null

  // 4. Aplanar histórico
  const attendance: DbAttendance[] = (checkinsRes.data ?? []).map((c) => {
    const row = c as Record<string, unknown>
    const ev = row.events as { title: string; event_type: string; starts_at: string } | null
    return {
      event_name: ev?.title ?? '',
      event_type: ev?.event_type ?? 'otro',
      event_date: ev?.starts_at ?? row.checked_in_at as string,
      was_volunteer: volunteerEventIds.has(row.event_id as string),
    }
  })

  // Área padre del comité: resuelta vía mapa (el embed parent no es fiable).
  const areaMap = await getAreaNameMap(supabase)
  const service_history: DbService[] = volunteers
    .filter(v => v.service_positions)
    .map(v => ({
      position: v.service_positions!.title,
      committee: v.service_positions!.area?.name ?? '',
      area: parentAreaName(areaMap, v.service_positions!.area?.id)
        || v.service_positions!.area?.name
        || '',
      from: v.start_date,
      to: v.end_date,
      status: v.status,
    }))

  // Donaciones: la tabla donations (incluye las históricas importadas con
  // amount 0) + pagos con categoría de donación. Para las importadas sin
  // monto, la descripción lleva el trimestre ("Donación registrada · Q3 2025").
  // Parsear el string YYYY-MM-DD directo: new Date(date-only) es UTC y al
  // leer con getters locales (UTC-6) retrocede un día → trimestre equivocado.
  const quarterLabel = (iso: string) => {
    const [y, m] = iso.split('-').map(Number)
    return `Q${Math.floor((m - 1) / 3) + 1} ${y}`
  }
  const tableDonations: DbDonation[] = ((donationsRes.data ?? []) as Array<{
    donation_date: string; amount: number | null; source_file: string | null
  }>).map((d) => ({
    date: d.donation_date,
    amount: Number(d.amount ?? 0),
    description: Number(d.amount ?? 0) === 0
      ? `Donación registrada · ${quarterLabel(d.donation_date)}`
      : 'Donación',
    category: 'Donación',
  }))
  const paymentDonations: DbDonation[] = (paymentsRes.data ?? [])
    .filter((p) => {
      const cat = (p as Record<string, unknown>).category as { is_donation: boolean } | null
      return cat?.is_donation === true
    })
    .map((p) => {
      const row = p as Record<string, unknown>
      const cat = row.category as { name: string } | null
      return {
        date: row.payment_date as string,
        amount: Number(row.amount),
        description: (row.description as string) ?? '',
        category: cat?.name ?? '',
      }
    })
  const donations: DbDonation[] = [...tableDonations, ...paymentDonations]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  const form_responses: DbFormResponse[] = (formsRes.data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const form = row.forms as { title: string; slug: string | null } | null
    const values = (row.form_response_values as Array<{
      value_text: string | null
      form_fields: { label: string } | null
    }> | null) ?? []
    const answers: Record<string, string> = {}
    for (const v of values) {
      if (v.form_fields?.label && v.value_text != null) {
        answers[v.form_fields.label] = v.value_text
      }
    }
    return {
      form_id: row.form_id as string,
      form_slug: form?.slug ?? null,
      form_title: form?.title ?? '',
      submitted_at: row.submitted_at as string,
      answers,
    }
  })

  // Asistencia activa (criterio único, solo CHARLAS). checkinsRes viene
  // ordenado desc por checked_in_at, así que el primero es el más reciente.
  const charlaCheckins = (checkinsRes.data ?? []).filter((c) => {
    const ev = (c as Record<string, unknown>).events as { event_type: string } | null
    return ev?.event_type === 'charla'
  }) as Array<{ checked_in_at: string | null }>
  const charlaMonths = Array.from(new Set(
    charlaCheckins.map(c => (c.checked_in_at ?? '').slice(0, 7)).filter(Boolean),
  ))
  const lastCharlaCheckin = charlaCheckins.find(c => c.checked_in_at)?.checked_in_at ?? null

  // Sede calculada: charla a la que MÁS asistió en los últimos 12 meses (sede
  // canónica derivada del título). Empate → la más reciente. Sin charlas en 12
  // meses → null ("Sin sede asignada"). Decisión 2026: la sede es dinámica por
  // asistencia, no el sede_id estático del perfil.
  const attendance_sede = (() => {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 12)
    const cutoffMs = cutoff.getTime()
    const tally = new Map<string, { count: number; last: string }>()
    for (const c of (checkinsRes.data ?? []) as Array<{ checked_in_at: string | null; events: { title: string; event_type: string } | null }>) {
      if (c.events?.event_type !== 'charla' || !c.checked_in_at) continue
      if (new Date(c.checked_in_at).getTime() < cutoffMs) continue
      const canonical = canonicalCharlaTitle(c.events.title)
      if (!canonical) continue
      const name = canonical.replace(/^Charla\s+/, '') // "Charla Heredia" → "Heredia"
      const cur = tally.get(name) ?? { count: 0, last: '' }
      cur.count++
      if (c.checked_in_at > cur.last) cur.last = c.checked_in_at
      tally.set(name, cur)
    }
    let best: { name: string; count: number; last: string } | null = null
    for (const [name, v] of tally) {
      if (!best || v.count > best.count || (v.count === best.count && v.last > best.last)) {
        best = { name, count: v.count, last: v.last }
      }
    }
    return best ? { name: best.name, count: best.count } : null
  })()

  // Familia: dos queries — primero los family_unit_id del miembro, después
  // los OTROS miembros de esos units.
  const family: DbFamilyMember[] = await loadFamily(supabase, id)

  return {
    ...(memberRow as DbMember),
    sede,
    attendance_sede,
    roles: activeRoles,
    estado_dirigente: estadoDirigente,
    // Dirigente = registro en study_leaders (activo/inactivo), lideró grupos, o
    // está activo en el comité Dirigentes.
    is_dirigente: ((memberRow.study_leaders as unknown[] | null)?.length ?? 0) > 0
      || ledStudies.length > 0
      || esComiteDirigentes(activeVolunteer?.service_positions?.area?.name),
    is_server: volunteers.some(v => v.status === 'active'),
    current_study: currentStudy,
    current_study_week: currentStudyWeek,
    completed_studies: completedStudies,
    study_history: studyHistory,
    active_service: activeVolunteer && activeVolunteer.service_positions
      ? {
          position: activeVolunteer.service_positions.title,
          committee: activeVolunteer.service_positions.area?.name ?? '',
          area: parentAreaName(areaMap, activeVolunteer.service_positions.area?.id)
            || activeVolunteer.service_positions.area?.name
            || '',
          from: activeVolunteer.start_date,
        }
      : null,
    attendance,
    service_history,
    donations,
    form_responses,
    family,
    wallet_pass_id: (memberRow.wallet_pass_id as string | null) ?? null,
    attendance_months: charlaMonths,
    attendance_active: attendanceMonthsSatisfyCriteria(charlaMonths),
    last_charla_checkin: lastCharlaCheckin,
    led_groups: ledGroups,
    led_studies: ledStudies,
  }
}

/** Busca un miembro existente por cédula o correo (para evitar duplicados al crear).
 *  Dos .eq() separados en vez de .or(): .or() interpola el valor en la sintaxis
 *  de PostgREST, así que comas/paréntesis del input alteran el filtro. */
export async function findMemberByCedulaOrEmail(cedula: string | null, email: string | null) {
  if (!cedula && !email) return null
  const supabase = createAdminClient()
  const lookup = (col: 'cedula' | 'email', val: string) =>
    supabase.from('members').select('id').eq(col, val).limit(1).maybeSingle()

  const [byCedula, byEmail] = await Promise.all([
    cedula ? lookup('cedula', cedula) : null,
    email ? lookup('email', email) : null,
  ])
  if (byCedula?.error) throw byCedula.error
  if (byEmail?.error) throw byEmail.error
  return (byCedula?.data ?? byEmail?.data ?? null) as { id: string } | null
}

/** Fusiona dos miembros duplicados: reasigna todo lo de `dupId` a `keepId` y
 *  borra el duplicado. Corre la función transaccional `merge_members` en la BD. */
export async function mergeMembers(
  keepId: string,
  dupId: string,
  opts?: { fields?: Record<string, unknown>; soft?: boolean },
): Promise<void> {
  const supabase = createAdminClient()

  // 1) La FUSIÓN es lo crítico y atómico (RPC). Va PRIMERO: si falla, no se tocó
  //    nada. Solo este error es un fallo real de fusión que el front debe mostrar.
  const { error } = await supabase.rpc('merge_members', { keep_id: keepId, dup_id: dupId, soft: opts?.soft ?? false })
  if (error) throw error

  // 2) Valores elegidos campo-por-campo para el principal (cosmético, en una
  //    request aparte que no es transaccional con el RPC). La fusión YA ocurrió:
  //    si esto falla NO es un fallo de fusión — se loguea y se continúa, para no
  //    mostrarle al admin un "falló" cuando en realidad fusionó.
  if (opts?.fields && Object.keys(opts.fields).length > 0) {
    const { data: cur } = await supabase
      .from('members').select('field_updated_at').eq('id', keepId).maybeSingle()
    const now = new Date().toISOString()
    const stamp = { ...((cur as { field_updated_at?: Record<string, string> } | null)?.field_updated_at ?? {}) }
    for (const k of Object.keys(opts.fields)) stamp[k] = now
    const { error: uErr } = await supabase
      .from('members').update({ ...opts.fields, field_updated_at: stamp }).eq('id', keepId)
    if (uErr) console.error('mergeMembers: fusión OK, pero falló el update de campos del principal:', uErr.message)
  }
}

export type DuplicateMember = {
  id: string; first_name: string; last_name: string
  cedula: string | null; email: string | null; phone: string | null; created_at: string
  birth_date: string | null; province: string | null; canton: string | null
  occupation: string | null; photo_url: string | null
  field_updated_at: Record<string, string> | null
}
export type DuplicatePair = { a: DuplicateMember; b: DuplicateMember; reasons: string[] }

/** Pares de miembros probablemente duplicados (función find_duplicate_pairs). */
export async function getDuplicatePairs(): Promise<DuplicatePair[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('find_duplicate_pairs')
  if (error) throw error
  const pairs = (data ?? []) as Array<{ member_a: string; member_b: string; reasons: string[] }>
  const ids = [...new Set(pairs.flatMap(p => [p.member_a, p.member_b]))]
  if (ids.length === 0) return []
  const { data: members, error: mErr } = await supabase
    .from('members').select('id, first_name, last_name, cedula, email, phone, created_at, birth_date, province, canton, occupation, photo_url, field_updated_at').in('id', ids)
  if (mErr) throw mErr
  const byId = new Map((members ?? []).map(m => [m.id, m as DuplicateMember]))
  return pairs
    .map(p => ({ a: byId.get(p.member_a), b: byId.get(p.member_b), reasons: p.reasons }))
    .filter((p): p is DuplicatePair => !!p.a && !!p.b)
}

/** Marca un par como "no es duplicado" (no vuelve a sugerirse). */
export async function dismissDuplicatePair(idA: string, idB: string): Promise<void> {
  const supabase = createAdminClient()
  const [a, b] = idA < idB ? [idA, idB] : [idB, idA]
  const { error } = await supabase.from('duplicate_dismissals').upsert({ member_a: a, member_b: b }, { onConflict: 'member_a,member_b' })
  if (error) throw error
}

export async function createMember(member: Omit<DbMember, 'id' | 'created_at' | 'updated_at' | 'sede_id'>) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('members')
    .insert(member)
    .select()
    .single()

  if (error) throw error
  return data as DbMember
}

/** Crea una family_unit e inserta a todos sus integrantes en family_members. */
export async function createFamily(input: { name: string; members: Array<{ member_id: string; relation: string }> }) {
  const supabase = createAdminClient()
  const { data: unit, error: uErr } = await supabase
    .from('family_units')
    .insert({ name: input.name })
    .select('id')
    .single()
  if (uErr) throw uErr
  const unitId = (unit as { id: string }).id

  if (input.members.length > 0) {
    const rows = input.members.map(m => ({ family_unit_id: unitId, member_id: m.member_id, relation: m.relation }))
    const { error: mErr } = await supabase.from('family_members').insert(rows)
    if (mErr) throw mErr
  }
  return { id: unitId }
}

/** Devuelve los OTROS integrantes de la(s) familia(s) de un miembro (para check-in). */
export async function getMemberFamily(memberId: string): Promise<Array<{ member_id: string; name: string; relation: string }>> {
  const supabase = createAdminClient()
  // Unidades familiares a las que pertenece el miembro.
  const { data: own, error: oErr } = await supabase
    .from('family_members')
    .select('family_unit_id')
    .eq('member_id', memberId)
  if (oErr) throw oErr
  const unitIds = (own ?? []).map((r: { family_unit_id: string | null }) => r.family_unit_id).filter((x): x is string => x !== null)
  if (unitIds.length === 0) return []

  const { data, error } = await supabase
    .from('family_members')
    .select('member_id, relation, member:members!family_members_member_id_fkey(first_name, last_name)')
    .in('family_unit_id', unitIds)
    .neq('member_id', memberId)
  if (error) throw error

  const rows = (data ?? []) as Array<{ member_id: string; relation: string; member: { first_name: string; last_name: string } | null }>
  // Dedupe por member_id (puede aparecer en varias unidades).
  const seen = new Set<string>()
  const out: Array<{ member_id: string; name: string; relation: string }> = []
  for (const r of rows) {
    if (seen.has(r.member_id)) continue
    seen.add(r.member_id)
    out.push({ member_id: r.member_id, name: `${r.member?.first_name ?? ''} ${r.member?.last_name ?? ''}`.trim(), relation: r.relation })
  }
  return out
}

export async function updateMember(id: string, updates: Partial<DbMember>) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('members')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as DbMember
}

export async function deactivateMember(
  id: string,
  reason: string,
  deactivated_by: string,
) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('members')
    .update({
      is_active: false,
      deactivation_reason: reason,
      deactivated_at: new Date().toISOString(),
      deactivated_by,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as DbMember
}
