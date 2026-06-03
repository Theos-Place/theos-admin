// Adapta filas de Supabase a los tipos de dominio de finanzas.

import type {
  DbPayment, DbDonation, DbRefund, DbScholarship, DbImportBatch,
} from '@/lib/supabase/queries/finance'
import type { Payment, Donation, Refund, Scholarship, ImportBatch } from '@/types/finance'

function fullName(m: { first_name: string; last_name: string } | null): string {
  return m ? `${m.first_name} ${m.last_name}`.trim() : ''
}

function entityName(event: { title: string } | null, group: { name: string } | null): string {
  return event?.title ?? group?.name ?? ''
}

export function toDomainPayment(db: DbPayment): Payment {
  const entityType = db.entity_type ?? (db.event_id ? 'event' : 'study_group')
  return {
    id: db.id,
    member_id: db.member_id ?? '',
    member_name: fullName(db.member),
    member_cedula: db.member?.cedula ?? '',
    entity_type: entityType,
    entity_id: db.event_id ?? db.study_group_id ?? '',
    entity_name: entityName(db.event, db.study_group),
    amount: db.amount,
    method: db.payment_method ?? 'cash',
    status: db.status,
    gateway_ref: db.gateway_ref,
    sinpe_confirmation: db.sinpe_confirmation,
    scholarship_id: db.scholarship_id,
    paid_at: db.paid_at,
    created_at: db.created_at,
    notes: db.description,
  }
}

export function toDomainDonation(db: DbDonation): Donation {
  return {
    id: db.id,
    member_id: db.member_id,
    member_name: fullName(db.member),
    member_cedula: db.member?.cedula ?? '',
    donation_date: db.donation_date,
    amount: db.amount,
    source_file: db.source_file ?? '',
    imported_at: db.imported_at,
    family_unit_id: db.family_unit_id,
    is_identified: db.is_identified,
  }
}

export function toDomainRefund(db: DbRefund): Refund {
  return {
    id: db.id,
    payment_id: db.payment_id,
    member_id: db.member_id ?? '',
    member_name: fullName(db.member),
    entity_name: entityName(db.payment?.event ?? null, db.payment?.study_group ?? null),
    amount: db.amount,
    method: db.method ?? 'cash',
    status: db.status,
    reason: db.reason ?? '',
    requested_at: db.requested_at,
    processed_at: db.processed_at,
    processed_by: db.processed_by,
    sinpe_pending: db.sinpe_pending,
    notes: db.notes,
  }
}

export function toDomainScholarship(db: DbScholarship): Scholarship {
  const entityType = db.entity_type ?? (db.event_id ? 'event' : 'study_group')
  return {
    id: db.id,
    member_id: db.member_id,
    member_name: fullName(db.member),
    entity_type: entityType,
    entity_id: db.event_id ?? db.study_group_id ?? '',
    entity_name: entityName(db.event, db.study_group),
    discount_type: db.discount_type ?? 'fixed',
    discount_value: db.discount_value ?? 0,
    original_amount: db.original_amount ?? 0,
    final_amount: db.final_amount ?? 0,
    is_used: db.is_used,
    used_at: db.used_at,
    created_by: db.created_by ?? '',
    created_at: db.created_at,
    notes: db.notes,
  }
}

export function toDomainImportBatch(db: DbImportBatch): ImportBatch {
  return {
    id: db.id,
    filename: db.filename,
    imported_at: db.imported_at,
    imported_by: db.imported_by ?? '',
    total_rows: db.total_rows,
    identified: db.identified,
    unidentified: db.unidentified,
    duplicates: db.duplicates,
    status: db.status,
  }
}
