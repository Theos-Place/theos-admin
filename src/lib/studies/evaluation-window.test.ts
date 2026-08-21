import { describe, it, expect } from 'vitest'
import {
  EVALUATION_WINDOW_DAYS, evaluationWindowEnd, evaluationWindowStatus,
  evaluationDaysLeft, ticketClosable,
} from './evaluation-window'

const PEDIDA = '2026-09-01T10:00:00.000Z'

describe('evaluationWindowEnd', () => {
  it('suma dos semanas al momento en que se pidió', () => {
    expect(evaluationWindowEnd(PEDIDA)?.toISOString()).toBe('2026-09-15T10:00:00.000Z')
    expect(EVALUATION_WINDOW_DAYS).toBe(14)
  })

  it('sin fecha de solicitud no hay ventana', () => {
    expect(evaluationWindowEnd(null)).toBeNull()
    expect(evaluationWindowEnd(undefined)).toBeNull()
    expect(evaluationWindowEnd('')).toBeNull()
    expect(evaluationWindowEnd('no es fecha')).toBeNull()
  })
})

describe('evaluationWindowStatus', () => {
  it('un grupo que no pidió evaluación no tiene nada que contestar', () => {
    expect(evaluationWindowStatus({ requestedAt: null })).toBe('sin_solicitar')
  })

  it('dentro de las dos semanas está abierta', () => {
    expect(evaluationWindowStatus({ requestedAt: PEDIDA, now: new Date('2026-09-01T10:00:01Z') }))
      .toBe('abierta')
    expect(evaluationWindowStatus({ requestedAt: PEDIDA, now: new Date('2026-09-10T00:00:00Z') }))
      .toBe('abierta')
  })

  // El borde es inclusivo: en el instante exacto todavía se acepta.
  it('el instante del vencimiento todavía cuenta', () => {
    expect(evaluationWindowStatus({ requestedAt: PEDIDA, now: new Date('2026-09-15T10:00:00Z') }))
      .toBe('abierta')
    expect(evaluationWindowStatus({ requestedAt: PEDIDA, now: new Date('2026-09-15T10:00:01Z') }))
      .toBe('cerrada')
  })

  it('pasadas las dos semanas está cerrada', () => {
    expect(evaluationWindowStatus({ requestedAt: PEDIDA, now: new Date('2026-10-01T00:00:00Z') }))
      .toBe('cerrada')
  })
})

describe('evaluationDaysLeft', () => {
  it('cuenta días completos hacia arriba', () => {
    expect(evaluationDaysLeft(PEDIDA, new Date('2026-09-01T10:00:00Z'))).toBe(14)
    expect(evaluationDaysLeft(PEDIDA, new Date('2026-09-14T10:00:00Z'))).toBe(1)
  })

  it('nunca es negativo', () => {
    expect(evaluationDaysLeft(PEDIDA, new Date('2026-09-15T10:00:00Z'))).toBe(0)
    expect(evaluationDaysLeft(PEDIDA, new Date('2026-12-01T00:00:00Z'))).toBe(0)
    expect(evaluationDaysLeft(null)).toBe(0)
  })
})

describe('ticketClosable', () => {
  // La razón de ser de la regla: resolver con la ventana abierta sería revisar
  // un promedio que todavía se puede mover.
  it('no se puede cerrar mientras se aceptan respuestas', () => {
    expect(ticketClosable({ requestedAt: PEDIDA, now: new Date('2026-09-10T00:00:00Z') })).toBe(false)
  })

  it('se puede cerrar una vez vencida', () => {
    expect(ticketClosable({ requestedAt: PEDIDA, now: new Date('2026-09-20T00:00:00Z') })).toBe(true)
  })

  it('un grupo sin evaluación pedida no es cerrable', () => {
    expect(ticketClosable({ requestedAt: null })).toBe(false)
  })
})
