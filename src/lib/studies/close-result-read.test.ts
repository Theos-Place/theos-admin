import { describe, it, expect } from 'vitest'
import { clasificarResultado, contarResultadosCierre, motivoLegible, esHistorico } from './close-result-read'

describe('clasificarResultado: las dos formas de un reprobado', () => {
  it('el status explícito reprobado', () => {
    expect(clasificarResultado({ status: 'reprobado', notes: null })).toBe('reprobado')
  })

  it('completed con la nota del RPC también es reprobado, no aprobado', () => {
    expect(clasificarResultado({ status: 'completed', notes: 'reprobado: no llegó a las últimas 4 sesiones' }))
      .toBe('reprobado')
  })

  it('completed con la nota en mayúsculas igual cuenta', () => {
    expect(clasificarResultado({ status: 'completed', notes: 'Reprobado: faltó al examen' })).toBe('reprobado')
  })

  it('completed sin nota es aprobado', () => {
    expect(clasificarResultado({ status: 'completed', notes: null })).toBe('aprobado')
  })

  it('completed con la nota "aprobado" es aprobado', () => {
    expect(clasificarResultado({ status: 'completed', notes: 'aprobado' })).toBe('aprobado')
  })

  it('una nota que solo MENCIONA la palabra no lo vuelve reprobado', () => {
    expect(clasificarResultado({ status: 'completed', notes: 'aprobado, casi reprobado por asistencia' }))
      .toBe('aprobado')
  })

  it('dropped es retirado', () => {
    expect(clasificarResultado({ status: 'dropped', notes: null })).toBe('retirado')
  })

  it('en_revision es sin evaluar, no aprobado ni reprobado', () => {
    expect(clasificarResultado({ status: 'en_revision', notes: null })).toBe('sin_evaluar')
  })

  it('un cupo que nunca se ocupó no es un resultado', () => {
    expect(clasificarResultado({ status: 'expirada', notes: null })).toBe('otro')
    expect(clasificarResultado({ status: 'pendiente_de_pago', notes: null })).toBe('otro')
    expect(clasificarResultado({ status: 'enrolled', notes: null })).toBe('otro')
  })
})

describe('contarResultadosCierre', () => {
  it('cuenta las dos formas de reprobado juntas', () => {
    expect(contarResultadosCierre([
      { status: 'completed', notes: null },
      { status: 'completed', notes: null },
      { status: 'reprobado', notes: null },
      { status: 'completed', notes: 'reprobado: dejó de venir' },
      { status: 'dropped', notes: null },
      { status: 'en_revision', notes: null },
      { status: 'enrolled', notes: null },
    ])).toEqual({ aprobados: 2, reprobados: 2, retirados: 1, sin_evaluar: 1, historicos: 0 })
  })

  it('una lista vacía da todo en cero, no NaN', () => {
    expect(contarResultadosCierre([])).toEqual({ aprobados: 0, reprobados: 0, retirados: 0, sin_evaluar: 0, historicos: 0 })
  })
})

describe('motivoLegible', () => {
  it('quita el prefijo de la nota del reprobado', () => {
    expect(motivoLegible({ status: 'completed', notes: 'reprobado: no entregó el trabajo final', drop_reason: null }))
      .toBe('no entregó el trabajo final')
  })

  it('quita el prefijo del retiro', () => {
    expect(motivoLegible({ status: 'dropped', notes: null, drop_reason: 'Retirado en cierre: se cambió de país' }))
      .toBe('se cambió de país')
  })

  it('un retiro sin motivo devuelve null, no el prefijo solo', () => {
    expect(motivoLegible({ status: 'dropped', notes: null, drop_reason: 'Retirado en cierre' })).toBeNull()
  })

  it('un motivo viejo sin prefijo se devuelve tal cual', () => {
    expect(motivoLegible({ status: 'dropped', notes: null, drop_reason: 'nunca llegó' })).toBe('nunca llegó')
  })

  it('un aprobado no tiene motivo', () => {
    expect(motivoLegible({ status: 'completed', notes: null, drop_reason: null })).toBeNull()
  })
})

describe('arrastre de la importación: aprobó ANTES de que el grupo empezara', () => {
  it('el caso real: Laura Sandí aprobó en 2022 y quedó pegada a un grupo de 2026', () => {
    expect(clasificarResultado(
      { status: 'completed', notes: null, completed_at: '2022-09-08' },
      '2026-06-01',
    )).toBe('historico')
  })

  it('quien aprobó DURANTE el grupo es aprobado normal', () => {
    expect(clasificarResultado(
      { status: 'completed', notes: 'aprobado', completed_at: '2026-09-01' },
      '2026-06-01',
    )).toBe('aprobado')
  })

  it('aprobar el mismo día que arrancó cuenta como aprobado, no histórico', () => {
    expect(clasificarResultado(
      { status: 'completed', notes: null, completed_at: '2026-06-01' },
      '2026-06-01',
    )).toBe('aprobado')
  })

  it('sin el arranque del grupo no se descarta a nadie', () => {
    expect(clasificarResultado({ status: 'completed', notes: null, completed_at: '2022-09-08' }))
      .toBe('aprobado')
    expect(clasificarResultado({ status: 'completed', notes: null, completed_at: '2022-09-08' }, null))
      .toBe('aprobado')
  })

  it('sin fecha de aprobación tampoco se descarta', () => {
    expect(clasificarResultado({ status: 'completed', notes: null, completed_at: null }, '2026-06-01'))
      .toBe('aprobado')
  })

  it('un reprobado histórico sigue contando como reprobado', () => {
    // La reprobación es explícita; la antigüedad no la borra.
    expect(clasificarResultado(
      { status: 'completed', notes: 'reprobado: no llegó', completed_at: '2022-01-01' },
      '2026-06-01',
    )).toBe('reprobado')
  })

  it('el conteo del cierre real: 6 aprobados y 2 históricos, no 8 aprobados', () => {
    const filas = [
      ...Array(6).fill({ status: 'completed', notes: 'aprobado', completed_at: '2026-09-01' }),
      { status: 'completed', notes: null, completed_at: '2022-09-08' },
      { status: 'completed', notes: null, completed_at: '2022-01-28' },
    ]
    expect(contarResultadosCierre(filas, '2026-06-01'))
      .toEqual({ aprobados: 6, reprobados: 0, retirados: 0, sin_evaluar: 0, historicos: 2 })
  })

  it('acepta timestamps completos, no solo YYYY-MM-DD', () => {
    expect(esHistorico('2022-09-08T00:00:00.000Z', '2026-06-01T06:00:00.000Z')).toBe(true)
    expect(esHistorico('2026-09-01T00:00:00.000Z', '2026-06-01T06:00:00.000Z')).toBe(false)
  })
})
