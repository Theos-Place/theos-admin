// Employees / paid positions domain types.

export type ContractType = 'planilla' | 'servicios_profesionales'
export type VacationRecordType = 'vacaciones' | 'permiso_con_goce' | 'permiso_sin_goce' | 'incapacidad'
export type VacationRecordStatus = 'aprobado' | 'pendiente' | 'rechazado'
export type DocumentType = 'contrato' | 'identificacion' | 'seguro_social' | 'otro'
export type EmployeeStatus = 'active' | 'inactive'

export interface SalaryChange {
  date: string
  // null = monto restringido (solo rol finanzas lo recibe del API)
  previous_salary: number | null
  new_salary: number | null
  reason: string
  approved_by: string
}

export interface PositionRecord {
  position_name: string
  start_date: string
  end_date: string
  contract_type: ContractType
}

export interface VacationRecord {
  id: string
  type: VacationRecordType
  start_date: string
  end_date: string
  days: number
  status: VacationRecordStatus
  notes: string
}

export interface EmployeeDocument {
  id: string
  name: string
  type: DocumentType
  uploaded_at: string
  url: string
}

export interface PaidPosition {
  id: string
  name: string
  committee_id: string
  committee_name: string
  area: string
  description: string
  contract_type: ContractType
  salary_min: number
  salary_max: number
  is_active: boolean
  created_at: string
}

export interface Employee {
  id: string
  member_id: string
  member_name: string
  member_initials: string
  member_email: string
  position_id: string
  position_name: string
  committee_name: string
  area: string
  contract_type: ContractType
  start_date: string
  end_date: string | null
  /** null = monto restringido (solo rol finanzas). */
  current_salary: number | null
  status: EmployeeStatus
  salary_history: SalaryChange[]
  position_history: PositionRecord[]
  vacation_days_total: number
  vacation_days_used: number
  vacation_records: VacationRecord[]
  documents: EmployeeDocument[]
  notes: string
}
