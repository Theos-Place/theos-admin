import { describe, it, expect } from 'vitest'
import { refundKindFromPayment, refundKindLabel, kindHasPlan } from './refund-kind'

describe('refundKindFromPayment', () => {
  // El test que pide la spec: el tipo derivado sale correcto del pago.
  it('una matrícula es estudio', () => {
    expect(refundKindFromPayment({ concept: 'matricula', study_group_id: 'g1' })).toBe('estudio')
  })

  // La distinción que el pago NO hace: campaña sale del nivel del plan.
  it('una matrícula de un plan de campaña es campaña', () => {
    expect(refundKindFromPayment({ concept: 'matricula', study_group_id: 'g1', plan_level: 'campanas' }))
      .toBe('campana')
  })

  it('un plan de niveles sigue siendo estudio', () => {
    expect(refundKindFromPayment({ concept: 'matricula', plan_level: 'niveles' })).toBe('estudio')
    expect(refundKindFromPayment({ concept: 'matricula', plan_level: 'etapa_inicial' })).toBe('estudio')
  })

  it('evento, prematrimonial y folletos salen del concepto', () => {
    expect(refundKindFromPayment({ concept: 'evento', event_id: 'e1' })).toBe('evento')
    expect(refundKindFromPayment({ concept: 'prematrimonial' })).toBe('prematrimonial')
    expect(refundKindFromPayment({ concept: 'folletos' })).toBe('folletos')
  })

  it('sin concepto se deduce de la entidad', () => {
    expect(refundKindFromPayment({ concept: null, event_id: 'e1' })).toBe('evento')
    expect(refundKindFromPayment({ concept: null, study_group_id: 'g1' })).toBe('estudio')
    expect(refundKindFromPayment({ concept: null, entity_type: 'event' })).toBe('evento')
    expect(refundKindFromPayment({ concept: null, entity_type: 'study_group' })).toBe('estudio')
  })

  it('sin nada que derivar queda en otro', () => {
    expect(refundKindFromPayment({})).toBe('otro')
    expect(refundKindFromPayment({ concept: null })).toBe('otro')
  })

  // El nivel de campaña no convierte un EVENTO en campaña.
  it('plan_level no afecta a un pago de evento', () => {
    expect(refundKindFromPayment({ concept: 'evento', event_id: 'e1', plan_level: 'campanas' })).toBe('evento')
  })
})

describe('refundKindLabel', () => {
  it('etiqueta legible, con tilde donde toca', () => {
    expect(refundKindLabel('campana')).toBe('Campaña')
    expect(refundKindLabel('estudio')).toBe('Estudio')
    expect(refundKindLabel('evento')).toBe('Evento')
  })

  it('lo desconocido o vacío cae en Otro', () => {
    expect(refundKindLabel(null)).toBe('Otro')
    expect(refundKindLabel(undefined)).toBe('Otro')
    expect(refundKindLabel('lo-que-sea')).toBe('Otro')
  })
})

describe('kindHasPlan', () => {
  it('solo los tipos que salen de un plan admiten filtro por plan', () => {
    expect(kindHasPlan('estudio')).toBe(true)
    expect(kindHasPlan('campana')).toBe(true)
    expect(kindHasPlan('prematrimonial')).toBe(true)
    expect(kindHasPlan('evento')).toBe(false)
    expect(kindHasPlan('folletos')).toBe(false)
    expect(kindHasPlan(null)).toBe(false)
  })
})
