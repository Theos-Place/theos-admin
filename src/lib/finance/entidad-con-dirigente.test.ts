import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { toDomainPayment } from './adapter'
import type { DbPayment } from '@/lib/supabase/queries/finance'

const pago = (study_group: DbPayment['study_group'], event: DbPayment['event'] = null) =>
  ({ id: 'p', member_id: 'm', member: null, entity_type: event ? 'event' : 'study_group', event_id: event ? 'e' : null,
    study_group_id: event ? null : 'g', event, study_group, amount: 5000, currency: 'CRC', payment_method: 'comprobante',
    status: 'pending', gateway_ref: null, sinpe_confirmation: null, scholarship_id: null, paid_at: null, description: null,
    created_at: '2026-10-19', concept: 'matricula', receipt_path: null, reference_code: null, review_status: null }) as unknown as DbPayment

describe('la lista de pagos dice de qué dirigente es el grupo (2026-10-19)', () => {
  it('un grupo del sistema («N1 — Escazú») suma el dirigente', () => {
    expect(toDomainPayment(pago({ name: 'N1 — Escazú', leader: { first_name: 'Aniri', last_name: 'Herrera Sandino' } })).entity_name)
      .toBe('N1 — Escazú · Aniri Herrera Sandino')
  })
  it('no lo repite si el nombre ya lo trae', () => {
    expect(toDomainPayment(pago({ name: 'Nivel 4. Marco Acuña y Tatiana Arauz. Octubre 2026', leader: { first_name: 'Marco', last_name: 'Acuña Solís' } })).entity_name)
      .toBe('Nivel 4. Marco Acuña y Tatiana Arauz. Octubre 2026')
  })
  it('los eventos quedan con su título', () => {
    expect(toDomainPayment(pago(null, { title: 'Matrimonios' } as DbPayment['event'])).entity_name).toBe('Matrimonios')
  })
  it('las consultas de pagos y devoluciones traen al dirigente', () => {
    const q = readFileSync('src/lib/supabase/queries/finance.ts', 'utf8')
    expect(q.match(/study_groups\(name, leader:members!study_groups_leader_id_fkey\(first_name, last_name\)/g)?.length).toBe(2)
  })
})
