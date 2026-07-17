import { createAdminClient, type Insertable, type Updatable } from '@/lib/supabase/admin'
import { getAreaNameMap, parentAreaName } from '@/lib/supabase/queries/_area-map'
import type { ContractType, VacationRecordType, VacationRecordStatus, DocumentType } from '@/types/employee'

// NOTA: createAdminClient (service role) porque la app corre con mock auth.

export type DbEmployee = {
  id: string
  member_id: string | null
  member: { first_name: string; last_name: string; email: string | null } | null
  position_id: string | null
  position: { name: string; committee: { name: string; parent: { name: string } | null } | null } | null
  contract_type: ContractType | null
  start_date: string
  end_date: string | null
  salary: number | null
  status: 'active' | 'inactive' | 'on_leave' | 'terminated'
  vacation_days_total: number
  vacation_days_used: number
  notes: string | null
  salary_changes: Array<{
    change_date: string
    previous_salary: number | null
    new_salary: number
    reason: string | null
    approved_by: string | null
  }>
  position_records: Array<{
    position_name: string
    start_date: string | null
    end_date: string | null
    contract_type: ContractType | null
  }>
  vacation_records: Array<{
    id: string
    type: VacationRecordType
    start_date: string
    end_date: string
    days: number
    status: VacationRecordStatus
    notes: string | null
  }>
  documents: Array<{
    id: string
    title: string
    doc_type: DocumentType
    file_url: string | null
    created_at: string
  }>
}

export type DbPaidPosition = {
  id: string
  name: string
  committee_id: string | null
  committee: { name: string; parent: { name: string } | null } | null
  description: string | null
  contract_type: ContractType | null
  salary_min: number | null
  salary_max: number | null
  is_active: boolean
  created_at: string
}

export async function getEmployees(): Promise<DbEmployee[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('employees')
    .select(`
      id, member_id, position_id, contract_type, start_date, end_date, salary, status,
      vacation_days_total, vacation_days_used, notes,
      member:members(first_name, last_name, email),
      position:paid_positions(name, committee:areas!paid_positions_committee_id_fkey(id, name)),
      salary_changes(change_date, previous_salary, new_salary, reason, approved_by),
      position_records(position_name, start_date, end_date, contract_type),
      vacation_records(id, type, start_date, end_date, days, status, notes),
      documents:employee_documents(id, title, doc_type, file_url, created_at)
    `)
    .order('start_date', { ascending: false })
  if (error) throw error
  // Resolver el área padre del comité con el mapa (el embed parent no es fiable).
  const areaMap = await getAreaNameMap(supabase)
  for (const row of (data ?? []) as Array<{ position?: { committee?: { id: string; name: string; parent?: { name: string } | null } | null } | null }>) {
    const committee = row.position?.committee
    if (committee) committee.parent = { name: parentAreaName(areaMap, committee.id) }
  }
  return (data ?? []) as DbEmployee[]
}

export async function getPaidPositions(): Promise<DbPaidPosition[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('paid_positions')
    .select(`
      id, name, committee_id, description, contract_type, salary_min, salary_max, is_active, created_at,
      committee:areas!paid_positions_committee_id_fkey(id, name)
    `)
    .order('name', { ascending: true })
  if (error) throw error
  const areaMap = await getAreaNameMap(supabase)
  for (const row of (data ?? []) as Array<{ committee?: { id: string; name: string; parent?: { name: string } | null } | null }>) {
    if (row.committee) row.committee.parent = { name: parentAreaName(areaMap, row.committee.id) }
  }
  return (data ?? []) as DbPaidPosition[]
}

// ── Mutaciones ─────────────────────────────────────────────

export type PositionWriteInput = {
  name: string
  committee_id?: string | null
  description?: string | null
  contract_type?: ContractType | null
  salary_min?: number | null
  salary_max?: number | null
  is_active?: boolean
}

