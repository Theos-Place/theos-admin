import { describe, it, expect } from 'vitest'
import { studyGradeDisplay } from './grade-display'

describe('studyGradeDisplay (EST-8)', () => {
  it('la nota numérica manda', () => {
    expect(studyGradeDisplay(95, 'aprobado')).toEqual({ text: '95' })
    expect(studyGradeDisplay(0, null)).toEqual({ text: '0' })
  })

  it('sin nota pero con resultado, muestra el resultado', () => {
    expect(studyGradeDisplay(null, 'aprobado')).toEqual({ text: 'aprobado' })
  })

  it('reprobado: etiqueta corta + motivo como tooltip', () => {
    expect(studyGradeDisplay(null, 'reprobado: faltó a 4 clases'))
      .toEqual({ text: 'Reprobado', tooltip: 'reprobado: faltó a 4 clases' })
  })

  it('sin nada → —', () => {
    expect(studyGradeDisplay(null, null)).toEqual({ text: '—' })
  })
})
