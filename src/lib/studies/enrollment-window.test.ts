import { describe, it, expect } from 'vitest'
import { isEnrollmentWindowOpen, shouldCloseEnrollment, validateEnrollmentDates } from './enrollment-window'

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
