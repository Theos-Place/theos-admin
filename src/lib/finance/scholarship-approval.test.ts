import { describe, it, expect } from 'vitest'
import { previewApproval } from './scholarship-approval'

describe('previewApproval', () => {
  // El caso que pide la spec: el 50% calcula bien el residual.
  it('50% deja la mitad por pagar y es PARCIAL', () => {
    const p = previewApproval({ cost: 15000, currency: 'CRC', discountType: 'percentage', discountValue: 50 })
    expect(p.error).toBeNull()
    expect(p.breakdown!.discount).toBe(7500)
    expect(p.breakdown!.final).toBe(7500)
    expect(p.approval_type).toBe('parcial')
  })

  it('100% cubre todo y es TOTAL', () => {
    const p = previewApproval({ cost: 15000, currency: 'CRC', discountType: 'percentage', discountValue: 100 })
    expect(p.breakdown!.final).toBe(0)
    expect(p.breakdown!.covered).toBe(true)
    expect(p.approval_type).toBe('total')
  })

  it('un porcentaje libre también funciona', () => {
    const p = previewApproval({ cost: 20000, currency: 'CRC', discountType: 'percentage', discountValue: 35 })
    expect(p.breakdown!.discount).toBe(7000)
    expect(p.breakdown!.final).toBe(13000)
    expect(p.approval_type).toBe('parcial')
  })

  it('monto fijo: residual y tipo derivado', () => {
    const p = previewApproval({ cost: 15000, currency: 'CRC', discountType: 'fixed', discountValue: 5000 })
    expect(p.breakdown!.final).toBe(10000)
    expect(p.approval_type).toBe('parcial')
    expect(p.error).toBeNull()
  })

  // El tipo se DERIVA: un monto fijo igual al costo es total, aunque no sea 100%.
  it('un monto fijo que cubre el costo entero queda como TOTAL', () => {
    const p = previewApproval({ cost: 15000, currency: 'CRC', discountType: 'fixed', discountValue: 15000 })
    expect(p.breakdown!.final).toBe(0)
    expect(p.approval_type).toBe('total')
  })

  it('avisa si el monto fijo supera el costo (típico cero de más)', () => {
    const p = previewApproval({ cost: 15000, currency: 'CRC', discountType: 'fixed', discountValue: 150000 })
    expect(p.error).toBe('monto_mayor_al_costo')
    expect(p.breakdown!.final).toBe(0)
    expect(p.approval_type).toBe('total')
  })

  it('rechaza valores inválidos', () => {
    expect(previewApproval({ cost: 15000, discountType: 'percentage', discountValue: 0 }).error).toBe('valor_invalido')
    expect(previewApproval({ cost: 15000, discountType: 'percentage', discountValue: -10 }).error).toBe('valor_invalido')
    expect(previewApproval({ cost: 15000, discountType: 'percentage', discountValue: 'abc' }).error).toBe('valor_invalido')
  })

  it('rechaza un porcentaje mayor a 100', () => {
    expect(previewApproval({ cost: 15000, discountType: 'percentage', discountValue: 120 }).error)
      .toBe('porcentaje_fuera_de_rango')
  })

  it('sin costo conocido no hay vista previa, pero el 100% sigue siendo total', () => {
    const sinCosto = previewApproval({ cost: null, discountType: 'percentage', discountValue: 100 })
    expect(sinCosto.error).toBe('sin_costo')
    expect(sinCosto.breakdown).toBeNull()
    expect(sinCosto.approval_type).toBe('total')

    const parcial = previewApproval({ cost: 0, discountType: 'percentage', discountValue: 50 })
    expect(parcial.approval_type).toBe('parcial')
  })

  it('acepta el valor como string (viene de un input)', () => {
    const p = previewApproval({ cost: 15000, currency: 'CRC', discountType: 'percentage', discountValue: '50' })
    expect(p.breakdown!.final).toBe(7500)
  })

  it('respeta los céntimos en otras monedas', () => {
    const p = previewApproval({ cost: 25.5, currency: 'EUR', discountType: 'percentage', discountValue: 10 })
    expect(p.breakdown!.final).toBe(22.95)
  })
})
