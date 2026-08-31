import { describe, it, expect } from 'vitest'
import { muestraDeudaDeMatricula } from './study-debt-visible'

const base = { rawStatus: 'enrolled', requiresPayment: true, groupStatus: 'en_curso', paymentsCount: 1 }

describe('muestraDeudaDeMatricula', () => {
  it('con un cobro real, se pide', () => {
    expect(muestraDeudaDeMatricula(base)).toBe(true)
    expect(muestraDeudaDeMatricula({ ...base, groupStatus: 'en_matricula' })).toBe(true)
  })

  it('SIN cobro no se inventa deuda, aunque el plan tenga costo', () => {
    // El caso reportado: 521 participantes de grupos en curso, importados de
    // PCO, a los que nunca se les generó un cobro. ₡2.790.000 que no existen.
    expect(muestraDeudaDeMatricula({ ...base, paymentsCount: 0 })).toBe(false)
  })

  it('quien se matricula hoy y no paga SÍ la ve', () => {
    // Desde 2026-08-04 la matrícula con costo crea su fila al inscribirse, así
    // que este caso llega acá con paymentsCount 1. Es la mitad que NO se toca.
    expect(muestraDeudaDeMatricula({ ...base, groupStatus: 'en_matricula', paymentsCount: 1 })).toBe(true)
  })

  it('de un grupo cerrado no se cobra, ni con cobro colgando', () => {
    expect(muestraDeudaDeMatricula({ ...base, groupStatus: 'finalizado' })).toBe(false)
  })

  it('plan sin costo, nunca', () => {
    expect(muestraDeudaDeMatricula({ ...base, requiresPayment: false })).toBe(false)
  })

  it('matrícula que ya no está viva, nunca', () => {
    for (const rawStatus of ['completed', 'dropped', 'reprobado', 'en_revision', 'transferred']) {
      expect(muestraDeudaDeMatricula({ ...base, rawStatus }), rawStatus).toBe(false)
    }
  })
})
