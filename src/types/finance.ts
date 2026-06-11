// Finance module domain types.

export type PaymentMethod = 'card' | 'sinpe' | 'scholarship' | 'cash'
export type PaymentStatus = 'paid' | 'pending' | 'refunded' | 'partial_refund' | 'failed'
export type RefundStatus = 'pending' | 'processing' | 'completed' | 'rejected'

export type Payment = {
  id: string
  member_id: string
  member_name: string
  member_cedula: string
  entity_type: 'event' | 'study_group'
  entity_id: string
  entity_name: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  gateway_ref: string | null
  sinpe_confirmation: string | null
  scholarship_id: string | null
  paid_at: string | null
  created_at: string
  notes: string | null
}

export type Donation = {
  id: string
  member_id: string | null
  member_name: string
  member_cedula: string
  donation_date: string
  amount: number
  source_file: string
  imported_at: string
  family_unit_id: string | null
  is_identified: boolean
}

export type Refund = {
  id: string
  payment_id: string
  member_id: string
  member_name: string
  entity_name: string
  amount: number
  method: PaymentMethod
  status: RefundStatus
  reason: string
  requested_at: string
  processed_at: string | null
  processed_by: string | null
  sinpe_pending: boolean
  notes: string | null
}

export type Scholarship = {
  id: string
  member_id: string
  member_name: string
  entity_type: 'study_group' | 'event'
  entity_id: string
  entity_name: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  original_amount: number
  final_amount: number
  is_used: boolean
  used_at: string | null
  created_by: string
  created_at: string
  notes: string | null
}

export type ImportBatch = {
  id: string
  filename: string
  imported_at: string
  imported_by: string
  total_rows: number
  identified: number
  unidentified: number
  duplicates: number
  status: 'completed' | 'partial' | 'failed'
}

// ── Solicitudes financieras (tabla finance_requests, migración 048) ─────────

export type FinanceRequestType = 'scholarship' | 'refund'
export type FinanceRequestStatus = 'open' | 'in_review' | 'resolved' | 'rejected'

export type FinanceRequestHistoryEntry = {
  from_status: FinanceRequestStatus | null
  to_status: FinanceRequestStatus
  notes: string | null
  changed_by_name: string | null
  created_at: string
}

export type FinanceRequest = {
  id: string
  member_id: string
  member_name: string
  request_type: FinanceRequestType
  study_group_id: string | null
  study_group_name: string | null
  payment_id: string | null
  payment_label: string | null
  amount: number | null
  reason: string
  status: FinanceRequestStatus
  reviewed_by: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
  history: FinanceRequestHistoryEntry[]
}

export type FinanceRequestWriteInput = {
  member_id: string
  request_type: FinanceRequestType
  study_group_id?: string | null
  payment_id?: string | null
  amount?: number | null
  reason: string
}
