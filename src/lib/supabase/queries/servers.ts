import { createAdminClient } from '@/lib/supabase/admin'

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
  committee: { name: string; parent: { name: string } | null } | null
  title: string
  position: string | null
  description: string | null
  functions: string[] | null
  schedule: string | null
  commitment: string | null
  slots_total: number
  slots_filled: number
  status: 'draft' | 'published' | 'filled' | 'closed'
  published_at: string | null
  created_at: string
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

// ── Queries ────────────────────────────────────────────────

/** Comités (areas con area_type='committee') con líder y servidores. */
export async function getCommittees(): Promise<DbCommittee[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('areas')
    .select(`
      id, name, ideal_capacity, leader_id, parent_id,
      parent:areas!parent_id(id, name),
      leader:members!areas_leader_id_fkey(first_name, last_name),
      positions:service_positions(
        id, title,
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
  return (data ?? []) as unknown as DbCommittee[]
}

export async function getVacancies(): Promise<DbVacancy[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vacancies')
    .select(`
      id, committee_id, title, position, description, functions, schedule, commitment,
      slots_total, slots_filled, status, published_at, created_at,
      committee:areas!vacancies_committee_id_fkey(name, parent:areas!parent_id(name))
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbVacancy[]
}

export async function getApplications(): Promise<DbApplication[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id, vacancy_id, applicant_id, status, notes, applied_at,
      vacancy:vacancies(title, position, committee:areas!vacancies_committee_id_fkey(id, name, parent:areas!parent_id(name))),
      applicant:members(first_name, last_name)
    `)
    .order('applied_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbApplication[]
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
  status?: 'draft' | 'published' | 'filled' | 'closed'
}

// Vacantes
export async function createVacancy(input: VacancyWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const row = { ...input, published_at: input.status === 'published' ? new Date().toISOString() : null }
  const { data, error } = await supabase.from('vacancies').insert(row).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function updateVacancy(id: string, patch: Partial<VacancyWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const row: Record<string, unknown> = { ...patch }
  // Al publicar, sellamos published_at si no estaba puesto.
  if (patch.status === 'published') row.published_at = new Date().toISOString()
  const { error } = await supabase.from('vacancies').update(row).eq('id', id)
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

/** Cambia el estado de una aplicación. Al aprobar, si la vacante tiene posición
 *  asociada, crea el volunteer e incrementa slots_filled. */
export async function setApplicationStatus(
  id: string,
  status: 'pending' | 'reviewing' | 'approved' | 'rejected',
): Promise<void> {
  const supabase = createAdminClient()

  if (status === 'approved') {
    const { data: app, error: aErr } = await supabase
      .from('applications')
      .select('applicant_id, vacancy:vacancies(id, position_id, slots_filled)')
      .eq('id', id)
      .single()
    if (aErr) throw aErr

    const row = app as unknown as {
      applicant_id: string
      vacancy: { id: string; position_id: string | null; slots_filled: number } | Array<{ id: string; position_id: string | null; slots_filled: number }> | null
    }
    const vac = Array.isArray(row.vacancy) ? row.vacancy[0] ?? null : row.vacancy
    const applicantId = row.applicant_id

    if (vac?.position_id) {
      const { error: vErr } = await supabase
        .from('volunteers')
        .upsert(
          { member_id: applicantId, position_id: vac.position_id, status: 'active' },
          { onConflict: 'member_id,position_id' },
        )
      if (vErr) throw vErr
      const { error: sErr } = await supabase
        .from('vacancies')
        .update({ slots_filled: (vac.slots_filled ?? 0) + 1 })
        .eq('id', vac.id)
      if (sErr) throw sErr
    }
  }

  const { error } = await supabase.from('applications').update({ status }).eq('id', id)
  if (error) throw error
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

// Comité (area)
export async function updateCommittee(
  id: string,
  patch: { name?: string; leader_id?: string | null; ideal_capacity?: number | null },
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('areas').update(patch).eq('id', id)
  if (error) throw error
}

// Puestos (service_positions)
export async function createServicePosition(input: {
  area_id: string
  title: string
  description?: string | null
  max_volunteers?: number
}): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('service_positions')
    .insert({ ...input, max_volunteers: input.max_volunteers ?? 1, is_active: true })
    .select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function deleteServicePosition(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('service_positions').delete().eq('id', id)
  if (error) throw error
}

/** Elimina un área o comité (fila de `areas`). El caller debe verificar antes que
 *  no tenga servidores activos. */
export async function deleteArea(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('areas').delete().eq('id', id)
  if (error) throw error
}

// Servidores (volunteers en una posición)
export async function assignVolunteer(positionId: string, memberId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('volunteers')
    .upsert(
      { position_id: positionId, member_id: memberId, status: 'active', start_date: new Date().toISOString().slice(0, 10) },
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
