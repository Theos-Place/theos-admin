// Adapta filas de Supabase a los tipos de dominio de finanzas.

import type {
  DbPayment, DbDonation, DbRefund, DbImportBatch,
} from '@/lib/supabase/queries/finance'
import type { Payment, Donation, Refund, ImportBatch } from '@/types/finance'
import { paymentDescription, paymentKindLabel } from '@/lib/finance/payment-label'

function fullName(m: { first_name: string; last_name: string } | null): string {
  return m ? `${m.first_name} ${m.last_name}`.trim() : ''
}

function entityName(event: { title: string } | null, group: { name: string } | null): string {
  return event?.title ?? group?.name ?? ''
}

/** Datos que necesita paymentDescription, sacados de la fila cruda. */
function labelInput(db: DbPayment) {
  return {
    concept: db.concept,
    entity_type: db.entity_type,
    event_id: db.event_id,
    study_group_id: db.study_group_id,
    event_name: db.event?.title ?? null,
    group_name: db.study_group?.name ?? null,
    plan_name: db.study_group?.plan?.name ?? null,
    plan_code: db.study_group?.plan?.code ?? null,
    description: db.description,
  }
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
    currency: db.currency ?? 'CRC',
    method: db.payment_method ?? 'cash',
    status: db.status,
    gateway_ref: db.gateway_ref,
    sinpe_confirmation: db.sinpe_confirmation,
    scholarship_id: db.scholarship_id,
    paid_at: db.paid_at,
    created_at: db.created_at,
    notes: db.description,
    // Pedido 2026-08-06: en la lista de pagos hay que ver de un vistazo si es de
    // un estudio o de un evento, y de cuál. Se DERIVA (no depende de que alguien
    // haya escrito una descripción), así que también arregla el histórico.
    concept: db.concept,
    kind_label: paymentKindLabel(labelInput(db)),
    description_label: paymentDescription(labelInput(db)),
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
    currency: db.currency ?? 'CRC',
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
    currency: db.currency ?? 'CRC',
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