export async function createPosition(input: PositionWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('paid_positions').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function updatePosition(id: string, patch: Partial<PositionWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('paid_positions').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePosition(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('paid_positions').delete().eq('id', id)
  if (error) throw error
}

export type EmployeeWriteInput = {
  member_id?: string | null
  position_id?: string | null
  position?: string | null // columna legacy NOT NULL; se rellena desde el puesto si falta
  contract_type?: ContractType | null
  start_date?: string
  end_date?: string | null
  salary?: number | null
  status?: 'active' | 'inactive' | 'on_leave' | 'terminated'
  vacation_days_total?: number
  notes?: string | null
}

export async function createEmployee(input: EmployeeWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const row: EmployeeWriteInput = { ...input }
  // `position` (texto) es NOT NULL. Si no viene, lo derivamos del puesto pagado.
  if (!row.position) {
    if (row.position_id) {
      const { data: pos } = await supabase
        .from('paid_positions').select('name').eq('id', row.position_id).maybeSingle()
      row.position = (pos as { name: string } | null)?.name ?? 'Sin definir'
    } else {
      row.position = 'Sin definir'
    }
  }
  const { data, error } = await supabase.from('employees').insert(row as Insertable<'employees'>).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function updateEmployee(id: string, patch: Partial<EmployeeWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('employees').update(patch as Updatable<'employees'>).eq('id', id)
  if (error) throw error
}

/** Registra un cambio de salario: inserta en el historial (previous = actual) y
 *  actualiza el salario vigente del empleado. */
export async function recordSalaryChange(
  employeeId: string,
  newSalary: number,
  reason?: string,
): Promise<void> {
  const supabase = createAdminClient()
  const { data: emp, error: eErr } = await supabase
    .from('employees').select('salary').eq('id', employeeId).single()
  if (eErr) throw eErr
  const previous = (emp as { salary: number | null }).salary

  const { error: hErr } = await supabase.from('salary_changes').insert({
    employee_id: employeeId,
    previous_salary: previous,
    new_salary: newSalary,
    reason: reason ?? null,
  })
  if (hErr) throw hErr

  const { error: uErr } = await supabase.from('employees').update({ salary: newSalary }).eq('id', employeeId)
  if (uErr) throw uErr
}

export type VacationWriteInput = {
  employee_id: string
  type: VacationRecordType
  start_date: string
  end_date: string
  days: number
  status?: VacationRecordStatus
  notes?: string | null
}

export async function createVacationRecord(input: VacationWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('vacation_records').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

/** Cambia el estado de una solicitud de vacaciones ajustando el contador de
 *  días por TRANSICIÓN (entra a 'aprobado' → suma; sale de 'aprobado' →
 *  resta). El update es condicional al estado leído: un doble clic o dos
 *  revisores simultáneos no duplican el descuento (la segunda pasada no
 *  matchea y lanza YA_PROCESADO). */
export async function setVacationStatus(id: string, status: VacationRecordStatus): Promise<void> {
  const supabase = createAdminClient()
  const { data: cur, error: curErr } = await supabase
    .from('vacation_records').select('status, employee_id, days, type').eq('id', id).maybeSingle()
  if (curErr) throw curErr
  if (!cur) throw new Error('YA_PROCESADO')
  const rec = cur as { status: VacationRecordStatus; employee_id: string; days: number; type: VacationRecordType }
  if (rec.status === status) throw new Error('YA_PROCESADO')

  const { data: updated, error } = await supabase
    .from('vacation_records').update({ status })
    .eq('id', id).eq('status', rec.status)
    .select('id')
  if (error) throw error
  if ((updated ?? []).length === 0) throw new Error('YA_PROCESADO')

  const delta = rec.type !== 'vacaciones' ? 0
    : status === 'aprobado' ? rec.days
    : rec.status === 'aprobado' ? -rec.days
    : 0
  if (delta !== 0) {
    // QA 2026-07-17: incremento atómico en BD (RPC, migración 134) — el
    // read-then-write anterior perdía un ajuste cuando dos solicitudes del
    // mismo empleado se aprobaban casi simultáneamente (lost update).
    const { error: uErr } = await supabase
      .rpc('increment_vacation_days_used', { p_employee_id: rec.employee_id, p_delta: delta })
    if (uErr) throw uErr
  }
}

export type DocumentWriteInput = {
  employee_id: string
  title: string
  doc_type: DocumentType
  file_url?: string | null
  expires_at?: string | null
  notes?: string | null
}

export async function addEmployeeDocument(input: DocumentWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('employee_documents').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function deleteEmployeeDocument(id: string): Promise<void> {
  const supabase = createAdminClient()
  // Borra primero el REGISTRO (guardando el path antes) y el archivo después,
  // best-effort: un archivo huérfano en el bucket es inofensivo, pero un registro
  // apuntando a un archivo inexistente rompe la descarga (404). El cron
  // /api/cron/storage-orphans reporta los huérfanos que queden.
  const { data } = await supabase.from('employee_documents').select('file_url').eq('id', id).maybeSingle()
  const path = (data as { file_url: string | null } | null)?.file_url
  const { error } = await supabase.from('employee_documents').delete().eq('id', id)
  if (error) throw error
  if (path) {
    const { error: rmErr } = await supabase.storage.from(EMPLOYEE_DOCS_BUCKET).remove([path])
    if (rmErr) console.warn(`deleteEmployeeDocument: quedó archivo huérfano en storage (${path}):`, rmErr.message)
  }
}

// ── Storage de documentos ──────────────────────────────────
export const EMPLOYEE_DOCS_BUCKET = 'employee-docs'

/** Sube un archivo al bucket privado y devuelve la ruta (que se guarda en file_url). */
export async function uploadEmployeeDocFile(
  employeeId: string,
  fileName: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
  stamp: number,
): Promise<string> {
  const supabase = createAdminClient()
  const safe = fileName.replace(/[^\w.\-]+/g, '_')
  const path = `${employeeId}/${stamp}-${safe}`
  const { error } = await supabase.storage
    .from(EMPLOYEE_DOCS_BUCKET)
    .upload(path, body, { contentType, upsert: false })
  if (error) throw error
  return path
}

/** URL firmada temporal para ver/descargar un documento privado. */
export async function getEmployeeDocSignedUrl(id: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('employee_documents').select('file_url').eq('id', id).maybeSingle()
  const path = (data as { file_url: string | null } | null)?.file_url
  if (!path) return null
  const { data: signed, error } = await supabase.storage
    .from(EMPLOYEE_DOCS_BUCKET).createSignedUrl(path, 300)
  if (error) throw error
  return signed?.signedUrl ?? null
}
