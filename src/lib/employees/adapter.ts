// Adapta filas de Supabase a los tipos de dominio de empleados.

import type { DbEmployee, DbPaidPosition } from '@/lib/supabase/queries/employees'
import type {
  Employee, PaidPosition, EmployeeStatus, SalaryChange, PositionRecord,
  VacationRecord, EmployeeDocument,
} from '@/types/employee'
import { getInitials } from '@/lib/format'

function fullName(m: { first_name: string; last_name: string } | null): string {
  return m ? `${m.first_name} ${m.last_name}`.trim() : ''
}

export function toDomainEmployee(db: DbEmployee): Employee {
  const name = fullName(db.member)

  const salaryHistory: SalaryChange[] = db.salary_changes.map((s) => ({
    date: s.change_date,
    previous_salary: s.previous_salary ?? null,
    new_salary: s.new_salary,
    reason: s.reason ?? '',
    approved_by: s.approved_by ?? '',
  }))

  const positionHistory: PositionRecord[] = db.position_records.map((p) => ({
    position_name: p.position_name,
    start_date: p.start_date ?? '',
    end_date: p.end_date ?? '',
    contract_type: p.contract_type ?? 'planilla',
  }))

  const vacationRecords: VacationRecord[] = db.vacation_records.map((v) => ({
    id: v.id,
    type: v.type,
    start_date: v.start_date,
    end_date: v.end_date,
    days: v.days,
    status: v.status,
    notes: v.notes ?? '',
  }))

  const documents: EmployeeDocument[] = db.documents.map((d) => ({
    id: d.id,
    name: d.title,
    type: d.doc_type,
    uploaded_at: d.created_at,
    // url apunta a la ruta de descarga (firma una URL temporal); vacío si no hay archivo.
    url: d.file_url ? `/api/employees/documents/${d.id}/download` : '',
  }))

  return {
    id: db.id,
    member_id: db.member_id ?? '',
    member_name: name,
    member_initials: getInitials(name),
    member_email: db.member?.email ?? '',
    position_id: db.position_id ?? '',
    position_name: db.position?.name ?? '',
    committee_name: db.position?.committee?.name ?? '',
    area: db.position?.committee?.parent?.name ?? '',
    contract_type: db.contract_type ?? 'planilla',
    start_date: db.start_date,
    end_date: db.end_date,
    current_salary: db.salary ?? null,
    status: (db.status === 'active' ? 'active' : 'inactive') as EmployeeStatus,
    salary_history: salaryHistory,
    position_history: positionHistory,
    vacation_days_total: db.vacation_days_total,
    vacation_days_used: db.vacation_days_used,
    vacation_records: vacationRecords,
    documents,
    notes: db.notes ?? '',
  }
}

export function toDomainPaidPosition(db: DbPaidPosition): PaidPosition {
  return {
    id: db.id,
    name: db.name,
    committee_id: db.committee_id ?? '',
    committee_name: db.committee?.name ?? '',
    area: db.committee?.parent?.name ?? '',
    description: db.description ?? '',
    contract_type: db.contract_type ?? 'planilla',
    salary_min: db.salary_min ?? 0,
    salary_max: db.salary_max ?? 0,
    is_active: db.is_active,
    created_at: db.created_at,
  }
}
