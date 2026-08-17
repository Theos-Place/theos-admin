import { describe, it, expect } from 'vitest'
import { shouldCreateAutoFolleto, hasOwnFolleto } from './folleto-auto-rules'

describe('folleto-auto-rules (FOL-1)', () => {
  it('cupo_lleno: genera al llegar al cupo (o pasarlo), no antes ni sin cupo definido', () => {
    expect(shouldCreateAutoFolleto('cupo_lleno', { enrolled: 12, max_students: 12 })).toBe(true)
    expect(shouldCreateAutoFolleto('cupo_lleno', { enrolled: 13, max_students: 12 })).toBe(true)
    expect(shouldCreateAutoFolleto('cupo_lleno', { enrolled: 11, max_students: 12 })).toBe(false)
    expect(shouldCreateAutoFolleto('cupo_lleno', { enrolled: 50, max_students: null })).toBe(false)
  })

  it('fin_matricula: con 4 no genera, con 5 sí', () => {
    expect(shouldCreateAutoFolleto('fin_matricula', { enrolled: 4, max_students: null })).toBe(false)
    expect(shouldCreateAutoFolleto('fin_matricula', { enrolled: 5, max_students: null })).toBe(true)
  })

  it('solo planes con folleto propio (cadenas N y DIS)', () => {
    for (const c of ['N1', 'N4', 'DIS1', 'DIS3', 'PREMAT']) expect(hasOwnFolleto(c)).toBe(true)
    for (const c of ['SCJ', 'CDEB', 'BUS', null]) expect(hasOwnFolleto(c)).toBe(false)
  })
})
