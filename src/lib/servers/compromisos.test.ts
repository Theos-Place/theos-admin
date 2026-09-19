import { describe, it, expect } from 'vitest'
import { leFaltaAlgo, faltantes, etiquetaDeEstudio, type Compromisos } from './compromisos'

const base: Compromisos = {
  asistencia: true, llevandoEstudio: true, dandoEstudio: false,
  donante: true, ultimoCheckin: '2026-09-14',
}

describe('leFaltaAlgo', () => {
  it('con todo cumplido, no falta nada', () => {
    expect(leFaltaAlgo(base)).toBe(false)
  })

  it('dar un estudio cuenta igual que llevarlo', () => {
    const dirigente = { ...base, llevandoEstudio: false, dandoEstudio: true }
    expect(leFaltaAlgo(dirigente)).toBe(false)
    expect(faltantes(dirigente)).toEqual([])
  })

  it('sin ninguno de los dos, falta estudio', () => {
    const c = { ...base, llevandoEstudio: false, dandoEstudio: false }
    expect(leFaltaAlgo(c)).toBe(true)
    expect(faltantes(c)).toEqual(['estudio'])
  })

  it('nombra todo lo que falta, no solo lo primero', () => {
    expect(faltantes({ ...base, asistencia: false, donante: false }))
      .toEqual(['asistencia', 'donación'])
  })

  it('no haber ido nunca a un evento no es un incumplimiento', () => {
    // El último check-in es un dato para mirar; la asistencia ya se mide aparte.
    expect(leFaltaAlgo({ ...base, ultimoCheckin: null })).toBe(false)
  })
})

describe('etiquetaDeEstudio', () => {
  it('se puede llevar y dar a la vez', () => {
    expect(etiquetaDeEstudio({ ...base, dandoEstudio: true })).toBe('Llevando · Dando')
  })
  it('sin estudio queda vacío, no "ninguno"', () => {
    expect(etiquetaDeEstudio({ ...base, llevandoEstudio: false })).toBe('')
  })
})
