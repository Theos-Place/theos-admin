import { describe, it, expect } from 'vitest'
import { ratio, AA_NORMAL } from '../contrast'
import * as P from './paleta'
import { anchoDeEjeCategoria, margenParaEtiquetas } from './paleta'

// Mismo criterio que contrast.test.ts: los ratios se calculan, no se estiman.
// Un color de gráfico que baje del mínimo hace fallar el test en vez de llegar
// a producción como una barra que nadie distingue.

/** WCAG 1.4.11: un elemento gráfico que transmite información necesita 3:1. */
const GRAFICO_MIN = 3

describe('paleta de reportes · rellenos de barra', () => {
  const rellenos: Array<[string, string]> = [
    ['CORAL', P.CORAL],
    ['CORAL_ATENUADO', P.CORAL_ATENUADO],
    ['NAVY', P.NAVY],
    ['TEAL', P.TEAL],
    ['TEAL_CLARO', P.TEAL_CLARO],
    ['GRIS', P.GRIS],
  ]
  for (const [nombre, hex] of rellenos) {
    it(`${nombre} llega a 3:1 contra el blanco de la tarjeta`, () => {
      expect(ratio(hex, P.FONDO_GRAFICO)).toBeGreaterThanOrEqual(GRAFICO_MIN)
    })
  }

  it('el dato parcial se distingue por el BORDE, no por el relleno', () => {
    // El relleno pálido es a propósito (comunica "incompleto") y por eso no
    // llega a 3:1 solo; el borde es el que carga el contraste.
    expect(ratio(P.PARCIAL_RELLENO, P.FONDO_GRAFICO)).toBeLessThan(GRAFICO_MIN)
    expect(ratio(P.PARCIAL_BORDE, P.FONDO_GRAFICO)).toBeGreaterThanOrEqual(GRAFICO_MIN)
  })
})

describe('paleta de reportes · texto', () => {
  const textos: Array<[string, string]> = [
    ['ticks de eje', P.EJE_TICK.fill],
    ['etiqueta de valor', P.ETIQUETA_VALOR.fill],
    ['etiqueta de categoría', P.ETIQUETA_CATEGORIA.fill],
  ]
  for (const [nombre, hex] of textos) {
    it(`${nombre} cumple AA de texto normal`, () => {
      expect(ratio(hex, P.FONDO_GRAFICO)).toBeGreaterThanOrEqual(AA_NORMAL)
    })
  }

  it('ningún texto del gráfico baja de 12px (mínimo del sistema)', () => {
    for (const e of [P.EJE_TICK, P.ETIQUETA_VALOR, P.ETIQUETA_CATEGORIA]) {
      expect(e.fontSize).toBeGreaterThanOrEqual(12)
    }
  })
})

describe('paleta de reportes · series por año', () => {
  it('las tres se distinguen entre sí, no solo del fondo', () => {
    // Si dos series por año quedaran casi iguales, la leyenda sería el único
    // modo de leer el gráfico.
    const [a, b, c] = P.COLORES_POR_ANIO
    expect(ratio(a, b)).toBeGreaterThanOrEqual(1.8)
    expect(ratio(b, c)).toBeGreaterThanOrEqual(1.8)
    expect(ratio(a, c)).toBeGreaterThanOrEqual(1.3)
  })
})

describe('anchoDeEjeCategoria', () => {
  it('crece con el nombre más largo para que quepa en una línea', () => {
    expect(anchoDeEjeCategoria(['Cartago'])).toBeLessThan(anchoDeEjeCategoria(['Pedregal Miércoles Youth']))
  })

  it('le da su línea completa al nombre de sede más largo que hay hoy', () => {
    // 24 caracteres. Con el ancho fijo viejo (110px) se partía en dos renglones.
    expect(anchoDeEjeCategoria(['Pedregal Miércoles Youth'])).toBeGreaterThan(110)
  })

  it('no deja que un nombre disparatado se coma el gráfico', () => {
    expect(anchoDeEjeCategoria(['x'.repeat(200)])).toBe(190)
  })

  it('sin etiquetas devuelve el mínimo, no cero', () => {
    expect(anchoDeEjeCategoria([])).toBe(90)
  })
})

describe('margenParaEtiquetas', () => {
  it('reserva más espacio cuando los números son más largos', () => {
    expect(margenParaEtiquetas([41522])).toBeGreaterThan(margenParaEtiquetas([7]))
  })

  it('cuenta el separador de miles, no solo los dígitos', () => {
    // 41.522 ocupa 6 caracteres en pantalla, no 5.
    expect(margenParaEtiquetas([41522])).toBe(Math.round((41522).toLocaleString('es-CR').length * 7.5) + 14)
  })
})
