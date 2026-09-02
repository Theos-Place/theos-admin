import { describe, it, expect } from 'vitest'
import { desgloseFolletos, textoDesglose, textoDesgloseCorto } from './folleto-desglose'

describe('desgloseFolletos', () => {
  it('suma el folleto del dirigente y del co-dirigente', () => {
    expect(desgloseFolletos({ estudiantes: 14, tieneDirigente: true, tieneCoDirigente: true }))
      .toEqual({ estudiantes: 14, dirigentes: 2, total: 16 })
  })

  it('un solo dirigente suma uno', () => {
    expect(desgloseFolletos({ estudiantes: 10, tieneDirigente: true, tieneCoDirigente: false }))
      .toEqual({ estudiantes: 10, dirigentes: 1, total: 11 })
  })

  it('sin dirigente asignado no inventa folletos de más', () => {
    expect(desgloseFolletos({ estudiantes: 8, tieneDirigente: false, tieneCoDirigente: false }))
      .toEqual({ estudiantes: 8, dirigentes: 0, total: 8 })
  })

  it('un co-dirigente sin dirigente igual cuenta: alguien va a dar el estudio', () => {
    expect(desgloseFolletos({ estudiantes: 5, tieneDirigente: false, tieneCoDirigente: true }).total).toBe(6)
  })

  it('no deja que un conteo raro produzca un total negativo', () => {
    expect(desgloseFolletos({ estudiantes: -3, tieneDirigente: true, tieneCoDirigente: false }))
      .toEqual({ estudiantes: 0, dirigentes: 1, total: 1 })
  })

  it('trunca decimales en vez de arrastrarlos al total', () => {
    expect(desgloseFolletos({ estudiantes: 7.8, tieneDirigente: false, tieneCoDirigente: false }).total).toBe(7)
  })
})

describe('textoDesglose', () => {
  it('dice de dónde sale el total', () => {
    const d = desgloseFolletos({ estudiantes: 14, tieneDirigente: true, tieneCoDirigente: true })
    expect(textoDesglose(d)).toBe('14 de estudiantes + 2 de dirigentes = 16')
  })

  it('singular con un solo dirigente', () => {
    const d = desgloseFolletos({ estudiantes: 10, tieneDirigente: true, tieneCoDirigente: false })
    expect(textoDesglose(d)).toBe('10 de estudiantes + 1 de dirigente = 11')
  })

  it('avisa cuando el grupo no tiene dirigente, en vez de callarlo', () => {
    const d = desgloseFolletos({ estudiantes: 8, tieneDirigente: false, tieneCoDirigente: false })
    expect(textoDesglose(d)).toContain('no tiene dirigente asignado')
  })
})

describe('textoDesgloseCorto (celda de tabla)', () => {
  it('separa estudiantes y dirigentes sin repetir el total', () => {
    const d = desgloseFolletos({ estudiantes: 6, tieneDirigente: true, tieneCoDirigente: true })
    expect(textoDesgloseCorto(d)).toBe('6 de estudiantes · 2 de dirigentes')
  })

  it('singular donde toca', () => {
    const d = desgloseFolletos({ estudiantes: 1, tieneDirigente: true, tieneCoDirigente: false })
    expect(textoDesgloseCorto(d)).toBe('1 de estudiante · 1 de dirigente')
  })

  it('sin dirigentes no deja un "0 de dirigentes" colgando', () => {
    const d = desgloseFolletos({ estudiantes: 8, tieneDirigente: false, tieneCoDirigente: false })
    expect(textoDesgloseCorto(d)).toBe('8 de estudiantes')
  })
})
