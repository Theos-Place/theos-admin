import { describe, it, expect } from 'vitest'
import { resumenPagos } from './folleto-pagos'

describe('resumenPagos', () => {
  it('sin pagos enlazados es "sin cobro", no "0 pagados"', () => {
    // DIS2/DIS3 cuestan ₡0: el folleto se pagó al matricularse en DIS1.
    expect(resumenPagos({ total: 0, pagados: 0 })).toEqual({ texto: 'Sin cobro', tono: 'ninguno' })
    expect(resumenPagos(undefined)).toEqual({ texto: 'Sin cobro', tono: 'ninguno' })
  })

  it('todos pagados', () => {
    expect(resumenPagos({ total: 8, pagados: 8 })).toEqual({ texto: 'Pagado · 8/8', tono: 'listo' })
  })

  it('faltan pagos', () => {
    expect(resumenPagos({ total: 8, pagados: 3 })).toEqual({ texto: '3 de 8 pagados', tono: 'parcial' })
  })

  it('nunca reporta más pagados que el total', () => {
    expect(resumenPagos({ total: 2, pagados: 5 }).texto).toBe('Pagado · 2/2')
  })
})
