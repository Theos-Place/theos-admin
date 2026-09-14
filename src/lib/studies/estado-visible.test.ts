import { describe, it, expect } from 'vitest'
import {
  estadoVisible, estadosGuardadosParaFiltro, coincideEstadoVisible,
  ETIQUETA_VISIBLE, BADGE_VISIBLE, ESTADOS_VISIBLES, type EstadoVisible,
  desglosarSeleccion,
} from './estado-visible'

const HOY = '2026-09-14'
const g = (over: Partial<Parameters<typeof estadoVisible>[0]> = {}) => ({
  status: 'en_matricula' as const, enrollment_end_date: null, start_date: null, ...over,
})

describe('estadoVisible', () => {
  it('con la ventana abierta sigue en matrícula', () => {
    expect(estadoVisible(g({ enrollment_end_date: '2026-09-21' }), HOY)).toBe('en_matricula')
  })
  it('el último día de matrícula todavía es matrícula', () => {
    // Se cierra DESPUÉS del día de cierre, no ese mismo día.
    expect(estadoVisible(g({ enrollment_end_date: HOY }), HOY)).toBe('en_matricula')
  })
  it('con la ventana vencida pasa a "por iniciar"', () => {
    expect(estadoVisible(g({ enrollment_end_date: '2026-09-13' }), HOY)).toBe('por_iniciar')
  })
  it('sin fecha de cierre nunca pasa: no hay cómo saberlo', () => {
    expect(estadoVisible(g({ enrollment_end_date: null }), HOY)).toBe('en_matricula')
    expect(estadoVisible(g({ enrollment_end_date: '' }), HOY)).toBe('en_matricula')
  })
  it('acepta un timestamp completo y se queda con la fecha', () => {
    expect(estadoVisible(g({ enrollment_end_date: '2026-09-13T00:00:00Z' }), HOY)).toBe('por_iniciar')
  })

  it('no toca los otros dos estados guardados', () => {
    expect(estadoVisible(g({ status: 'en_curso', enrollment_end_date: '2026-09-13' }), HOY)).toBe('en_curso')
    expect(estadoVisible(g({ status: 'finalizado', enrollment_end_date: '2026-09-13' }), HOY)).toBe('finalizado')
  })

  it('sigue en "por iniciar" aunque la fecha de inicio ya haya llegado', () => {
    // El cron nocturno lo pasa a en_curso; en las horas del medio "Por iniciar"
    // describe mejor la realidad que "En matrícula".
    expect(estadoVisible(g({ enrollment_end_date: '2026-09-01', start_date: '2026-09-14' }), HOY)).toBe('por_iniciar')
  })

  it('correr la fecha de cierre lo devuelve a matrícula', () => {
    const grupo = g({ enrollment_end_date: '2026-09-13' })
    expect(estadoVisible(grupo, HOY)).toBe('por_iniciar')
    expect(estadoVisible({ ...grupo, enrollment_end_date: '2026-09-30' }, HOY)).toBe('en_matricula')
  })
})

describe('filtro', () => {
  it('"por iniciar" le pide al servidor los en_matricula', () => {
    expect(estadosGuardadosParaFiltro(['por_iniciar'])).toEqual(['en_matricula'])
  })
  it('pedir los dos no duplica el estado guardado', () => {
    expect(estadosGuardadosParaFiltro(['en_matricula', 'por_iniciar'])).toEqual(['en_matricula'])
  })
  it('los otros pasan tal cual', () => {
    expect(estadosGuardadosParaFiltro(['en_curso', 'finalizado'])).toEqual(['en_curso', 'finalizado'])
  })

  it('sin nada elegido no filtra', () => {
    expect(coincideEstadoVisible(g(), [], HOY)).toBe(true)
  })
  it('separa dos grupos con el MISMO estado guardado', () => {
    // Es el punto de todo esto: los dos son 'en_matricula' en la base.
    const abierto = g({ enrollment_end_date: '2026-09-21' })
    const cerrado = g({ enrollment_end_date: '2026-09-13' })
    expect(coincideEstadoVisible(abierto, ['en_matricula'], HOY)).toBe(true)
    expect(coincideEstadoVisible(cerrado, ['en_matricula'], HOY)).toBe(false)
    expect(coincideEstadoVisible(cerrado, ['por_iniciar'], HOY)).toBe(true)
    expect(coincideEstadoVisible(abierto, ['por_iniciar'], HOY)).toBe(false)
  })
})

describe('presentación', () => {
  it('los cuatro van en el orden en que avanza un grupo', () => {
    expect(ESTADOS_VISIBLES).toEqual(['en_matricula', 'por_iniciar', 'en_curso', 'finalizado'])
  })
  it('cada uno tiene etiqueta y badge', () => {
    for (const e of ESTADOS_VISIBLES as EstadoVisible[]) {
      expect(ETIQUETA_VISIBLE[e]).toBeTruthy()
      expect(BADGE_VISIBLE[e]).toBeTruthy()
    }
  })
})

describe('desglosarSeleccion', () => {
  it('sin nada elegido no filtra', () => {
    expect(desglosarSeleccion([]).sinFiltro).toBe(true)
  })
  it('con los cuatro tampoco', () => {
    expect(desglosarSeleccion(ESTADOS_VISIBLES).sinFiltro).toBe(true)
  })
  it('solo "por iniciar": en_matricula con la ventana cerrada', () => {
    expect(desglosarSeleccion(['por_iniciar'])).toEqual({
      guardados: [], matriculaAbierta: false, matriculaCerrada: true, sinFiltro: false,
    })
  })
  it('solo "en matrícula": la ventana abierta', () => {
    expect(desglosarSeleccion(['en_matricula'])).toEqual({
      guardados: [], matriculaAbierta: true, matriculaCerrada: false, sinFiltro: false,
    })
  })
  it('el caso que obliga a desglosar: "por iniciar" + "en curso"', () => {
    // Un filtro global de ventana cerrada dejaría fuera a los en_curso.
    expect(desglosarSeleccion(['por_iniciar', 'en_curso'])).toEqual({
      guardados: ['en_curso'], matriculaAbierta: false, matriculaCerrada: true, sinFiltro: false,
    })
  })
  it('el default de la pantalla trae los dos lados de matrícula', () => {
    const d = desglosarSeleccion(['en_matricula', 'por_iniciar', 'en_curso'])
    expect(d.matriculaAbierta && d.matriculaCerrada).toBe(true)
    expect(d.guardados).toEqual(['en_curso'])
  })
})
