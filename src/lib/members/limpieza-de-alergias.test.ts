import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
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

describe('el import usa esta misma regla', () => {
  // Limpiar la base no sirve de nada si el import vuelve a meter la basura.
  // Pasó: Ivannia Mora entró con su cédula en el campo de alergias en julio y
  // OTRA VEZ en setiembre. El import tenía su propio filtro, un /^\d+$/ que
  // solo agarraba números puros y se le colaba la cédula con guiones.
  const IMPORT = readFileSync('scripts/import-members.ts', 'utf8')

  it('llama a clasificarAlergia y no a un filtro propio', () => {
    expect(IMPORT).toMatch(/clasificarAlergia\(allergiesRaw\)/)
    expect(IMPORT).not.toMatch(/\/\^\\d\+\$\/\.test\(allergiesRaw\)/)
  })

  it('solo deja entrar alergia y restricción', () => {
    expect(IMPORT).toMatch(/veredicto === 'alergia' \|\| veredicto === 'restriccion'/)
  })

  it('reporta lo que descartó en vez de tragárselo', () => {
    // El filtro viejo descartaba en silencio, y por eso nadie notó durante dos
    // imports que el campo venía con cédulas.
    expect(IMPORT).toMatch(/alergiasDeOtroCampo/)
    expect(IMPORT).toMatch(/corregir en CCB/)
  })
})
