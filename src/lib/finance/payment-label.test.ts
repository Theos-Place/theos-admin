// Descripción de un pago: de qué tipo es y de qué cosa.
import { describe, it, expect } from 'vitest'
import { paymentKind, paymentKindLabel, paymentEntityName, paymentDescription } from './payment-label'

describe('de qué tipo es el pago', () => {
  it('el concepto manda', () => {
    expect(paymentKind({ concept: 'matricula' })).toBe('estudio')
    expect(paymentKind({ concept: 'evento' })).toBe('evento')
    expect(paymentKind({ concept: 'prematrimonial' })).toBe('prematrimonial')
    expect(paymentKind({ concept: 'folletos' })).toBe('folletos')
  })

  it('sin concepto se deduce de a qué apunta (pagos viejos)', () => {
    expect(paymentKind({ event_id: 'e1' })).toBe('evento')
    expect(paymentKind({ study_group_id: 'g1' })).toBe('estudio')
    expect(paymentKind({ entity_type: 'event' })).toBe('evento')
    expect(paymentKind({ entity_type: 'study_group' })).toBe('estudio')
  })

  it('sin nada, otro', () => {
    expect(paymentKind({})).toBe('otro')
    expect(paymentKindLabel({})).toBe('Otro')
  })
})

describe('nombre de lo que se paga', () => {
  it('en un estudio gana el nombre del PLAN sobre el del grupo', () => {
    // "TRANS — Centro" dice dónde; "Transformados" dice qué. En una lista de
    // pagos lo que hace falta es qué.
    expect(paymentEntityName({
      concept: 'matricula', plan_name: 'Transformados', group_name: 'TRANS — Centro',
    })).toBe('Transformados')
  })

  it('sin plan cae al nombre del grupo', () => {
    expect(paymentEntityName({ concept: 'matricula', group_name: 'N1 — Centro' })).toBe('N1 — Centro')
  })

  it('en un evento, el título del evento', () => {
    expect(paymentEntityName({ concept: 'evento', event_name: 'Campa de servidores 2026' }))
      .toBe('Campa de servidores 2026')
  })
})

describe('paymentDescription', () => {
  it('tipo · nombre', () => {
    expect(paymentDescription({ concept: 'matricula', plan_name: 'Transformados' }))
      .toBe('Estudio · Transformados')
    expect(paymentDescription({ concept: 'evento', event_name: 'Campa 2026' }))
      .toBe('Evento · Campa 2026')
    expect(paymentDescription({ concept: 'prematrimonial', plan_name: 'Prematrimonial' }))
      .toBe('Prematrimonial · Prematrimonial')
  })

  it('sin nombre resoluble, al menos el tipo', () => {
    expect(paymentDescription({ concept: 'folletos' })).toBe('Folletos')
    expect(paymentDescription({})).toBe('Otro')
  })

  it('una descripción escrita a mano gana (pagos importados)', () => {
    expect(paymentDescription({
      concept: 'matricula', plan_name: 'Transformados', description: 'Abono parcial acordado con finanzas',
    })).toBe('Abono parcial acordado con finanzas')
  })

  it('una descripción en blanco no gana', () => {
    expect(paymentDescription({ concept: 'evento', event_name: 'Campa 2026', description: '   ' }))
      .toBe('Evento · Campa 2026')
  })
})
