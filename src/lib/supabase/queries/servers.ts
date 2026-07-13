import { createAdminClient, type Insertable, type Updatable } from '@/lib/supabase/admin'
import { getAreaNameMap, type AreaMapEntry } from '@/lib/supabase/queries/_area-map'

// NOTA: createAdminClient (service role) porque la app corre con mock auth.

// ── Tipos crudos ───────────────────────────────────────────

export type DbCommittee = {
  id: string
  name: string
  ideal_capacity: number | null
  parent_id: string | null
  parent: { id: string; name: string } | null
  leader: { first_name: string; last_name: string } | null
  leader_id: string | null
  positions: Array<{
    id: string
    title: string
    description: string | null
    functions: string | null
    profile: string | null
    study_requirement: string | null
    volunteers: Array<{
      member_id: string
      status: 'active' | 'inactive' | 'on_leave' | 'pending'
      start_date: string | null
      member: { first_name: string; last_name: string; email: string | null; phone: string | null; birth_date: string | null } | null
    }>
  }>
}

export type DbVacancy = {
  id: string
  committee_id: string
  position_id: string | null
  committee: { name: string; parent: { name: string } | null } | null
  /** Contenido del puesto enlazado (descripción/funciones/perfil/nivel): la vacante
   *  los MUESTRA pero no los edita — viven en el puesto. */
  pos: { description: string | null; functions: string | null; profile: string | null; study_requirement: string | null } | null
  title: string
  position: string | null
  description: string | null
  functions: string[] | null
  schedule: string | null
  commitment: string | null
  slots_total: number
  slots_filled: number
  status: 'draft' | 'published' | 'filled' | 'closed' | 'creado' | 'enviado_lider' | 'aprobado' | 'denegado'
  published_at: string | null
  created_at: string
  expires_at: string | null
  location: string | null
  notes: string | null
  is_featured: boolean | null
  /** Conteo embebido de aplicaciones (PostgREST aggregate). */
  applications?: { count: number }[]
}

export type DbApplication = {
  id: string
  vacancy_id: string
  vacancy: { title: string; position: string | null; committee: { id: string; name: string; parent: { name: string } | null } | null } | null
  applicant_id: string
  applicant: { first_name: string; last_name: string } | null
  status: 'pending' | 'reviewing' | 'approved' | 'rejected'
  notes: string | null
  applied_at: string
}

export type DbCommitteeGoal = {
  id: string
  committee_id: string
  description: string
  status: 'in_progress' | 'completed'
  due_date: string | null
}

/** Área (areas con area_type='area'): nivel superior bajo el que cuelgan
 *  comités y al que un puesto puede tener como "área base". */
export type DbArea = {
  id: string
  name: string
  description: string | null
  area_type: 'area' | 'committee'
  parent_id: string | null
  leader_id: string | null
}

/** Puesto de servicio con el formato real (Excel): ubicación, cantidad,
 *  requisito de estudio (categoría), funciones, perfil, expiración, destacado,
 *  comité (area_id) y área base (base_area_id). */
export type DbServicePosition = {
  id: string
  area_id: string
  area: { id: string; name: string } | null
  base_area_id: string | null
  base_area: { id: string; name: string } | null
  title: string
  description: string | null
  location: string | null
  quantity: number | null
  study_requirement: string | null
  functions: string | null
  profile: string | null
  expires_at: string | null
  is_featured: boolean | null
  is_active: boolean | null
  /** Conteo embebido de servidores activos (para validación de borrado). */
  volunteers?: { count: number }[]
}

// ── Queries ────────────────────────────────────────────────

/** Comités (areas con area_type='committee') con líder y servidores. */
export async function getCommittees(): Promise<DbCommittee[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('areas')
    .select(`
      id, name, ideal_capacity, leader_id, parent_id,
      leader:members!areas_leader_id_fkey(first_name, last_name),
      positions:service_positions!service_positions_area_id_fkey(
        id, title, description, functions, profile, study_requirement,
        volunteers(
          member_id, status, start_date,
          member:members(first_name, last_name, email, phone, birth_date)
        )
      )
    `)
    .eq('area_type', 'committee')
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) throw error
  const areaMap = await getAreaNameMap(supabase)
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    parent: row.parent_id
      ? { id: row.parent_id as string, name: areaMap.get(row.parent_id as string)?.name ?? '' }
      : null,
  })) as DbCommittee[]
}

