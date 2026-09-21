import { describe, it, expect } from 'vitest'
import {
  grupoEnMarcha, matriculaVigente, textoDeEstudio, estaEnEstudio, mesYAnio,
  type EstudioDeLaPersona,
} from './estudio-actual'

const e = (x: Partial<EstudioDeLaPersona> = {}): EstudioDeLaPersona => ({
  llevando: [], dando: [], ultimo: null, ...x,
})

describe('qué cuenta como "ahora"', () => {
  it('manda el estado del GRUPO, no el de la matrícula', () => {
    // 675 matrículas 'enrolled' contra 68 grupos 'en_curso': mirar solo la
    // matrícula diría que media iglesia está estudiando.
    expect(grupoEnMarcha('en_curso')).toBe(true)
    expect(grupoEnMarcha('en_matricula')).toBe(true)
    expect(grupoEnMarcha('finalizado')).toBe(false)
    expect(grupoEnMarcha(null)).toBe(false)
  })

  it('quien salió del grupo no cuenta', () => {
    for (const s of ['dropped', 'cancelada', 'transferred']) expect(matriculaVigente(s), s).toBe(false)
    for (const s of ['enrolled', 'pendiente_de_pago', 'en_revision']) expect(matriculaVigente(s), s).toBe(true)
  })
})

describe('textoDeEstudio', () => {
  it('las tres formas empiezan con una palabra que dice qué son', () => {
    // "Nivel 2" a secas no dice si lo está llevando o si ya lo dio, y al lado de
    // "Último: …" la asimetría confunde.
    expect(textoDeEstudio(e({ llevando: ['X'] }))).toMatch(/^Cursando: /)
    expect(textoDeEstudio(e({ dando: ['X'] }))).toMatch(/^Dirige: /)
    expect(textoDeEstudio(e({ ultimo: { nombre: 'X', fecha: null } }))).toMatch(/^Último: /)
  })

  it('llevando dice cuál, con la palabra adelante', () => {
    expect(textoDeEstudio(e({ llevando: ['Nivel 2'] }))).toBe('Cursando: Nivel 2')
  })

  it('dando lleva la palabra Dirige', () => {
    expect(textoDeEstudio(e({ dando: ['SCJ'] }))).toBe('Dirige: SCJ')
  })

  it('llevando y dando a la vez, los dos', () => {
    expect(textoDeEstudio(e({ llevando: ['Nivel 3'], dando: ['Nivel 1'] })))
      .toBe('Cursando: Nivel 3 · Dirige: Nivel 1')
  })

  it('varios a la vez se listan', () => {
    expect(textoDeEstudio(e({ llevando: ['Nivel 2', 'SCJ'] }))).toBe('Cursando: Nivel 2, SCJ')
  })

  it('sin estudio ahora, muestra el último con su mes', () => {
    expect(textoDeEstudio(e({ ultimo: { nombre: 'Nivel 3', fecha: '2026-03-18' } })))
      .toBe('Último: Nivel 3 · mar 2026')
  })

  it('el último NO se muestra si está llevando algo: la columna se vuelve ilegible', () => {
    expect(textoDeEstudio(e({ llevando: ['Nivel 2'], ultimo: { nombre: 'Nivel 1', fecha: '2025-06-01' } })))
      .toBe('Cursando: Nivel 2')
  })

  it('último sin fecha no inventa una', () => {
    expect(textoDeEstudio(e({ ultimo: { nombre: 'Nivel 1', fecha: null } }))).toBe('Último: Nivel 1')
  })

  it('nunca llevó ninguno queda vacío', () => {
    expect(textoDeEstudio(e())).toBe('')
  })
})

describe('estaEnEstudio', () => {
  it('el último estudio es información, no cumplimiento', () => {
    expect(estaEnEstudio(e({ ultimo: { nombre: 'Nivel 3', fecha: '2026-03-18' } }))).toBe(false)
  })

  it('llevar o dar cumple', () => {
    expect(estaEnEstudio(e({ llevando: ['Nivel 1'] }))).toBe(true)
    expect(estaEnEstudio(e({ dando: ['Nivel 1'] }))).toBe(true)
  })
})

describe('mesYAnio', () => {
  it('usa "set" y no "sep", como el resto del sistema', () => {
    expect(mesYAnio('2026-09-18')).toBe('set 2026')
  })
  it('sin fecha, vacío', () => {
    expect(mesYAnio(null)).toBe('')
    expect(mesYAnio('cualquier cosa')).toBe('')
  })
})
