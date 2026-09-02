import { describe, it, expect } from 'vitest'
import { nombreDelSucesor, etiquetaNivel } from './successor-name'

describe('nombreDelSucesor', () => {
  it('el caso real: reemplaza la etiqueta escrita, no antepone el código', () => {
    // Antes daba "N4 · Nivel 3. Floriana Fonseca. Junio 2026", que se lee
    // como si el grupo fuera de nivel 3 y de nivel 4 a la vez.
    expect(nombreDelSucesor({
      nombreOrigen: 'Nivel 3. Floriana Fonseca. Junio 2026',
      codigoOrigen: 'N3', codigoDestino: 'N4',
    })).toBe('Nivel 4. Floriana Fonseca. Junio 2026')
  })

  it('funciona en la cadena de discípulos', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'Discípulos 1. Ma. Fernanda Salazar. Junio 2026',
      codigoOrigen: 'DIS1', codigoDestino: 'DIS2',
    })).toBe('Discípulos 2. Ma. Fernanda Salazar. Junio 2026')
  })

  it('conserva lo que viene después del nivel', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'Nivel 2 Virtual. Andrea Chaves C. Junio 2026',
      codigoOrigen: 'N2', codigoDestino: 'N3',
    })).toBe('Nivel 3 Virtual. Andrea Chaves C. Junio 2026')
  })

  it('no le importan las mayúsculas', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'NIVEL 3. Fulano', codigoOrigen: 'N3', codigoDestino: 'N4',
    })).toBe('Nivel 4. Fulano')
  })

  it('si el nombre usa el código suelto, lo cambia', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'N3 — Este SJ', codigoOrigen: 'N3', codigoDestino: 'N4',
    })).toBe('N4 — Este SJ')
  })

  it('el código se busca como palabra entera: no rompe "N30"', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'Grupo N30 especial', codigoOrigen: 'N3', codigoDestino: 'N4',
    })).toBe('Nivel 4. Grupo N30 especial')
  })

  it('sin nivel reconocible, antepone la etiqueta nueva', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'Grupo de los martes', codigoOrigen: 'N3', codigoDestino: 'N4',
    })).toBe('Nivel 4. Grupo de los martes')
  })

  it('solo reemplaza la PRIMERA aparición', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'Nivel 3. Repaso de Nivel 3', codigoOrigen: 'N3', codigoDestino: 'N4',
    })).toBe('Nivel 4. Repaso de Nivel 3')
  })

  it('sin nombre de origen devuelve solo la etiqueta', () => {
    expect(nombreDelSucesor({ nombreOrigen: null, codigoOrigen: 'N3', codigoDestino: 'N4' }))
      .toBe('Nivel 4')
    expect(nombreDelSucesor({ nombreOrigen: '   ', codigoOrigen: 'N3', codigoDestino: 'N4' }))
      .toBe('Nivel 4')
  })
})

describe('etiquetaNivel', () => {
  it('traduce los códigos de las dos cadenas', () => {
    expect(etiquetaNivel('N1')).toBe('Nivel 1')
    expect(etiquetaNivel('N4')).toBe('Nivel 4')
    expect(etiquetaNivel('DIS3')).toBe('Discípulos 3')
    expect(etiquetaNivel('PREMAT')).toBe('Prematrimonial')
  })

  it('un código desconocido se devuelve tal cual', () => {
    expect(etiquetaNivel('HER')).toBe('HER')
    expect(etiquetaNivel(null)).toBe('')
  })
})