/** Comités (area_type='committee') que un miembro puede gestionar para solicitar
 *  vacantes/puestos: los que coordina directamente (areas.leader_id = memberId) y
 *  los que cuelgan de un ÁREA que lidera (parent_id ∈ áreas con leader_id = memberId).
 *  Los roles administrativos globales (admin/dirección/encargado_staff/coord.
 *  servidores) no se limitan por acá — eso se decide en el route. */
export async function getManageableCommitteeIds(memberId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data: led, error } = await supabase
    .from('areas').select('id, area_type').eq('leader_id', memberId)
  if (error) throw error
  const rows = (led ?? []) as Array<{ id: string; area_type: 'area' | 'committee' }>
  const direct = rows.filter(r => r.area_type === 'committee').map(r => r.id)
  const ledAreas = rows.filter(r => r.area_type === 'area').map(r => r.id)
  let children: string[] = []
  if (ledAreas.length) {
    const { data: kids } = await supabase
      .from('areas').select('id').eq('area_type', 'committee').in('parent_id', ledAreas)
    children = ((kids ?? []) as Array<{ id: string }>).map(r => r.id)
  }
  return [...new Set([...direct, ...children])]
}

/** Comité (area_id) de una vacante — para verificar permiso de gestión. */
export async function getVacancyCommitteeId(vacancyId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('vacancies').select('committee_id').eq('id', vacancyId).maybeSingle()
  return (data as { committee_id: string | null } | null)?.committee_id ?? null
}

