import { applyMemberSearch } from '@/lib/supabase/queries/members'
import { createAdminClient, type Insertable } from '@/lib/supabase/admin'
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
  currency: string
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
  currency: string
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
  currency: string
  method: PaymentMethod | null
  status: RefundStatus
  reason: string | null
  sinpe_pending: boolean
  notes: string | null
  requested_at: string
  processed_at: string | null
  processed_by: string | null
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

// Hint de FK obligatorio: desde la migración 105 payments tiene DOS FKs a
// members (member_id y reviewed_by) y el embed sin hint es ambiguo para
// PostgREST (bug latente detectado al regenerar tipos, 2026-07-13).
const PAYMENT_SELECT = `
  id, member_id, entity_type, event_id, study_group_id, amount, currency, payment_method,
  status, gateway_ref, sinpe_confirmation, scholarship_id, paid_at, description, created_at,
  member:members!payments_member_id_fkey(first_name, last_name, cedula),
  event:events(title),
  study_group:study_groups(name)
`
// Con búsqueda el join al miembro es inner: filtramos por nombre/cédula y los
// pagos sin miembro (no buscables por persona) quedan fuera.
const PAYMENT_SELECT_SEARCH = PAYMENT_SELECT.replace('member:members!payments_member_id_fkey(', 'member:members!payments_member_id_fkey!inner(')

export async function getPayments(): Promise<DbPayment[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbPayment[]
}

export type PaymentFilters = {
  search?: string
  entity_type?: 'event' | 'study_group'
  method?: string
  status?: string
  page?: number
  pageSize?: number
}

/** Pagos paginados con filtros server-side. Devuelve filas + total exacto.
 *  La búsqueda matchea nombre/cédula del miembro (no el concepto/entidad). */
export async function getPaymentsPage(filters: PaymentFilters = {}): Promise<{ rows: DbPayment[]; total: number }> {
  const supabase = createAdminClient()
  const page = Math.max(1, Math.trunc(filters.page ?? 1))
  const pageSize = Math.min(200, Math.max(1, Math.trunc(filters.pageSize ?? 50)))
  const search = filters.search?.trim()

  let q = supabase
    .from('payments')
    .select(search ? PAYMENT_SELECT_SEARCH : PAYMENT_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (filters.entity_type) q = q.eq('entity_type', filters.entity_type)
  if (filters.method) q = q.eq('payment_method', filters.method)
  if (filters.status) q = q.eq('status', filters.status)
  if (search) {
    // search_text del miembro: normalizado (sin tildes) y con índice GIN trgm
    // (migración 083) — el .or por columnas sueltas no tenía soporte de índice.
    q = applyMemberSearch(q, search, 'member.search_text')
  }

  const { data, error, count } = await q
  if (error) throw error
  return { rows: (data ?? []) as unknown as DbPayment[], total: count ?? 0 }
}

export type PaymentStats = {
  total_paid: number
  total_card: number
  total_sinpe: number
  total_pending: number
}

/** Totales globales de pagos (SQL, migración 060). */
export async function getPaymentStats(): Promise<PaymentStats> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('payment_stats')
  if (error) throw error
  return data as unknown as PaymentStats
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

export type DonationFilters = {
  search?: string
  status?: 'all' | 'identified' | 'unidentified'
  from?: string
  to?: string
  page?: number
  pageSize?: number
  /** Sin paginar (hasta el límite de PostgREST). Para dashboard/reportes que
   *  agregan o exportan sobre el conjunto, no para el listado. */
  all?: boolean
}

export type DonationStats = {
  unique_donors: number
  /** FIN-1: miembros con is_donor=true (donó en los últimos ~2 trimestres). */
  active_donors: number
  total_this_month: number
  unidentified_count: number
  unidentified_total: number
}

const DONATION_SELECT = `
  id, member_id, family_unit_id, donation_date, amount, currency, source_file, is_identified, imported_at,
  member:members(first_name, last_name, cedula)
`
// Cuando hay búsqueda, el join debe ser inner para filtrar las donaciones por
// los campos del miembro (las no identificadas no tienen miembro → se excluyen
// de la búsqueda, que es lo correcto: no tienen nombre que buscar).
const DONATION_SELECT_SEARCH = DONATION_SELECT.replace('member:members(', 'member:members!inner(')

/** Donaciones paginadas con filtros server-side. Devuelve filas + total. */
export async function getDonations(filters: DonationFilters = {}): Promise<{ rows: DbDonation[]; total: number }> {
  const supabase = createAdminClient()
  const page = Math.max(1, Math.trunc(filters.page ?? 1))
  const pageSize = Math.min(200, Math.max(1, Math.trunc(filters.pageSize ?? 50)))
  const search = filters.search?.trim()

  let q = supabase
    .from('donations')
    .select(search ? DONATION_SELECT_SEARCH : DONATION_SELECT, { count: 'exact' })
    .order('donation_date', { ascending: false })
  if (!filters.all) q = q.range((page - 1) * pageSize, page * pageSize - 1)

  if (filters.status === 'identified') q = q.eq('is_identified', true)
  else if (filters.status === 'unidentified') q = q.eq('is_identified', false)
  if (filters.from) q = q.gte('donation_date', filters.from)
  if (filters.to) q = q.lte('donation_date', filters.to)
  if (search) {
    // Ver arriba: search_text normalizado con índice, y sin interpolar en .or().
    q = applyMemberSearch(q, search, 'member.search_text')
  }

  const { data, error, count } = await q
  if (error) throw error
  // Select dinámico (ternario inner/left join) → el parser tipado no lo resuelve.
  return { rows: (data ?? []) as unknown as DbDonation[], total: count ?? 0 }
}

/** FIN-1: SUMA de montos del filtro COMPLETO (no solo la página visible).
 *  Mismos filtros que getDonations; pagina solo la columna amount (PostgREST
 *  corta en ~1000 filas) y suma acá. Se pide solo cuando hay filtros activos. */
export async function getDonationsFilteredSum(filters: DonationFilters = {}): Promise<number> {
  const supabase = createAdminClient()
  const search = filters.search?.trim()
  let sum = 0
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from('donations')
      .select(search ? 'amount, member:members!inner(search_text)' : 'amount')
      .order('id')
      .range(from, from + 999)
    if (filters.status === 'identified') q = q.eq('is_identified', true)
    else if (filters.status === 'unidentified') q = q.eq('is_identified', false)
    if (filters.from) q = q.gte('donation_date', filters.from)
    if (filters.to) q = q.lte('donation_date', filters.to)
    if (search) q = applyMemberSearch(q, search, 'member.search_text')
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as unknown as Array<{ amount: number | null }>
    for (const r of rows) sum += Number(r.amount ?? 0)
    if (rows.length < 1000) break
  }
  return sum
}

