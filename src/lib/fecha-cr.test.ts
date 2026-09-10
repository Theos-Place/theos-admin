import { describe, it, expect } from 'vitest'
import { fechaCR, esFechaCivil } from './fecha-cr'

describe('fechaCR', () => {
  it('el caso real: el grupo de Sonia empieza el 29, no el 28', () => {
    // starts_at guardado = '2026-09-29', que es martes, el día del grupo.
    // El correo decía "28 de septiembre de 2026", que era lunes.
    expect(fechaCR('2026-09-29')).toBe('29 de septiembre de 2026')
  })

  it('una fecha sin hora NO se convierte de zona: el 1 sigue siendo el 1', () => {
    expect(fechaCR('2026-01-01')).toBe('1 de enero de 2026')
    expect(fechaCR('2026-06-01')).toBe('1 de junio de 2026')
  })

  it('el 1 de enero no se cae al 31 de diciembre del año anterior', () => {
    expect(fechaCR('2023-01-01')).not.toContain('diciembre')
    expect(fechaCR('2023-01-01')).toContain('2023')
  })

  it('un instante real SÍ se muestra en hora de Costa Rica', () => {
    // 2026-09-10T01:30:00Z son las 7:30 p.m. del 9 en Costa Rica.
    expect(fechaCR('2026-09-10T01:30:00Z')).toBe('9 de septiembre de 2026')
  })

  it('los otros formatos también respetan la fecha civil', () => {
    expect(fechaCR('2026-09-29', 'numerica')).toBe('29/09/2026')
    expect(fechaCR('2026-09-29', 'corta')).toContain('29')
  })

  it('sin valor devuelve vacío, y un texto raro se devuelve tal cual', () => {
    expect(fechaCR(null)).toBe('')
    expect(fechaCR(undefined)).toBe('')
    expect(fechaCR('')).toBe('')
    expect(fechaCR('mañana')).toBe('mañana')
  })
})

describe('esFechaCivil', () => {
  it('distingue una fecha de un instante', () => {
    expect(esFechaCivil('2026-09-29')).toBe(true)
    expect(esFechaCivil('2026-09-29T00:00:00Z')).toBe(false)
    expect(esFechaCivil(null)).toBe(false)
  })
})
