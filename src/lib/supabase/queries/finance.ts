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

/** Vincula una donación a un miembro (la identifica). */
export async function linkDonation(donationId: string, memberId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('donations')
    .update({ member_id: memberId, is_identified: true })
    .eq('id', donationId)
  if (error) throw error
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

// ── Mutaciones ─────────────────────────────────────────────

export type PaymentWriteInput = {
  member_id?: string | null
  entity_type?: 'event' | 'study_group' | null
  event_id?: string | null
  study_group_id?: string | null
  amount: number
  payment_method?: PaymentMethod | null
  status?: PaymentStatus
  gateway_ref?: string | null
  sinpe_confirmation?: string | null
  scholarship_id?: string | null
  paid_at?: string | null
  description?: string | null
}

export async function createPayment(input: PaymentWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('payments').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function updatePayment(id: string, patch: Partial<PaymentWriteInput>): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('payments').update(patch).eq('id', id)
  if (error) throw error
}

export type ScholarshipWriteInput = {
  member_id: string
  entity_type?: 'study_group' | 'event' | null
  study_group_id?: string | null
  event_id?: string | null
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  original_amount: number
  final_amount: number
  reason?: string | null
  notes?: string | null
  created_by?: string | null
}

export async function createScholarship(input: ScholarshipWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  // scholarships.amount y reason son NOT NULL en el esquema original.
  const row = {
    ...input,
    amount: input.original_amount - input.final_amount,
    reason: input.reason ?? input.notes ?? 'Beca',
    status: 'approved' as const,
  }
  const { data, error } = await supabase.from('scholarships').insert(row).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function markScholarshipUsed(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('scholarships')
    .update({ is_used: true, used_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export type RefundWriteInput = {
  payment_id: string
  member_id?: string | null
  amount: number
  method?: PaymentMethod | null
  reason?: string | null
  sinpe_pending?: boolean
  notes?: string | null
}

export async function createRefund(input: RefundWriteInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('refunds').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

/** Cambia el estado de una devolución. Al completar, marca el pago como reembolsado. */
export async function processRefund(id: string, status: RefundStatus): Promise<void> {
  const supabase = createAdminClient()
  const patch: Record<string, unknown> = { status }
  if (status === 'completed' || status === 'rejected') {
    patch.processed_at = new Date().toISOString()
  }
  const { data, error } = await supabase.from('refunds').update(patch).eq('id', id).select('payment_id').single()
  if (error) throw error

  if (status === 'completed') {
    const { error: pErr } = await supabase
      .from('payments').update({ status: 'refunded' }).eq('id', (data as { payment_id: string }).payment_id)
    if (pErr) throw pErr
  }
}

// ── Importación de donaciones ──────────────────────────────

export type DonationRow = {
  cedula?: string | null
  donation_date: string
  amount: number
}

/** Importa un lote de donaciones: identifica por cédula, detecta duplicados
 *  (mismo miembro+fecha+monto ya existente) y crea el registro del lote. */
export async function importDonations(
  filename: string,
  rows: DonationRow[],
): Promise<DbImportBatch> {
  const supabase = createAdminClient()

  // 1. Resolver cédulas → member_id en un solo query.
  const cedulas = Array.from(new Set(rows.map((r) => r.cedula).filter(Boolean))) as string[]
  const cedulaToId = new Map<string, string>()
  if (cedulas.length > 0) {
    const { data: members, error: mErr } = await supabase
      .from('members').select('id, cedula').in('cedula', cedulas)
    if (mErr) throw mErr
    for (const m of (members ?? []) as Array<{ id: string; cedula: string }>) {
      cedulaToId.set(m.cedula, m.id)
    }
  }

  // 2. Armar filas, contar identificados y duplicados.
  let identified = 0
  let duplicates = 0
  const toInsert: Array<Record<string, unknown>> = []

  for (const r of rows) {
    const memberId = r.cedula ? cedulaToId.get(r.cedula) ?? null : null
    const isIdentified = memberId != null
    if (isIdentified) identified++

    let isDup = false
    if (memberId) {
      const { count } = await supabase
        .from('donations')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', memberId)
        .eq('donation_date', r.donation_date)
        .eq('amount', r.amount)
      if ((count ?? 0) > 0) { isDup = true; duplicates++ }
    }
    if (isDup) continue

    toInsert.push({
      member_id: memberId,
      donation_date: r.donation_date,
      amount: r.amount,
      source_file: filename,
      is_identified: isIdentified,
    })
  }

  if (toInsert.length > 0) {
    const { error: dErr } = await supabase.from('donations').insert(toInsert)
    if (dErr) throw dErr
  }

  // 3. Registrar el lote.
  const unidentified = rows.length - identified
  const status = duplicates === rows.length ? 'failed' : duplicates > 0 ? 'partial' : 'completed'
  const { data: batch, error: bErr } = await supabase
    .from('import_batches')
    .insert({ filename, total_rows: rows.length, identified, unidentified, duplicates, status })
    .select('*')
    .single()
  if (bErr) throw bErr
  return batch as DbImportBatch
}
