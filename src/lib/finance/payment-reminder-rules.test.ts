import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isRemindablePayment } from './payment-reminder-rules'

const NOW = '2026-07-27T12:00:00.000Z'

describe('isRemindablePayment (PAG-3)', () => {
  it('pendiente sin comprobante → se recuerda', () => {
    expect(isRemindablePayment({ status: 'pending', review_status: null, reviewed_at: null }, NOW)).toBe(true)
  })

  it('en revisión → NO (la pelota está en finanzas)', () => {
    expect(isRemindablePayment({ status: 'pending', review_status: 'en_revision', reviewed_at: null }, NOW)).toBe(false)
  })

  it('rechazado dentro de las 72h → se recuerda; pasado eso NO (va a expirar igual)', () => {
    expect(isRemindablePayment({ status: 'pending', review_status: 'rechazado', reviewed_at: '2026-07-26T12:00:00.000Z' }, NOW)).toBe(true)
    expect(isRemindablePayment({ status: 'pending', review_status: 'rechazado', reviewed_at: '2026-07-23T12:00:00.000Z' }, NOW)).toBe(false)
  })

  it('pagados/cerrados nunca', () => {
    expect(isRemindablePayment({ status: 'paid', review_status: null, reviewed_at: null }, NOW)).toBe(false)
    expect(isRemindablePayment({ status: 'failed', review_status: null, reviewed_at: null }, NOW)).toBe(false)
  })
})

describe('quién avisa del cobro de matrícula, y quién no', () => {
  // El aviso salía al crear el cobro, y salía mal siempre: la UI abre el modal
  // del comprobante apenas termina la matrícula, la persona lo sube en el
  // momento y el pago pasa a revisión — con la notificación diciéndole que
  // debe algo que ya pagó. Se quitó el 2026-08-31; el recordatorio semanal, que
  // sí mira el comprobante (isRemindablePayment), es el que avisa.
  const fuente = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

  it('la matrícula INTERACTIVA no avisa al crear el cobro', () => {
    const s = fuente('src/lib/supabase/queries/studies.ts')
    expect(s).not.toMatch(/type:\s*'payment_pending'/)
  })

  it('la auto-matrícula al cerrar un grupo SÍ avisa', () => {
    // Acá no hay nadie frente a una pantalla: es el único aviso que recibe.
    // Si alguien lo borra "por consistencia", la persona no se entera nunca.
    const s = fuente('src/lib/supabase/queries/payments.ts')
    expect(s).toMatch(/type:\s*'payment_pending'/)
  })

  it('un pago con comprobante no se recuerda', () => {
    const ahora = '2026-08-31T12:00:00.000Z'
    expect(isRemindablePayment({ status: 'pending', review_status: 'en_revision', reviewed_at: null }, ahora)).toBe(false)
    expect(isRemindablePayment({ status: 'pending', review_status: null, reviewed_at: null }, ahora)).toBe(true)
  })
})
