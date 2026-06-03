import { createAdminClient } from '@/lib/supabase/admin'
import type { PaymentMethod, PaymentStatus, RefundStatus } from '@/types/finance'

// NOTA: createAdminClient (service role) porque la app corre con mock auth.

type MemberRef = { first_name: string; last_name: string; cedula: string | null } | null
type EventRef = { title: string } | null
type GroupRef = { name: string } | null

export type DbPayment = {
  id: string
  member_id: string | null
  member: MemberRef
  entity_type: 'event' | 'study_group' | null
  event_id: string | null
  study_group_id: string | null
  event: EventRef
  study_group: GroupRef
  amount: number
  payment_method: PaymentMethod | null
  status: PaymentStatus
  gateway_ref: string | null
  sinpe_confirmation: string | null
  scholarship_id: string | null
  paid_at: string | null
  description: string | null
  created_at: string
}

export type DbDonation = {
  id: string
  member_id: string | null
  member: MemberRef
  family_unit_id: string | null
  donation_date: string
  amount: number
  source_file: string | null
  is_identified: boolean
  imported_at: string
}

export type DbRefund = {
  id: string
  payment_id: string
  member_id: string | null
  member: { first_name: string; last_name: string } | null
  payment: { event: EventRef; study_group: GroupRef } | null
  amount: number
  method: PaymentMethod | null
  status: RefundStatus
  reason: string | null
  sinpe_pending: boolean
  notes: string | null
  requested_at: string
  processed_at: string | null
  processed_by: string | null
}

export type DbScholarship = {
  id: string
  member_id: string
  member: { first_name: string; last_name: string } | null
  entity_type: 'study_group' | 'event' | null
  study_group_id: string | null
  event_id: string | null
  study_group: GroupRef
  event: EventRef
  discount_type: 'percentage' | 'fixed' | null
  discount_value: number | null
  original_amount: number | null
  final_amount: number | null
  is_used: boolean
  used_at: string | null
  created_by: string | null
  created_at: string
  notes: string | null
}

export type DbImportBatch = {
  id: string
  filename: string
  total_rows: number
  identified: number
  unidentified: number
  duplicates: number
  status: 'completed' | 'partial' | 'failed'
  imported_by: string | null
  imported_at: string
}

// ── Queries ────────────────────────────────────────────────

export async function getPayments(): Promise<DbPayment[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id, member_id, entity_type, event_id, study_group_id, amount, payment_method,
      status, gateway_ref, sinpe_confirmation, scholarship_id, paid_at, description, created_at,
      member:members(first_name, last_name, cedula),
      event:events(title),
      study_group:study_groups(name)
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbPayment[]
}

export async function getDonations(): Promise<DbDonation[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('donations')
    .select(`
      id, member_id, family_unit_id, donation_date, amount, source_file, is_identified, imported_at,
      member:members(first_name, last_name, cedula)
    `)
    .order('donation_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbDonation[]
}

export async function getRefunds(): Promise<DbRefund[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('refunds')
    .select(`
      id, payment_id, member_id, amount, method, status, reason, sinpe_pending, notes,
      requested_at, processed_at, processed_by,
      member:members(first_name, last_name),
      payment:payments(event:events(title), study_group:study_groups(name))
    `)
    .order('requested_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbRefund[]
}

export async function getScholarships(): Promise<DbScholarship[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('scholarships')
    .select(`
      id, member_id, entity_type, study_group_id, event_id, discount_type, discount_value,
      original_amount, final_amount, is_used, used_at, created_by, created_at, notes,
      member:members(first_name, last_name),
      study_group:study_groups(name),
      event:events(title)
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DbScholarship[]
}

export async function getImportBatches(): Promise<DbImportBatch[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('import_batches')
    .select('id, filename, total_rows, identified, unidentified, duplicates, status, imported_by, imported_at')
    .order('imported_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbImportBatch[]
}
