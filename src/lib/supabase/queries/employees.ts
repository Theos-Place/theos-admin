import { createAdminClient, type Insertable, type Updatable } from '@/lib/supabase/admin'
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
      position:paid_positions(name, committee:areas!paid_positions_committee_id_fkey(name, parent:areas!parent_id(name))),
      salary_changes(change_date, previous_salary, new_salary, reason, approved_by),
      position_records(position_name, start_date, end_date, contract_type),
      vacation_records(id, type, start_date, end_date, days, status, notes),
      documents:employee_documents(id, title, doc_type, file_url, created_at)
    `)
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbEmployee[]
}

export async function getPaidPositions(): Promise<DbPaidPosition[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('paid_positions')
    .select(`
      id, name, committee_id, description, contract_type, salary_min, salary_max, is_active, created_at,
      committee:areas!paid_positions_committee_id_fkey(name, parent:areas!parent_id(name))
    `)
    .order('name', { ascending: true })
  if (error) throw error
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

/** Cambia el estado de una solicitud de vacaciones. Al aprobar (tipo
 *  'vacaciones') suma los días a vacation_days_used del empleado. */
export async function setVacationStatus(id: string, status: VacationRecordStatus): Promise<void> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vacation_records').update({ status }).eq('id', id)
    .select('employee_id, days, type').single()
  if (error) throw error

  const rec = data as { employee_id: string; days: number; type: VacationRecordType }
  if (status === 'aprobado' && rec.type === 'vacaciones') {
    const { data: emp, error: eErr } = await supabase
      .from('employees').select('vacation_days_used').eq('id', rec.employee_id).single()
    if (eErr) throw eErr
    const used = (emp as { vacation_days_used: number }).vacation_days_used ?? 0
    const { error: uErr } = await supabase
      .from('employees').update({ vacation_days_used: used + rec.days }).eq('id', rec.employee_id)
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
  // Borra primero el archivo de storage (si lo tiene), luego el registro.
  const { data } = await supabase.from('employee_documents').select('file_url').eq('id', id).maybeSingle()
  const path = (data as { file_url: string | null } | null)?.file_url
  if (path) await supabase.storage.from(EMPLOYEE_DOCS_BUCKET).remove([path])
  const { error } = await supabase.from('employee_documents').delete().eq('id', id)
  if (error) throw error
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
