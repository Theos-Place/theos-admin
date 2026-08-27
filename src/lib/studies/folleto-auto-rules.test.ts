/**
 * Cuándo se pide folleto automáticamente.
 *
 * El caso que faltaba y por el que había CERO tiquetes en producción: el grupo
 * que crea la auto-matrícula al cerrar nace con max_students null y sin ventana
 * de matrícula, así que las dos reglas de FOL-1 no pueden dispararse NUNCA para
 * él. Los tests de abajo fijan justamente eso.
 */
import { describe, it, expect } from 'vitest'
import { shouldCreateAutoFolleto, hasOwnFolleto, FIN_MATRICULA_MIN_ENROLLED } from './folleto-auto-rules'

describe('el grupo sucesor de un cierre', () => {
  // Tal como lo crea findOrCreateSuccessorGroup: sin cupo definido.
  const sucesor = { enrolled: 4, max_students: null }

  it("'cupo_lleno' NO se puede disparar sin cupo definido", () => {
    expect(shouldCreateAutoFolleto('cupo_lleno', sucesor)).toBe(false)
  })

  it("'fin_matricula' tampoco: 4 no llega al mínimo de 5", () => {
    expect(shouldCreateAutoFolleto('fin_matricula', sucesor)).toBe(false)
    expect(FIN_MATRICULA_MIN_ENROLLED).toBe(5)
  })

  it("'cierre' SÍ: es la única regla que lo cubre", () => {
    expect(shouldCreateAutoFolleto('cierre', sucesor)).toBe(true)
  })

  it("'cierre' no pide umbral: con 1 persona también", () => {
    // Quien aprobó necesita su folleto, sean 2 o 20. El mínimo de 5 existe para
    // no pedir folletos de un grupo que quizá no arranca; acá ya arrancó.
    expect(shouldCreateAutoFolleto('cierre', { enrolled: 1, max_students: null })).toBe(true)
  })

  it("'cierre' con nadie que pasó: no pide nada", () => {
    expect(shouldCreateAutoFolleto('cierre', { enrolled: 0, max_students: null })).toBe(false)
  })
})

describe('las reglas que ya existían siguen igual', () => {
  it('cupo lleno cuando se alcanza el cupo', () => {
    expect(shouldCreateAutoFolleto('cupo_lleno', { enrolled: 20, max_students: 20 })).toBe(true)
    expect(shouldCreateAutoFolleto('cupo_lleno', { enrolled: 19, max_students: 20 })).toBe(false)
  })
  it('fin de matrícula desde 5', () => {
    expect(shouldCreateAutoFolleto('fin_matricula', { enrolled: 5, max_students: 20 })).toBe(true)
    expect(shouldCreateAutoFolleto('fin_matricula', { enrolled: 4, max_students: 20 })).toBe(false)
  })
})

describe('qué planes llevan folleto propio', () => {
  it('niveles, discípulos y prematrimonial', () => {
    for (const c of ['N1', 'N2', 'N3', 'N4', 'DIS1', 'DIS2', 'DIS3', 'PREMAT']) {
      expect(hasOwnFolleto(c), c).toBe(true)
    }
  })
  it('los demás no', () => {
    for (const c of ['HER', 'DLF', 'PAN', 'SCJ', null, undefined, '']) {
      expect(hasOwnFolleto(c), String(c)).toBe(false)
    }
  })
})
