import { createAdminClient } from '@/lib/supabase/admin'
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
  return (data ?? []) as unknown as DbEmployee[]
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
  return (data ?? []) as unknown as DbPaidPosition[]
}
