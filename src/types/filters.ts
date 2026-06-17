export type StudyStatus = 'completed' | 'in_progress' | 'any'
export type AttendanceType = 'participant' | 'server' | 'any'
export type ServiceStatus = 'active' | 'historical' | 'any'
export type FormResponseStatus = 'filled' | 'not_filled' | 'any'
export type QtyOperator = 'gte' | 'lte' | 'eq' | 'any'

export type FilterCondition =
  | { id: number; group: 'study'; type: 'study'; study: string; status: StudyStatus; from: string | null; to: string | null }
  | { id: number; group: 'attend'; type: 'attendance'; eventType: string; eventTypeName?: string; sedes: string[]; camp: string; attendanceType: AttendanceType; qtyOp: QtyOperator; qty: string; from: string; to: string }
  | { id: number; group: 'service'; type: 'service'; area: string; committee: string; position: string; status: ServiceStatus; from: string; to: string }
  | { id: number; group: 'form'; type: 'form'; formId: string; formName: string; status: FormResponseStatus; from: string; to: string; field: string; fieldVal: string }
  | { id: number; group: 'donor'; type: 'donor'; value: 'yes' | 'no' }
  | { id: number; group: 'age'; type: 'age'; min: string; max: string }
  | { id: number; group: 'status'; type: 'status'; value: 'active' | 'inactive' }
  | { id: number; group: 'leader'; type: 'leader'; value: 'yes' | 'no' }
  | { id: number; group: 'marital'; type: 'marital'; value: string }

export interface ConditionGroup {
  id: number
  members: number[]
  op: 'AND' | 'OR'
}

export interface FilterState {
  conditions: FilterCondition[]
  groups: ConditionGroup[]
}

// Distributive Omit — removes 'id' from each union member individually
type NoId<T> = T extends { id: number } ? Omit<T, 'id'> : T
export type AddableCondition = NoId<FilterCondition>
