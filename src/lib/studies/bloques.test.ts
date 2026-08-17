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

describe('bloqueEstadoActual (regla por cuatrimestre)', () => {
  // Bloque 2 abre en mayo, bloque 3 en septiembre.
  const aperturas = ['2026-01-15', '2026-05-15', '2026-09-14']
  it('antes de la apertura → en_apertura', () => {
    expect(bloqueEstadoActual('2026-09-14', aperturas, '2026-09-13')).toBe('en_apertura')
  })
  it('el día de la apertura → activo', () => {
    expect(bloqueEstadoActual('2026-09-14', aperturas, '2026-09-14')).toBe('activo')
  })
  it('sigue activo aunque su matrícula haya cerrado, hasta que abra el siguiente', () => {
    expect(bloqueEstadoActual('2026-05-15', aperturas, '2026-08-17')).toBe('activo')
  })
  it('cuando abre el bloque siguiente → archivado', () => {
    expect(bloqueEstadoActual('2026-05-15', aperturas, '2026-09-14')).toBe('archivado')
  })
  it('el último bloque queda activo indefinidamente si no hay otro posterior', () => {
    expect(bloqueEstadoActual('2026-09-14', aperturas, '2027-06-01')).toBe('activo')
  })
})

describe('suggestedBlocksForYear', () => {
  it('genera 3 bloques (ene/may/sep) con cierre = apertura + 7', () => {
    const blocks = suggestedBlocksForYear(2027)
    expect(blocks).toEqual([
      { nombre: 'Bloque 1 2027', fecha_apertura: '2027-01-15', fecha_cierre_matricula: '2027-01-22' },
      { nombre: 'Bloque 2 2027', fecha_apertura: '2027-05-15', fecha_cierre_matricula: '2027-05-22' },
      { nombre: 'Bloque 3 2027', fecha_apertura: '2027-09-15', fecha_cierre_matricula: '2027-09-22' },
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
