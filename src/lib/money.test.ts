// INT-3 · Totales por moneda y formato con decimales.
import { describe, it, expect } from 'vitest'
import {
  sumByCurrency, addTotals, totalsEntries, formatTotals, formatTotalsInline,
  isSingleCurrency, totalIn, mainCurrency, totalsFromJson, toCurrency,
  currenciesMatch, currencyMismatchMessage,
} from './money'
import { formatMoney, currencyDecimals, amountStep } from './format'

// es-CR separa los miles con espacio DURO (U+00A0), no con un espacio normal.
const nbsp = (s: string) => s.replace(/ /g, '\u00a0')

describe('formato por moneda', () => {
  it('EL BUG: el euro lleva céntimos y antes se comía el cero', () => {
    expect(formatMoney(25.5, 'EUR')).toBe('€25,50')
    expect(formatMoney(1234.5, 'USD')).toBe(nbsp('$1 234,50'))
  })

  it('el colón no lleva decimales', () => {
    expect(formatMoney(50000, 'CRC')).toBe(nbsp('₡50 000'))
    expect(formatMoney(25.5, 'CRC')).toBe('₡26')
  })

  it('sin moneda asume colones: todo lo histórico es en colones', () => {
    expect(formatMoney(50000)).toBe(nbsp('₡50 000'))
    expect(formatMoney(50000, null)).toBe(nbsp('₡50 000'))
  })

  it('una moneda desconocida no se disfraza de colones', () => {
    expect(formatMoney(100, 'GBP')).toBe('GBP 100,00')
  })

  it('los inputs dejan escribir céntimos solo donde los hay', () => {
    expect(currencyDecimals('CRC')).toBe(0)
    expect(currencyDecimals('EUR')).toBe(2)
    expect(amountStep('CRC')).toBe('1')
    expect(amountStep('EUR')).toBe('0.01')
  })
})

describe('sumar SIN mezclar monedas', () => {
  const filas = [
    { amount: 1000, currency: 'CRC' },
    { amount: 250, currency: 'CRC' },
    { amount: 40, currency: 'EUR' },
  ]

  it('la regla de oro: cada moneda por su lado', () => {
    expect(sumByCurrency(filas)).toEqual({ CRC: 1250, EUR: 40 })
  })

  it('sin moneda cuenta como colones, no se descarta', () => {
    expect(sumByCurrency([{ amount: 500, currency: null }, { amount: 100 }])).toEqual({ CRC: 600 })
  })

  it('los numeric de Postgres llegan como string y suman igual', () => {
    expect(sumByCurrency([{ amount: '1000.50', currency: 'EUR' }, { amount: '0.50', currency: 'EUR' }]))
      .toEqual({ EUR: 1001 })
  })

  it('basura no envenena el total', () => {
    expect(sumByCurrency([{ amount: null }, { amount: 'x' }, { amount: 10 }])).toEqual({ CRC: 10 })
  })

  it('una moneda inventada cae a colones y no crea una columna fantasma', () => {
    expect(toCurrency('gbp')).toBe('CRC')
    expect(toCurrency('eur')).toBe('EUR')
  })

  it('juntar fuentes distintas tampoco mezcla', () => {
    expect(addTotals({ CRC: 100, EUR: 5 }, { CRC: 50 }, {})).toEqual({ CRC: 150, EUR: 5 })
  })
})

describe('cómo se muestra', () => {
  it('el orden es fijo, no el de llegada de las filas', () => {
    const t = sumByCurrency([{ amount: 1, currency: 'EUR' }, { amount: 2, currency: 'CRC' }])
    expect(totalsEntries(t).map(([c]) => c)).toEqual(['CRC', 'EUR'])
  })

  it('una moneda sin movimientos NO se muestra en cero', () => {
    // Si todo es CRC, la tarjeta muestra una línea, no tres.
    expect(formatTotals({ CRC: 1250 })).toEqual([nbsp('₡1 250')])
    expect(isSingleCurrency({ CRC: 1250 })).toBe(true)
  })

  it('con dos monedas, dos líneas', () => {
    expect(formatTotals({ CRC: 1250000, EUR: 340 })).toEqual([nbsp('₡1 250 000'), '€340,00'])
    expect(formatTotalsInline({ CRC: 1250000, EUR: 340 })).toBe(nbsp('₡1 250 000') + ' · €340,00')
    expect(isSingleCurrency({ CRC: 1, EUR: 2 })).toBe(false)
  })

  it('sin nada, "₡0" — una tarjeta vacía no se deja en blanco', () => {
    expect(formatTotals({})).toEqual(['₡0'])
  })

  it('para un gráfico de una serie: el escalar se PIDE con su moneda', () => {
    const t = { CRC: 1000, EUR: 40 }
    expect(totalIn(t, 'EUR')).toBe(40)
    expect(totalIn(t, 'USD')).toBe(0)
    // Con una sola moneda el gráfico se etiqueta con ella; con varias, colones.
    expect(mainCurrency({ EUR: 40 })).toBe('EUR')
    expect(mainCurrency(t)).toBe('CRC')
  })
})

describe('lo que devuelven los RPC', () => {
  it('los numeric del json vienen como string', () => {
    expect(totalsFromJson({ CRC: '1250000.00', EUR: '340' })).toEqual({ CRC: 1250000, EUR: 340 })
  })

  it('un json vacío o nulo no rompe la pantalla', () => {
    expect(totalsFromJson(null)).toEqual({})
    expect(totalsFromJson({})).toEqual({})
    expect(totalsFromJson('nada')).toEqual({})
  })
})

describe('becas y devoluciones entre monedas', () => {
  it('una beca en colones NO se aplica a un cobro en euros', () => {
    expect(currenciesMatch('CRC', 'EUR')).toBe(false)
    expect(currenciesMatch('CRC', null)).toBe(true)   // sin moneda = colones
  })

  it('el mensaje se dice en palabras, no en códigos', () => {
    expect(currencyMismatchMessage('CRC', 'EUR'))
      .toBe('Esta beca es en colones y el cobro es en euros.')
    expect(currencyMismatchMessage('EUR', 'CRC', 'Este cupón'))
      .toBe('Este cupón es en euros y el cobro es en colones.')
  })
})
