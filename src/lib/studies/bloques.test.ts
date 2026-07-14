import { describe, it, expect } from 'vitest'
import {
  addDays, bloqueMilestones, bloqueEstadoActual, suggestedBlocksForYear, isCapacitacion,
} from './bloques'

describe('addDays', () => {
  it('suma días dentro del mes', () => {
    expect(addDays('2026-08-10', 5)).toBe('2026-08-15')
  })
  it('cruza fin de mes', () => {
    expect(addDays('2026-08-30', 5)).toBe('2026-09-04')
  })
  it('cruza fin de año', () => {
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04')
  })
  it('resta días (offsets negativos de los hitos)', () => {
    expect(addDays('2026-09-14', -21)).toBe('2026-08-24')
  })
  it('año bisiesto: 28 feb + 1 = 29 feb', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('bloqueMilestones', () => {
  it('preliminar = apertura - 3 semanas, confirmación = -2, final = cierre', () => {
    expect(bloqueMilestones('2026-09-14', '2026-09-21')).toEqual({
      preliminar: '2026-08-24',
      confirmacion: '2026-08-31',
      final: '2026-09-21',
    })
  })
})

describe('bloqueEstadoActual', () => {
  const apertura = '2026-09-14'
  const cierre = '2026-09-21'
  it('antes del primer hito (apertura - 21) → en_apertura', () => {
    expect(bloqueEstadoActual(apertura, cierre, '2026-08-23')).toBe('en_apertura')
  })
  it('el día exacto del primer hito → activo', () => {
    expect(bloqueEstadoActual(apertura, cierre, '2026-08-24')).toBe('activo')
  })
  it('el día exacto del cierre → todavía activo', () => {
    expect(bloqueEstadoActual(apertura, cierre, '2026-09-21')).toBe('activo')
  })
  it('el día después del cierre → archivado', () => {
    expect(bloqueEstadoActual(apertura, cierre, '2026-09-22')).toBe('archivado')
  })
})

describe('suggestedBlocksForYear', () => {
  it('genera 3 bloques (ene/may/sep) con cierre = apertura + 7', () => {
    const blocks = suggestedBlocksForYear(2027)
    expect(blocks).toEqual([
      { nombre: 'Capacitaciones I-2027', fecha_apertura: '2027-01-15', fecha_cierre_matricula: '2027-01-22' },
      { nombre: 'Capacitaciones II-2027', fecha_apertura: '2027-05-15', fecha_cierre_matricula: '2027-05-22' },
      { nombre: 'Capacitaciones III-2027', fecha_apertura: '2027-09-15', fecha_cierre_matricula: '2027-09-22' },
    ])
  })
})

describe('isCapacitacion', () => {
  it('niveles y DIS2/DIS3 NO son capacitación', () => {
    for (const code of ['N1', 'N2', 'N3', 'N4', 'DIS2', 'DIS3']) {
      expect(isCapacitacion(code)).toBe(false)
    }
  })
  it('el resto de códigos sí (incl. DIS1, que abre la cadena)', () => {
    expect(isCapacitacion('DIS1')).toBe(true)
    expect(isCapacitacion('SCJ')).toBe(true)
  })
  it('null/undefined/vacío → false', () => {
    expect(isCapacitacion(null)).toBe(false)
    expect(isCapacitacion(undefined)).toBe(false)
    expect(isCapacitacion('')).toBe(false)
  })
})
