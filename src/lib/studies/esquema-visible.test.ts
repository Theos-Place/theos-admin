import { describe, it, expect } from 'vitest'
import { esquemaDelGrupo, folletosDelTiquete, porQueImporta, NOMBRE_DEL_ESQUEMA } from './esquema-visible'

const NOMBRES = { N1: 'Nivel 1', N2: 'Nivel 2', N3: 'Nivel 3', N4: 'Nivel 4', DIS1: 'Discípulos 1', DIS2: 'Discípulos 2', DIS3: 'Discípulos 3' }

describe('EST-28 · cómo se nombra el esquema', () => {
  it('legacy se dice «viejo» y bloques «nuevo»', () => {
    expect(esquemaDelGrupo('legacy').nombre).toBe('viejo')
    expect(esquemaDelGrupo('bloques').nombre).toBe('nuevo')
  })

  it('un valor desconocido cae en «viejo», igual que la regla de negocio', () => {
    // No inventa una tercera etiqueta: usa el mismo default defensivo que
    // modalidadDe, para que la pantalla nunca diga algo distinto de lo que
    // el sistema va a cobrar.
    for (const raro of [null, undefined, '', 'otra-cosa']) {
      expect(esquemaDelGrupo(raro).nombre, String(raro)).toBe(NOMBRE_DEL_ESQUEMA.legacy)
    }
  })

  it('la explicación dice la consecuencia, no el nombre interno', () => {
    expect(porQueImporta('bloques')).toMatch(/PAR de niveles/)
    expect(porQueImporta('legacy')).toMatch(/por aparte/)
  })
})

describe('EST-28 · qué folletos dice el tiquete', () => {
  it('esquema viejo: solo el nivel del grupo', () => {
    const r = folletosDelTiquete({ planCode: 'N1', modalidad: 'legacy', nombres: NOMBRES })
    expect(r.etiqueta).toBe('Nivel 1')
    expect(r.codigos).toEqual(['N1'])
  })

  it('esquema nuevo: el PAR, que es lo que de verdad se imprime', () => {
    // Este es el punto del ítem: el tiquete decía «Nivel 1» en los dos
    // esquemas, y en el nuevo hay que imprimir dos folletos.
    const r = folletosDelTiquete({ planCode: 'N1', modalidad: 'bloques', nombres: NOMBRES })
    expect(r.etiqueta).toBe('Nivel 1 y 2')
    expect(r.codigos).toEqual(['N1', 'N2'])
  })

  it('el par 3+4 también', () => {
    expect(folletosDelTiquete({ planCode: 'N3', modalidad: 'bloques', nombres: NOMBRES }).etiqueta)
      .toBe('Nivel 3 y 4')
  })

  it('la segunda mitad del bloque no pide nada, y lo dice', () => {
    // Un grupo de N2 bajo bloques: su gente ya tiene los dos folletos
    // desde que entró a N1. Dejarlo vacío se leería como un error.
    const r = folletosDelTiquete({ planCode: 'N2', modalidad: 'bloques', nombres: NOMBRES })
    expect(r.codigos).toEqual([])
    expect(r.etiqueta).toBe('No pide folletos')
  })

  it('pero en el esquema viejo un N2 SÍ pide el suyo', () => {
    expect(folletosDelTiquete({ planCode: 'N2', modalidad: 'legacy', nombres: NOMBRES }).etiqueta)
      .toBe('Nivel 2')
  })

  it('discípulos: DIS1 pide los tres en los dos esquemas, y DIS2 no pide nada', () => {
    for (const m of ['legacy', 'bloques']) {
      expect(folletosDelTiquete({ planCode: 'DIS1', modalidad: m, nombres: NOMBRES }).etiqueta,
        m).toBe('Discípulos 1, 2 y 3')
      expect(folletosDelTiquete({ planCode: 'DIS2', modalidad: m, nombres: NOMBRES }).etiqueta,
        m).toBe('No pide folletos')
    }
  })

  it('sin el catálogo de nombres cae al código, no a vacío', () => {
    // Preferible que diga «N1 y N2» a que el tiquete salga en blanco.
    expect(folletosDelTiquete({ planCode: 'N1', modalidad: 'bloques' }).etiqueta).toBe('N1 y N2')
  })

  it('no abrevia cuando los nombres no comparten prefijo', () => {
    const r = folletosDelTiquete({
      planCode: 'N1', modalidad: 'bloques',
      nombres: { N1: 'Nivel 1', N2: 'Bases de la fe' },
    })
    expect(r.etiqueta).toBe('Nivel 1 y Bases de la fe')
  })
})
