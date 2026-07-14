import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ymdCR, toYmdLocal, calcAge } from './format'

describe('ymdCR', () => {
  it('un instante de madrugada UTC es el día ANTERIOR en CR (UTC-6)', () => {
    // 2026-07-14 01:30Z = 2026-07-13 19:30 en CR
    expect(ymdCR(new Date('2026-07-14T01:30:00Z'))).toBe('2026-07-13')
  })
  it('mediodía UTC es el mismo día en CR', () => {
    expect(ymdCR(new Date('2026-07-14T12:00:00Z'))).toBe('2026-07-14')
  })
  it('frontera exacta: 06:00Z es medianoche CR (ya es el día UTC)', () => {
    expect(ymdCR(new Date('2026-07-14T06:00:00Z'))).toBe('2026-07-14')
    expect(ymdCR(new Date('2026-07-14T05:59:59Z'))).toBe('2026-07-13')
  })
})

describe('toYmdLocal', () => {
  it('usa componentes locales del runtime (no UTC)', () => {
    const d = new Date(2026, 6, 14, 23, 59) // 14 jul local, independiente de TZ
    expect(toYmdLocal(d)).toBe('2026-07-14')
  })
})

describe('calcAge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 13)) // 13 de julio de 2026, hora local
  })
  afterEach(() => vi.useRealTimers())

  it('cumpleaños ya pasado este año', () => {
    expect(calcAge('1990-05-15')).toBe(36)
  })
  it('cumpleaños todavía no llega', () => {
    expect(calcAge('1990-12-01')).toBe(35)
  })
  it('cumpleaños HOY cuenta como cumplido', () => {
    expect(calcAge('1990-07-13')).toBe(36)
  })
  it('fecha pura YYYY-MM-DD no retrocede un día por parseo UTC', () => {
    // new Date('1990-07-14') sería medianoche UTC = 13 jul en CR; el parseo
    // flexible debe tratarla como local y NO regalar un año.
    expect(calcAge('1990-07-14')).toBe(35)
  })
  it('null/undefined/inválida → 0', () => {
    expect(calcAge(null)).toBe(0)
    expect(calcAge(undefined)).toBe(0)
    expect(calcAge('no-es-fecha')).toBe(0)
  })
})
