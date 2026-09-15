import { describe, it, expect } from 'vitest'
import { clasificarAlergia, seBorra, sePuedeDescartar } from './limpieza-de-alergias'

describe('clasificarAlergia', () => {
  it('lo que no dice nada, en español y en inglés', () => {
    for (const t of ['No', 'no', 'Ninguna', 'ninguno', 'Nada', 'None', 'none', 'N/A', 'na', '-', '.'])
      expect(clasificarAlergia(t)).toBe('vacio')
  })

  it('una alergia real se queda', () => {
    for (const t of ['Asma', 'Rinitis', 'mariscos', 'Aspirina', 'AINES', 'Al Kiwi', 'Piña', 'Ácaros'])
      expect(clasificarAlergia(t)).toBe('alergia')
  })

  it('una restricción alimenticia se marca, pero NO se toca', () => {
    // Decisión del usuario: se dejan como las escribieron. "Gluten" puede ser
    // celiaquía o alergia, y esa diferencia le importa a quien cocina.
    for (const t of ['Gluten', 'Celiaca-No gluten', 'Intolerante a la lactosa', 'Lácteos y gluten'])
      expect(clasificarAlergia(t)).toBe('restriccion')
    expect(seBorra('Celiaca-No gluten')).toBe(false)
  })

  it('reconoce lo que se coló de otro campo', () => {
    expect(clasificarAlergia('carochm06@yahoo.com')).toBe('otro_campo')
    expect(clasificarAlergia('1-1396-0111')).toBe('otro_campo')   // cédula
    expect(clasificarAlergia('8774 7631')).toBe('otro_campo')     // teléfono
    expect(clasificarAlergia('4 años')).toBe('otro_campo')
    expect(clasificarAlergia('7 anos')).toBe('otro_campo')
  })

  it('un texto vacío o nulo no es un veredicto', () => {
    expect(clasificarAlergia(null)).toBeNull()
    expect(clasificarAlergia('   ')).toBeNull()
  })

  it('solo se borra lo que no dice nada', () => {
    expect(seBorra('Ninguna')).toBe(true)
    expect(seBorra('Asma')).toBe(false)
    expect(seBorra('carochm06@yahoo.com')).toBe(false)
  })

  it('"Maiz" es una alergia, no ruido, aunque sea una palabra suelta', () => {
    // El largo del texto no dice nada: la mitad de las alergias reales son una
    // sola palabra.
    expect(clasificarAlergia('Maiz')).toBe('alergia')
  })
})

describe('sePuedeDescartar', () => {
  it('sí, cuando el dato ya está guardado donde va', () => {
    expect(sePuedeDescartar('andre2r18@hotmail.com', { email: 'andre2r18@hotmail.com' })).toBe(true)
    expect(sePuedeDescartar('1-1396-0111', { cedula_normalized: '113960111' })).toBe(true)
    expect(sePuedeDescartar('8774 7631', { phone: '87747631' })).toBe(true)
  })

  it('NO, cuando el texto es lo único que queda de ese dato', () => {
    // Ivannia escribió su cédula ahí y tiene el campo vacío: borrarlo la pierde.
    expect(sePuedeDescartar('1-1396-0111', { cedula_normalized: null })).toBe(false)
    // Carolina tiene otro correo en su ficha: este es un segundo correo, no el mismo.
    expect(sePuedeDescartar('carochm06@yahoo.com', { email: 'carochm06@gmail.com' })).toBe(false)
  })

  it('no confunde dos números cortos distintos', () => {
    expect(sePuedeDescartar('12345', { phone: '99912345' })).toBe(false)
  })
})
