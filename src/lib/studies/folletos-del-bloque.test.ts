import { describe, it, expect } from 'vitest'
import {
  expandirAFolletos, totalDeFolletos, folletosPorSede, codigosDeFolleto,
  type MatriculadosPorGrupo,
} from './folletos-del-bloque'

const NOMBRES: Record<string, string> = {
  N1: 'Nivel 1', N2: 'Nivel 2', N3: 'Nivel 3', N4: 'Nivel 4', DIS1: 'Discípulos 1',
}
const nombre = (c: string) => NOMBRES[c]
const grupo = (over: Partial<MatriculadosPorGrupo>): MatriculadosPorGrupo => ({
  sede: 'Sede Cartago', grupo: 'Lunes 7pm', nivel_code: 'N1', nivel: 'Nivel 1',
  dirigente: 'Ana', cantidad: 10, modalidad: 'bloques', ...over,
})

describe('un grupo de N1 pide los DOS folletos, en líneas separadas', () => {
  const filas = expandirAFolletos([grupo({})], nombre)

  it('salen dos líneas, no una', () => {
    expect(filas).toHaveLength(2)
    expect(filas.map(f => f.folleto_code)).toEqual(['N1', 'N2'])
  })

  it('cada una con su nombre y con los 10 estudiantes', () => {
    expect(filas.map(f => `${f.folleto}: ${f.cantidad}`)).toEqual(['Nivel 1: 10', 'Nivel 2: 10'])
  })

  it('y el total son 20 folletos, no 10 personas', () => {
    // El bug exacto: se imprimía la mitad.
    expect(totalDeFolletos(filas)).toBe(20)
  })

  it('conserva grupo, sede y dirigente en las dos', () => {
    for (const f of filas) {
      expect(f.grupo).toBe('Lunes 7pm')
      expect(f.sede).toBe('Sede Cartago')
      expect(f.dirigente).toBe('Ana')
    }
  })
})

describe('un grupo de N2 NO pide folletos', () => {
  it('no sale en el reporte', () => {
    // Ya se los llevó al matricular N1. Contarlo otra vez era el conteo de
    // MÁS, el otro lado del mismo desfase.
    expect(expandirAFolletos([grupo({ nivel_code: 'N2', nivel: 'Nivel 2' })], nombre)).toEqual([])
  })
})

describe('N3 se comporta como N1', () => {
  it('pide el 3 y el 4', () => {
    const filas = expandirAFolletos([grupo({ nivel_code: 'N3', nivel: 'Nivel 3', cantidad: 7 })], nombre)
    expect(filas.map(f => f.folleto)).toEqual(['Nivel 3', 'Nivel 4'])
    expect(totalDeFolletos(filas)).toBe(14)
  })

  it('y N4 no pide nada', () => {
    expect(expandirAFolletos([grupo({ nivel_code: 'N4', nivel: 'Nivel 4' })], nombre)).toEqual([])
  })
})

describe('lo que NO está en un bloque sigue igual', () => {
  it('discípulos pide su propio folleto, uno por persona', () => {
    // El cebo caro de EST-14: si esto devolviera [], las capacitaciones se
    // quedarían sin folletos en silencio.
    const filas = expandirAFolletos([grupo({ nivel_code: 'DIS1', nivel: 'Discípulos 1', cantidad: 12 })], nombre)
    expect(filas).toHaveLength(1)
    expect(filas[0].folleto).toBe('Discípulos 1')
    expect(totalDeFolletos(filas)).toBe(12)
  })
})

describe('el desglose por sede suma folletos, no personas', () => {
  const filas = expandirAFolletos([
    grupo({ sede: 'Sede Cartago', cantidad: 10 }),                              // N1 → 20
    grupo({ sede: 'Sede Liberia', grupo: 'Martes', nivel_code: 'N3', nivel: 'Nivel 3', cantidad: 4 }), // → 8
    grupo({ sede: 'Sede Liberia', grupo: 'Jueves', nivel_code: 'N2', nivel: 'Nivel 2', cantidad: 9 }), // → 0
  ], nombre)

  it('cuenta bien y ordena de mayor a menor', () => {
    expect(folletosPorSede(filas)).toEqual([
      { sede: 'Sede Cartago', cantidad: 20 },
      { sede: 'Sede Liberia', cantidad: 8 },
    ])
  })

  it('el total coincide con la suma de las sedes', () => {
    expect(totalDeFolletos(filas)).toBe(28)
  })
})

describe('los nombres', () => {
  it('pide los códigos de los DOS folletos, no solo el del grupo', () => {
    // El del par no viene en la fila: hay que buscarlo aparte.
    expect(codigosDeFolleto([grupo({})]).sort()).toEqual(['N1', 'N2'])
  })

  it('sin nombre muestra el código y no un vacío', () => {
    const filas = expandirAFolletos([grupo({})], () => undefined)
    expect(filas.map(f => f.folleto)).toEqual(['Nivel 1', 'N2'])
  })
})

describe('la etiqueta de la orden', () => {
  it('nombra los dos folletos del par', async () => {
    const { etiquetaDeFolletos } = await import('./folletos')
    expect(etiquetaDeFolletos('N1', 'bloques')).toBe('Nivel 1 y Nivel 2')
    expect(etiquetaDeFolletos('N3', 'bloques')).toBe('Nivel 3 y Nivel 4')
  })

  it('un nivel que ya los tiene no nombra ninguno', async () => {
    const { etiquetaDeFolletos } = await import('./folletos')
    expect(etiquetaDeFolletos('N2', 'bloques')).toBe('')
    expect(etiquetaDeFolletos('N4', 'bloques')).toBe('')
  })

  it('lo que no es par se nombra solo', async () => {
    const { etiquetaDeFolletos } = await import('./folletos')
    expect(etiquetaDeFolletos('DIS1', 'bloques')).toBe('Discípulos 1')
    expect(etiquetaDeFolletos('PREMAT', 'bloques')).toBe('Prematrimonial')
  })

  it('se deriva, no se escribe a mano', async () => {
    // Si alguien la escribe como un literal, deja de seguir a
    // `folletosQuePide` y el día que cambie el par dirá otra cosa que el
    // cobro y que el conteo de impresión.
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/lib/studies/folletos.ts', 'utf8')
    expect(src).toContain('folletosQuePide(planCode, modalidad)')
    expect(src).not.toContain("'Nivel 1 y Nivel 2'")
  })
})
