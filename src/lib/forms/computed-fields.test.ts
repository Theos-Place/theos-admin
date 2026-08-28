import { describe, it, expect } from 'vitest'
import { esCampoCalculado, textoEstudiosAprobados } from './computed-fields'

describe('esCampoCalculado', () => {
  it('reconoce el de estudios y no los normales', () => {
    expect(esCampoCalculado('studies_done')).toBe(true)
    expect(esCampoCalculado('text')).toBe(false)
    expect(esCampoCalculado('image')).toBe(false)
  })
})

describe('textoEstudiosAprobados', () => {
  it('ordena por fecha, del más viejo al más nuevo', () => {
    expect(textoEstudiosAprobados([
      { nombre: 'Panorama', fecha: '2025-03-01' },
      { nombre: 'Nivel 1', fecha: '2019-06-10' },
      { nombre: 'Sirviendo como Jesús', fecha: '2022-08-04' },
    ])).toBe('Nivel 1, Sirviendo como Jesús, Panorama')
  })
  it('los que no tienen fecha van primero y no rompen el orden', () => {
    expect(textoEstudiosAprobados([
      { nombre: 'Con fecha', fecha: '2020-01-01' },
      { nombre: 'Sin fecha', fecha: null },
    ])).toBe('Sin fecha, Con fecha')
  })
  it('sin estudios dice "Ninguno", no queda vacío', () => {
    // Una celda vacía se lee como "no se preguntó"; "Ninguno" dice que se
    // preguntó y la respuesta es esa.
    expect(textoEstudiosAprobados([])).toBe('Ninguno')
  })
  it('no muta lo que recibe', () => {
    const xs = [{ nombre: 'B', fecha: '2022-01-01' }, { nombre: 'A', fecha: '2020-01-01' }]
    textoEstudiosAprobados(xs)
    expect(xs[0].nombre).toBe('B')
  })
})
