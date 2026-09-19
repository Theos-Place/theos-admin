import { describe, it, expect } from 'vitest'
import { planDeCargaCompleta, TAMANO_DE_TANDA, TOPE_DE_CARGA_COMPLETA } from './carga-completa'

describe('planDeCargaCompleta', () => {
  it('no hace nada si ya está todo cargado', () => {
    expect(planDeCargaCompleta(50, 50)).toEqual({ puede: false, motivo: 'completo', faltan: 0 })
  })

  it('tampoco si lo cargado supera al total (el total se movió)', () => {
    expect(planDeCargaCompleta(60, 50).puede).toBe(false)
  })

  it('relee desde la página 1, no desde donde iba la paginación', () => {
    const plan = planDeCargaCompleta(50, 300)
    expect(plan).toMatchObject({ puede: true, faltan: 250, tamano: TAMANO_DE_TANDA })
    if (plan.puede) expect(plan.paginas).toEqual([1, 2])
  })

  it('una sola tanda cuando el total cabe en ella', () => {
    const plan = planDeCargaCompleta(50, 200)
    if (!plan.puede) throw new Error('debería poder')
    expect(plan.paginas).toEqual([1])
  })

  it('redondea hacia arriba la última tanda incompleta', () => {
    const plan = planDeCargaCompleta(50, 401)
    if (!plan.puede) throw new Error('debería poder')
    expect(plan.paginas).toEqual([1, 2, 3])
  })

  it('se niega por encima del tope: eso es trabajo de Exportar', () => {
    const plan = planDeCargaCompleta(50, TOPE_DE_CARGA_COMPLETA + 1)
    expect(plan).toEqual({ puede: false, motivo: 'demasiados', faltan: TOPE_DE_CARGA_COMPLETA + 1 - 50 })
  })

  it('el tope justo todavía se puede', () => {
    expect(planDeCargaCompleta(50, TOPE_DE_CARGA_COMPLETA).puede).toBe(true)
  })
})
