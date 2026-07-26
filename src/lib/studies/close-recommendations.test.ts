import { describe, it, expect } from 'vitest'
import { allowsCloseRecommendations } from './close-recommendations'

describe('allowsCloseRecommendations (EST-3)', () => {
  it('rechaza N1–N3', () => {
    for (const code of ['N1', 'N2', 'N3']) {
      expect(allowsCloseRecommendations(code)).toBe(false)
    }
  })

  it('acepta N4 y posteriores', () => {
    expect(allowsCloseRecommendations('N4')).toBe(true)
    expect(allowsCloseRecommendations('N5')).toBe(true)
  })

  it('acepta capacitaciones DIS1–DIS3', () => {
    for (const code of ['DIS1', 'DIS2', 'DIS3']) {
      expect(allowsCloseRecommendations(code)).toBe(true)
    }
  })

  it('rechaza el resto de planes y vacíos', () => {
    for (const code of ['SCJ', 'PREMAT', 'CAMP1', '', null, undefined]) {
      expect(allowsCloseRecommendations(code)).toBe(false)
    }
  })
})
