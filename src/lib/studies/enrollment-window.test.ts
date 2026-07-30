import { describe, it, expect } from 'vitest'
import { isEnrollmentWindowOpen, shouldCloseEnrollment, validateEnrollmentDates, defaultEnrollmentWindow, minEnrollmentEnd, maxEnrollmentEnd } from './enrollment-window'

describe('enrollment-window (GRU-1)', () => {
  it('ventana abierta: sin fechas siempre; con fechas, inclusivo en ambos extremos', () => {
    expect(isEnrollmentWindowOpen(null, null, '2026-07-27')).toBe(true)
    expect(isEnrollmentWindowOpen('2026-07-01', '2026-07-31', '2026-07-27')).toBe(true)
    expect(isEnrollmentWindowOpen('2026-07-01', '2026-07-31', '2026-07-01')).toBe(true)
    expect(isEnrollmentWindowOpen('2026-07-01', '2026-07-31', '2026-07-31')).toBe(true)
  })

  it('ventana cerrada: antes del inicio o después del fin', () => {
    expect(isEnrollmentWindowOpen('2026-08-01', null, '2026-07-27')).toBe(false)
    expect(isEnrollmentWindowOpen(null, '2026-07-20', '2026-07-27')).toBe(false)
  })

  it('cron cierra: en_matricula + ventana vencida + grupo ya inició', () => {
    const g = { status: 'en_matricula', enrollment_end_date: '2026-07-20', starts_at: '2026-07-25' }
    expect(shouldCloseEnrollment(g, '2026-07-27')).toBe(true)
  })

  it('cron NO toca: cambio manual (en_curso/finalizado), ventana vigente, sin fechas, o grupo sin iniciar', () => {
    expect(shouldCloseEnrollment({ status: 'en_curso', enrollment_end_date: '2026-07-20', starts_at: '2026-07-25' }, '2026-07-27')).toBe(false)
    expect(shouldCloseEnrollment({ status: 'finalizado', enrollment_end_date: '2026-07-20', starts_at: '2026-07-25' }, '2026-07-27')).toBe(false)
    expect(shouldCloseEnrollment({ status: 'en_matricula', enrollment_end_date: '2026-07-30', starts_at: '2026-07-25' }, '2026-07-27')).toBe(false)
    expect(shouldCloseEnrollment({ status: 'en_matricula', enrollment_end_date: null, starts_at: '2026-07-25' }, '2026-07-27')).toBe(false)
    expect(shouldCloseEnrollment({ status: 'en_matricula', enrollment_end_date: '2026-07-20', starts_at: '2026-08-15' }, '2026-07-27')).toBe(false)
    expect(shouldCloseEnrollment({ status: 'en_matricula', enrollment_end_date: '2026-07-20', starts_at: null }, '2026-07-27')).toBe(false)
  })

  it('validación de fechas: inicio <= fin <= inicio del grupo', () => {
    expect(validateEnrollmentDates({ enrollment_start_date: '2026-07-01', enrollment_end_date: '2026-07-31' })).toBeNull()
    expect(validateEnrollmentDates({ enrollment_start_date: '2026-08-01', enrollment_end_date: '2026-07-31' })).toMatch(/inicio de matrícula/)
    expect(validateEnrollmentDates({ enrollment_end_date: '2026-08-10', starts_at: '2026-08-01' })).toMatch(/fin de matrícula/)
    expect(validateEnrollmentDates({ enrollment_end_date: '2026-08-01', starts_at: '2026-08-01' })).toBeNull()
    expect(validateEnrollmentDates({})).toBeNull()
  })
})

describe('ventana de matrícula: defaults y límites del form (bug 2026-07-30)', () => {
  const HOY = '2026-07-30'

  it('al crear un grupo la ventana abre HOY → HOY', () => {
    expect(defaultEnrollmentWindow(HOY)).toEqual({ start: HOY, end: HOY })
  })

  it('el fin nunca puede ser menor al inicio ni anterior a hoy', () => {
    // inicio futuro manda
    expect(minEnrollmentEnd('2026-08-15', HOY)).toBe('2026-08-15')
    // inicio pasado (o vacío) → el piso es hoy: la ventana cierra hacia el futuro
    expect(minEnrollmentEnd('2026-07-01', HOY)).toBe(HOY)
    expect(minEnrollmentEnd(null, HOY)).toBe(HOY)
    expect(minEnrollmentEnd('', HOY)).toBe(HOY)
  })

  it('el tope es el arranque del grupo SOLO si es futuro', () => {
    expect(maxEnrollmentEnd('2026-09-01', HOY)).toBe('2026-09-01')
    // CAUSA DEL BUG: con un arranque de hoy o pasado, acotar por ahí bloqueaba
    // toda fecha válida y el campo quedaba inservible.
    expect(maxEnrollmentEnd(HOY, HOY)).toBeUndefined()
    expect(maxEnrollmentEnd('2026-06-01', HOY)).toBeUndefined()
    expect(maxEnrollmentEnd(null, HOY)).toBeUndefined()
  })

  it('la validación del server es espejo de los límites del input', () => {
    // grupo que arranca en el futuro: el fin no puede pasarse de ahí
    expect(validateEnrollmentDates({
      enrollment_start_date: HOY, enrollment_end_date: '2026-09-10', starts_at: '2026-09-01',
    }, HOY)).toMatch(/después de la fecha de inicio del grupo/)
    // grupo YA arrancado: un fin futuro es válido (antes daba 400)
    expect(validateEnrollmentDates({
      enrollment_start_date: HOY, enrollment_end_date: '2026-08-20', starts_at: '2026-06-01',
    }, HOY)).toBeNull()
    // inicio después del fin sigue siendo error
    expect(validateEnrollmentDates({
      enrollment_start_date: '2026-08-20', enrollment_end_date: '2026-08-01', starts_at: null,
    }, HOY)).toMatch(/no puede ser después del fin/)
  })
})