/** Totales del módulo de donaciones (calculados en SQL, migración 058). */
export async function getDonationStats(): Promise<DonationStats> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('donation_stats')
  if (error) throw error
  return data as DonationStats
}

export async function getRefunds(): Promise<DbRefund[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('refunds')
    .select(`
      id, payment_id, member_id, amount, currency, method, status, reason, sinpe_pending, notes,
      requested_at, processed_at, processed_by,
      member:members(first_name, last_name),
      payment:payments(event:events(title), study_group:study_groups(name))
    `)
    .order('requested_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbRefund[]
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
  // Obligatorio y explícito: un pago no debe nacer con el default de la columna
  // (auditoría db §1). El estado inicial normal es 'pending'.
  status: PaymentStatus
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

/** Confirma un pago SINPE: pending → paid con número de confirmación.
 *  ÚNICA transición legal de este camino (auditoría A1: el update genérico
 *  anterior permitía cualquier→cualquier y mass-assignment de amount).
 *  Devuelve false si el pago ya no estaba pendiente (o no es SINPE). */
export async function confirmSinpePayment(
  id: string,
  input: { sinpe_confirmation: string; paid_at?: string | null },
): Promise<boolean> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      sinpe_confirmation: input.sinpe_confirmation,
      paid_at: input.paid_at ?? new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .eq('payment_method', 'sinpe')
    .select('id')
  if (error) throw error
  return (data ?? []).length > 0
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

/** Crea la devolución vía RPC TRANSACCIONAL (migración 116): lock del pago +
 *  validación de estado (solo paid/partial_refund) + tope de monto contra lo
 *  ya devuelto, todo en una transacción — el check-then-insert anterior
 *  permitía sobre-devolución por carrera. Devuelve el código del RPC. */
export type CreateRefundResult =
  | { code: 'ok'; id: string }
  | { code: 'not_found' | 'invalid_amount' }
  | { code: 'not_refundable'; status: string }
  | { code: 'exceeds'; max: number }

export async function createRefund(input: RefundWriteInput): Promise<CreateRefundResult> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('create_refund', {
    p_payment_id: input.payment_id,
    // null explícito (no undefined): la función no tiene DEFAULT para estos y
    // JSON.stringify omitiría la key → PostgREST reclamaría el argumento.
    p_member_id: (input.member_id ?? null) as unknown as string,
    p_amount: input.amount,
    p_method: (input.method ?? null) as unknown as string,
    p_reason: (input.reason ?? null) as unknown as string,
    p_sinpe_pending: input.sinpe_pending ?? false,
    p_notes: input.notes ?? undefined,
  })
  if (error) throw error
  return data as unknown as CreateRefundResult
}

/** Procesa la devolución vía RPC TRANSACCIONAL (migración 116): máquina de
 *  estados (completed/rejected terminales) + el estado del pago se deriva del
 *  TOTAL devuelto en la misma transacción (refunded si cubre el monto,
 *  partial_refund si no — antes una devolución parcial marcaba 'refunded'
 *  entero, y un fallo entre updates dejaba refund completed con pago paid). */
export async function processRefund(
  id: string,
  status: RefundStatus,
  details?: { processedDate?: string | null; confirmation?: string | null; rejectReason?: string | null },
): Promise<void> {
  const supabase = createAdminClient()
  const notes = [
    details?.confirmation ? `Confirmación: ${details.confirmation}` : null,
    details?.rejectReason ? `Motivo del rechazo: ${details.rejectReason}` : null,
  ].filter(Boolean).join('\n')
  const processedAt = details?.processedDate
    ? new Date(`${details.processedDate}T12:00:00`).toISOString() // mediodía: evita corrimiento de día por TZ
    : undefined
  const { data, error } = await supabase.rpc('process_refund', {
    p_refund_id: id,
    p_status: status,
    p_processed_at: processedAt,
    p_note: notes || undefined,
  })
  if (error) throw error
  const code = (data as unknown as { code: string })?.code
  if (code !== 'ok') throw new Error('YA_PROCESADO')
}

// ── Importación de donaciones ──────────────────────────────

export type DonationRow = {
  cedula?: string | null
  donation_date: string
  amount: number
}

/** Importa un lote de donaciones: identifica por cédula, detecta duplicados
 *  (mismo miembro+fecha+monto, tanto contra la BD como dentro del mismo
 *  archivo) y crea el registro del lote. `updateDonorStatus` marca is_donor
 *  a los miembros identificados. */
export async function importDonations(
  filename: string,
  rows: DonationRow[],
  opts: { updateDonorStatus?: boolean } = {},
): Promise<DbImportBatch> {
  const supabase = createAdminClient()

  // 1. Resolver cédulas → member_id en un solo query.
  const cedulas = Array.from(new Set(rows.map((r) => r.cedula).filter(Boolean))) as string[]
  const cedulaToId = new Map<string, string>()
  // Un import puede traer miles de cédulas; trocear el .in() en lotes evita una
  // URL gigante (414/500), igual que en communications.ts y studies.ts.
  for (let i = 0; i < cedulas.length; i += 300) {
    const slice = cedulas.slice(i, i + 300)
    const { data: members, error: mErr } = await supabase
      .from('members').select('id, cedula').in('cedula', slice)
    if (mErr) throw mErr
    for (const m of (members ?? []) as Array<{ id: string; cedula: string }>) {
      cedulaToId.set(m.cedula, m.id)
    }
  }

  // 2. Armar filas, contar identificados y duplicados.
  let identified = 0
  let duplicates = 0
  const toInsert: Array<Record<string, unknown>> = []
  // Dedup DENTRO del archivo: dos filas idénticas en el mismo CSV (o el mismo
  // CSV reimportado con filas sin cédula) se insertaban ambas.
  const seenInFile = new Set<string>()

  for (const r of rows) {
    const memberId = r.cedula ? cedulaToId.get(r.cedula) ?? null : null
    const isIdentified = memberId != null
    if (isIdentified) identified++

    const fileKey = `${memberId ?? r.cedula ?? ''}|${r.donation_date}|${r.amount}`
    let isDup = false
    if (seenInFile.has(fileKey)) { isDup = true; duplicates++ }
    else if (memberId) {
      const { count } = await supabase
        .from('donations')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', memberId)
        .eq('donation_date', r.donation_date)
        .eq('amount', r.amount)
      if ((count ?? 0) > 0) { isDup = true; duplicates++ }
    }
    seenInFile.add(fileKey)
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
    const { error: dErr } = await supabase.from('donations').insert(toInsert as Insertable<'donations'>[])
    if (dErr) throw dErr
  }

  // 2b. Marcar como donadores a los miembros identificados (opcional).
  if (opts.updateDonorStatus) {
    const donorIds = [...new Set([...cedulaToId.values()])]
    for (let i = 0; i < donorIds.length; i += 300) {
      const { error: uErr } = await supabase
        .from('members').update({ is_donor: true })
        .in('id', donorIds.slice(i, i + 300))
        .eq('is_donor', false)
      if (uErr) console.warn('importDonations is_donor:', uErr.message)
    }
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