export async function getVacancies(): Promise<DbVacancy[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vacancies')
    .select(`
      id, committee_id, position_id, title, position, description, functions, schedule, commitment,
      slots_total, slots_filled, status, published_at, created_at, expires_at, location, notes, is_featured,
      committee:areas!vacancies_committee_id_fkey(name),
      pos:service_positions!vacancies_position_id_fkey(description, functions, profile, study_requirement),
      applications:applications(count)
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  const areaMap = await getAreaNameMap(supabase)
  return (data ?? []).map((row: Record<string, unknown>) => {
    const entry = row.committee_id ? areaMap.get(row.committee_id as string) : undefined
    const parentName = entry?.parent_id ? areaMap.get(entry.parent_id)?.name ?? '' : ''
    const committee = row.committee as { name: string } | null
    return { ...row, committee: committee ? { name: committee.name, parent: { name: parentName } } : null }
  }) as DbVacancy[]
}

const APPLICATION_SELECT = `
  id, vacancy_id, applicant_id, status, notes, applied_at,
  vacancy:vacancies(title, position, committee:areas!vacancies_committee_id_fkey(id, name)),
  applicant:members!applications_applicant_id_fkey(first_name, last_name)
`

/** Resuelve el nombre del área padre del comité de cada aplicación (el embed
 *  self-FK parent es poco fiable; ver getAreaNameMap). */
function patchApplicationsAreas(rows: DbApplication[], areaMap: Map<string, AreaMapEntry>): DbApplication[] {
  for (const row of rows) {
    const committee = row.vacancy?.committee
    if (!committee) continue
    const parentId = areaMap.get(committee.id)?.parent_id
    committee.parent = { name: parentId ? areaMap.get(parentId)?.name ?? '' : '' }
  }
  return rows
}

export async function getApplications(): Promise<DbApplication[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('applications')
    .select(APPLICATION_SELECT)
    .order('applied_at', { ascending: false })
  if (error) throw error
  const areaMap = await getAreaNameMap(supabase)
  return patchApplicationsAreas((data ?? []) as DbApplication[], areaMap)
}

export type ApplicationFilters = {
  search?: string
  status?: 'pending' | 'reviewing' | 'approved' | 'rejected'
  committeeId?: string
  page?: number
  pageSize?: number
}

/** Aplicaciones paginadas con filtros server-side. La búsqueda matchea nombre
 *  del aplicante o título de la vacante; el comité se filtra por sus vacantes. */
export async function getApplicationsPage(filters: ApplicationFilters = {}): Promise<{ rows: DbApplication[]; total: number }> {
  const supabase = createAdminClient()
  const page = Math.max(1, Math.trunc(filters.page ?? 1))
  const pageSize = Math.min(200, Math.max(1, Math.trunc(filters.pageSize ?? 50)))
  const search = filters.search?.trim()

  // Comité → ids de sus vacantes (las applications referencian vacancy_id).
  let committeeVacancyIds: string[] | null = null
  if (filters.committeeId) {
    const { data } = await supabase.from('vacancies').select('id').eq('committee_id', filters.committeeId)
    committeeVacancyIds = ((data ?? []) as Array<{ id: string }>).map(v => v.id)
    if (committeeVacancyIds.length === 0) return { rows: [], total: 0 }
  }

  // Búsqueda → ids de miembros (por nombre) + ids de vacantes (por título).
  let searchOr: string | null = null
  if (search) {
    const like = `%${search.replace(/[%,().*\\]/g, '')}%`
    const [memRes, vacRes] = await Promise.all([
      supabase.from('members').select('id').or(`first_name.ilike.${like},last_name.ilike.${like}`).limit(500),
      supabase.from('vacancies').select('id').ilike('title', like).limit(500),
    ])
    const memIds = ((memRes.data ?? []) as Array<{ id: string }>).map(m => m.id)
    const vacIds = ((vacRes.data ?? []) as Array<{ id: string }>).map(v => v.id)
    const parts: string[] = []
    if (memIds.length) parts.push(`applicant_id.in.(${memIds.join(',')})`)
    if (vacIds.length) parts.push(`vacancy_id.in.(${vacIds.join(',')})`)
    if (parts.length === 0) return { rows: [], total: 0 } // sin coincidencias
    searchOr = parts.join(',')
  }

  let q = supabase
    .from('applications')
    .select(APPLICATION_SELECT, { count: 'exact' })
    .order('applied_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (filters.status) q = q.eq('status', filters.status)
  if (committeeVacancyIds) q = q.in('vacancy_id', committeeVacancyIds)
  if (searchOr) q = q.or(searchOr)

  const { data, error, count } = await q
  if (error) throw error
  const areaMap = await getAreaNameMap(supabase)
  return { rows: patchApplicationsAreas((data ?? []) as DbApplication[], areaMap), total: count ?? 0 }
}

/** Conteos globales de aplicaciones por estado (para los badges del header). */
export async function getApplicationStats(): Promise<{ pending: number; reviewing: number }> {
  const supabase = createAdminClient()
  const [p, r] = await Promise.all([
    supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'reviewing'),
  ])
  return { pending: p.count ?? 0, reviewing: r.count ?? 0 }
}

/** Áreas (areas con area_type='area') para dropdowns de área padre / área base. */
export async function getAreas(): Promise<DbArea[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('areas')
    .select('id, name, description, area_type, parent_id, leader_id')
    .eq('area_type', 'area')
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as DbArea[]
}

const SERVICE_POSITION_SELECT = `
  id, area_id, base_area_id, title, description, location, quantity,
  study_requirement, functions, profile, expires_at, is_featured, is_active,
  area:areas!service_positions_area_id_fkey(id, name),
  base_area:areas!service_positions_base_area_id_fkey(id, name),
  volunteers:volunteers(count)
`

/** Puestos de servicio con comité, área base y conteo de servidores. */
export async function getServicePositions(): Promise<DbServicePosition[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('service_positions')
    .select(SERVICE_POSITION_SELECT)
    .order('title', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as DbServicePosition[]
}

export async function getCommitteeGoals(): Promise<DbCommitteeGoal[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('committee_goals')
    .select('id, committee_id, description, status, due_date')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbCommitteeGoal[]
}

// ── Mutaciones ─────────────────────────────────────────────

export type VacancyWriteInput = {
  committee_id: string
  position_id?: string | null
  title: string
  position?: string | null
  description?: string | null
  functions?: string[]
  schedule?: string | null
  commitment?: string | null
  slots_total?: number
  status?: 'draft' | 'published' | 'filled' | 'closed' | 'creado' | 'enviado_lider' | 'aprobado' | 'denegado'
  expires_at?: string | null
  location?: string | null
  notes?: string | null
  is_featured?: boolean
}

// Vacantes
export async function createVacancy(input: VacancyWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const row = { ...input, published_at: input.status === 'published' ? new Date().toISOString() : null }
  const { data, error } = await supabase.from('vacancies').insert(row).select('id').single()
  if (error) throw error
  return data as { id: string }
}

/** Crea las vacantes de una solicitud (carrito del comité): una vacante por
 *  puesto con `slots_total = cantidad` y estado 'creado'. Devuelve filas creadas
 *  y total de cupos. Ignora ítems con cantidad <= 0. */
export async function createVacancyRequests(
  committeeId: string,
  items: Array<{ position_id: string; quantity: number }>,
): Promise<{ rows: number; slots: number }> {
  const supabase = createAdminClient()
  const valid = items.filter(i => i.position_id && Number(i.quantity) > 0)
  if (valid.length === 0) return { rows: 0, slots: 0 }

  const { data: positions, error: pErr } = await supabase
    .from('service_positions').select('id, title, area_id').in('id', valid.map(i => i.position_id))
  if (pErr) throw pErr
  const posById = new Map(
    ((positions ?? []) as Array<{ id: string; title: string; area_id: string }>).map(p => [p.id, p]),
  )
  // Defensa: el puesto debe pertenecer al comité indicado.
  const rows = valid
    .filter(i => posById.get(i.position_id)?.area_id === committeeId)
    .map(i => ({
      committee_id: committeeId,
      position_id: i.position_id,
      title: posById.get(i.position_id)!.title,
      slots_total: Math.floor(Number(i.quantity)),
      status: 'creado' as const,
    }))
  if (rows.length === 0) return { rows: 0, slots: 0 }

  const { error } = await supabase.from('vacancies').insert(rows)
  if (error) throw error
  return { rows: rows.length, slots: rows.reduce((s, r) => s + r.slots_total, 0) }
}

export async function updateVacancy(id: string, patch: Partial<VacancyWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const row: Record<string, unknown> = { ...patch }
  // Al publicar, sellamos published_at si no estaba puesto.
  if (patch.status === 'published') row.published_at = new Date().toISOString()
  const { error } = await supabase.from('vacancies').update(row as Updatable<'vacancies'>).eq('id', id)
  if (error) throw error
}

export async function deleteVacancy(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('vacancies').delete().eq('id', id)
  if (error) throw error
}

// Aplicaciones
export async function createApplication(input: {
  vacancy_id: string
  applicant_id: string
  notes?: string | null
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('applications').insert(input)
  if (error) throw error
}

/** Cambia el estado de una aplicación. Al APROBAR, todo (estado + activación del
 *  servidor + slots_filled) ocurre en una sola transacción vía la función
 *  approve_applications (5b): reactiva sin duplicar y NO dispara correos. */
export async function setApplicationStatus(
  id: string,
  status: 'pending' | 'reviewing' | 'approved' | 'rejected',
): Promise<void> {
  const supabase = createAdminClient()
  if (status === 'approved') {
    // RPC fuera de los tipos generados (migración 103) → cast localizado.
    const { error } = await supabase.rpc('approve_applications' as never, { app_ids: [id] } as never)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('applications').update({ status }).eq('id', id)
  if (error) throw error
}

/** Aprueba varias aplicaciones a la vez (bulk, 5b). Cada aprobación activa al
 *  aplicante como servidor del puesto/comité de su vacante, en una sola
 *  transacción. Devuelve cuántos servidores se activaron. No dispara correos. */
export async function approveApplications(ids: string[]): Promise<{ activated: number }> {
  if (ids.length === 0) return { activated: 0 }
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('approve_applications' as never, { app_ids: ids } as never)
  if (error) throw error
  return { activated: typeof data === 'number' ? data : 0 }
}

/** Cambia el estado de varias vacantes (solicitud de cupos) a la vez (bulk, punto 6).
 *  No toca aplicaciones ni servidores — es el flujo de la solicitud de cupos. */
export async function setVacanciesStatus(
  ids: string[],
  status: 'enviado_lider' | 'aprobado' | 'denegado',
): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 }
  const supabase = createAdminClient()
  const { error, count } = await supabase
    .from('vacancies')
    .update({ status }, { count: 'exact' })
    .in('id', ids)
  if (error) throw error
  return { updated: count ?? ids.length }
}

/** Coordinadores de servidores activos (candidatos para asignar aplicaciones). */
export async function getServiceCoordinators(): Promise<Array<{ member_id: string; member_name: string }>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(first_name, last_name, is_active)')
    .eq('role', 'coordinador_servidores')
    .eq('is_active', true)
  if (error) throw error
  const byId = new Map<string, string>()
  for (const r of (data ?? []) as Array<{ member_id: string; member: { first_name: string; last_name: string; is_active: boolean } | null }>) {
    if (!r.member || r.member.is_active === false) continue
    byId.set(r.member_id, `${r.member.first_name} ${r.member.last_name}`.trim())
  }
  return [...byId].map(([member_id, member_name]) => ({ member_id, member_name }))
    .sort((a, b) => a.member_name.localeCompare(b.member_name))
}

// Metas de comité
export async function createGoal(input: {
  committee_id: string
  description: string
  due_date?: string | null
}): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('committee_goals').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function updateGoal(
  id: string,
  patch: { description?: string; status?: 'in_progress' | 'completed'; due_date?: string | null },
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('committee_goals').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteGoal(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('committee_goals').delete().eq('id', id)
  if (error) throw error
}

// Comité (area). parent_id = área padre; leader_id = encargado del comité.
export async function updateCommittee(
  id: string,
  patch: { name?: string; description?: string | null; leader_id?: string | null; parent_id?: string | null },
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('areas').update(patch).eq('id', id)
  if (error) throw error
}

// Áreas / comités (filas de `areas`) — para el mantenimiento CRUD.
export async function createArea(input: {
  name: string
  area_type: 'area' | 'committee'
  description?: string | null
  parent_id?: string | null
  leader_id?: string | null
}): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('areas')
    .insert({ ...input, is_active: true })
    .select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function updateArea(
  id: string,
  patch: { name?: string; description?: string | null; parent_id?: string | null; leader_id?: string | null; is_active?: boolean },
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('areas').update(patch).eq('id', id)
  if (error) throw error
}

/** Elimina un área o comité (fila de `areas`). El caller debe verificar antes que
 *  no tenga servidores activos / puestos / comités hijos. */
export async function deleteArea(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('areas').delete().eq('id', id)
  if (error) throw error
}

/** Cuenta entidades activas ligadas a un área/comité (para ActiveWarningModal):
 *  servidores activos en sus puestos, puestos y comités hijos. */
export async function countAreaLinks(id: string): Promise<{ activeVolunteers: number; positions: number; childCommittees: number }> {
  const supabase = createAdminClient()
  const { data: positions } = await supabase.from('service_positions').select('id').eq('area_id', id)
  const positionIds = ((positions ?? []) as Array<{ id: string }>).map(p => p.id)
  let activeVolunteers = 0
  if (positionIds.length) {
    const { count } = await supabase
      .from('volunteers').select('id', { count: 'exact', head: true })
      .in('position_id', positionIds).eq('status', 'active')
    activeVolunteers = count ?? 0
  }
  const { count: childCount } = await supabase
    .from('areas').select('id', { count: 'exact', head: true }).eq('parent_id', id)
  return { activeVolunteers, positions: positionIds.length, childCommittees: childCount ?? 0 }
}

// Puestos (service_positions) — formato real del Excel.
export type ServicePositionWriteInput = {
  area_id: string
  base_area_id?: string | null
  title: string
  description?: string | null
  location?: string | null
  quantity?: number | null
  study_requirement?: string | null
  functions?: string | null
  profile?: string | null
  expires_at?: string | null
  is_featured?: boolean
}

export async function createServicePosition(input: ServicePositionWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('service_positions')
    .insert({
      ...input,
      quantity: input.quantity ?? 1,
      max_volunteers: input.quantity ?? 1, // compat con la columna vieja
      is_active: true,
    })
    .select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function updateServicePosition(id: string, patch: Partial<ServicePositionWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const row: Record<string, unknown> = { ...patch }
  if (patch.quantity !== undefined) row.max_volunteers = patch.quantity // mantener columna vieja en sync
  const { error } = await supabase.from('service_positions').update(row as Updatable<'service_positions'>).eq('id', id)
  if (error) throw error
}

/** Servidores activos en un puesto (para ActiveWarningModal antes de borrar). */
export async function countActivePositionVolunteers(positionId: string): Promise<number> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('volunteers').select('id', { count: 'exact', head: true })
    .eq('position_id', positionId).eq('status', 'active')
  return count ?? 0
}

export async function deleteServicePosition(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('service_positions').delete().eq('id', id)
  if (error) throw error
}

/** Importación bulk de puestos desde Excel/CSV. Matchea el comité por nombre
 *  (case-insensitive) contra areas de tipo committee; evita duplicados por
 *  (title + area_id + location). Reporta filas sin comité para revisión. */
export type ImportPositionRow = {
  committee: string
  location?: string | null
  title: string
  quantity?: number | null
  description?: string | null
  study_requirement?: string | null
  functions?: string | null
  profile?: string | null
  expires_at?: string | null
  is_featured?: boolean
}

export type ImportPositionsResult = {
  inserted: number
  duplicates: number
  unmatched: Array<{ row: number; committee: string; title: string }>
}

export async function importServicePositions(rows: ImportPositionRow[]): Promise<ImportPositionsResult> {
  const supabase = createAdminClient()

  // Comités por nombre normalizado (lower/trim) → id.
  const { data: committees } = await supabase
    .from('areas').select('id, name').eq('area_type', 'committee')
  const byName = new Map<string, string>()
  for (const c of (committees ?? []) as Array<{ id: string; name: string }>) {
    byName.set(c.name.trim().toLowerCase(), c.id)
  }

  // Puestos existentes para deduplicar (title|area_id|location normalizados).
  const { data: existing } = await supabase
    .from('service_positions').select('title, area_id, location')
  const seen = new Set<string>()
  const dupKey = (areaId: string, title: string, location: string | null | undefined) =>
    `${areaId}|${title.trim().toLowerCase()}|${(location ?? '').trim().toLowerCase()}`
  for (const p of (existing ?? []) as Array<{ title: string; area_id: string; location: string | null }>) {
    seen.add(dupKey(p.area_id, p.title, p.location))
  }

  const unmatched: ImportPositionsResult['unmatched'] = []
  const toInsert: Record<string, unknown>[] = []
  let duplicates = 0

  rows.forEach((r, i) => {
    const areaId = byName.get((r.committee ?? '').trim().toLowerCase())
    if (!areaId) { unmatched.push({ row: i + 1, committee: r.committee, title: r.title }); return }
    const key = dupKey(areaId, r.title, r.location)
    if (seen.has(key)) { duplicates++; return }
    seen.add(key)
    toInsert.push({
      area_id: areaId,
      title: r.title,
      location: r.location ?? null,
      quantity: r.quantity ?? 1,
      max_volunteers: r.quantity ?? 1,
      description: r.description ?? null,
      study_requirement: r.study_requirement ?? null,
      functions: r.functions ?? null,
      profile: r.profile ?? null,
      expires_at: r.expires_at ?? null,
      is_featured: r.is_featured ?? false,
      is_active: true,
    })
  })

  if (toInsert.length > 0) {
    const { error } = await supabase.from('service_positions').insert(toInsert as Insertable<'service_positions'>[])
    if (error) throw error
  }
  return { inserted: toInsert.length, duplicates, unmatched }
}

// Servidores (volunteers en una posición)
export async function assignVolunteer(positionId: string, memberId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('volunteers')
    .upsert(
      // end_date: null limpia la fecha de baja al REACTIVAR (removeVolunteer la
      // setea; sin esto el registro quedaba activo con fin en el pasado).
      { position_id: positionId, member_id: memberId, status: 'active', start_date: new Date().toISOString().slice(0, 10), end_date: null },
      { onConflict: 'member_id,position_id' },
    )
  if (error) throw error
}

export async function removeVolunteer(positionId: string, memberId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('volunteers')
    .update({ status: 'inactive', end_date: new Date().toISOString().slice(0, 10) })
    .eq('position_id', positionId)
    .eq('member_id', memberId)
  if (error) throw error
}

// ── Solicitudes de puesto nuevo (position_requests) ──────────────────────────
export type DbPositionRequest = {
  id: string
  committee_id: string
  committee: { name: string } | null
  title: string
  description: string | null
  functions: string | null
  profile: string | null
  study_requirement: string | null
  status: 'pending' | 'approved' | 'rejected'
  requested_by: string | null
  requester: { first_name: string; last_name: string } | null
  reviewed_at: string | null
  created_at: string
}

export type PositionRequestInput = {
  committee_id: string
  title: string
  description?: string | null
  functions?: string | null
  profile?: string | null
  study_requirement?: string | null
  requested_by?: string | null
}

/** Crea una solicitud de puesto nuevo (estado 'pending'; NO crea el puesto). */
export async function createPositionRequest(input: PositionRequestInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('position_requests').insert({
    committee_id: input.committee_id,
    title: input.title,
    description: input.description ?? null,
    functions: input.functions ?? null,
    profile: input.profile ?? null,
    study_requirement: input.study_requirement ?? null,
    requested_by: input.requested_by ?? null,
    status: 'pending',
  }).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function getPositionRequests(status?: 'pending' | 'approved' | 'rejected'): Promise<DbPositionRequest[]> {
  const supabase = createAdminClient()
  let q = supabase.from('position_requests').select(`
    id, committee_id, title, description, functions, profile, study_requirement, status, requested_by, reviewed_at, created_at,
    committee:areas!position_requests_committee_id_fkey(name),
    requester:members!position_requests_requested_by_fkey(first_name, last_name)
  `).order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as DbPositionRequest[]
}

/** Aprueba la solicitud: crea el puesto en el catálogo y marca la solicitud. */
export async function approvePositionRequest(id: string, reviewerId: string | null): Promise<{ position_id: string }> {
  const supabase = createAdminClient()
  const { data: reqRow, error: e1 } = await supabase.from('position_requests')
    .select('committee_id, title, description, functions, profile, study_requirement, status').eq('id', id).maybeSingle()
  if (e1) throw e1
  const req = reqRow as { committee_id: string; title: string; description: string | null; functions: string | null; profile: string | null; study_requirement: string | null; status: string } | null
  if (!req) throw new Error('Solicitud no encontrada')
  if (req.status !== 'pending') throw new Error('La solicitud ya fue resuelta')
  const { id: positionId } = await createServicePosition({
    area_id: req.committee_id,
    title: req.title,
    description: req.description,
    functions: req.functions,
    profile: req.profile,
    study_requirement: req.study_requirement,
  })
  const { error: e2 } = await supabase.from('position_requests').update({
    status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), created_position_id: positionId,
  }).eq('id', id)
  if (e2) throw e2
  return { position_id: positionId }
}

export async function rejectPositionRequest(id: string, reviewerId: string | null): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('position_requests').update({
    status: 'rejected', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
}
