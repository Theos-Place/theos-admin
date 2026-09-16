import { describe, it, expect } from 'vitest'
import { isGroupFull, occupiesSpot, groupFullMessage, OCCUPYING_STATUSES, RELEASING_STATUSES, sigueEnElGrupo } from './enrollment-capacity'

describe('occupiesSpot', () => {
  it('ocupan cupo quienes están en el grupo', () => {
    for (const s of OCCUPYING_STATUSES) expect(occupiesSpot(s)).toBe(true)
  })

  it('lo liberan quienes ya no están', () => {
    for (const s of RELEASING_STATUSES) expect(occupiesSpot(s)).toBe(false)
    expect(occupiesSpot(null)).toBe(false)
    expect(occupiesSpot(undefined)).toBe(false)
  })

  it('las matrículas viejas en pendiente_de_pago siguen ocupando su campo', () => {
    // El estado ya no se escribe (2026-08-04), pero las que quedaron cuentan.
    expect(occupiesSpot('pendiente_de_pago')).toBe(true)
  })
})

describe('isGroupFull', () => {
  it('lleno cuando los activos llegan al tope', () => {
    expect(isGroupFull({ activeCount: 12, maxCapacity: 12 })).toBe(true)
    expect(isGroupFull({ activeCount: 13, maxCapacity: 12 })).toBe(true)
  })

  it('hay campo mientras falte uno', () => {
    expect(isGroupFull({ activeCount: 11, maxCapacity: 12 })).toBe(false)
    expect(isGroupFull({ activeCount: 0, maxCapacity: 1 })).toBe(false)
  })

  it('sin cupo declarado no hay tope', () => {
    expect(isGroupFull({ activeCount: 500, maxCapacity: null })).toBe(false)
    expect(isGroupFull({ activeCount: 500, maxCapacity: 0 })).toBe(false)
    expect(isGroupFull({ activeCount: 500, maxCapacity: undefined })).toBe(false)
  })

  it('el mensaje dice el tope cuando lo hay', () => {
    expect(groupFullMessage(12)).toContain('12')
    expect(groupFullMessage(null)).toContain('cupo')
  })
})

describe('sigueEnElGrupo', () => {
  it('un retirado NO sigue en el grupo: tiene que poder volver', () => {
    // El caso: a María José Ruiz la retiraron de Lecturas con Propósito cuando
    // se le venció el cobro manual, y después la pantalla la daba por "Ya
    // inscrito" con el botón deshabilitado. El servidor sí acepta la
    // reincorporación — solo frena a quien COMPLETÓ el estudio.
    expect(sigueEnElGrupo('withdrawn')).toBe(false)
  })

  it('los demás sí siguen dentro', () => {
    expect(sigueEnElGrupo('enrolled')).toBe(true)
    expect(sigueEnElGrupo('pending')).toBe(true)
  })

  it('"en revisión" cuenta como dentro', () => {
    // Es alguien cuyo grupo cerró sin registrarle resultado, no alguien que se
    // fue: volver a agregarlo duplicaría su matrícula.
    expect(sigueEnElGrupo('en_revision')).toBe(true)
  })
})
