import { describe, it, expect } from 'vitest'
import {
  necesitaAprobacionPropia, validarAprobacion, textoDelDescuento, avisoDeIncoherencia,
} from './aprobacion-de-beca'

describe('qué solicitudes no se cierran con el "Resolver" genérico', () => {
  it('las de beca sí, porque aprobar exige decir el descuento', () => {
    expect(necesitaAprobacionPropia('scholarship')).toBe(true)
  })

  it('las demás siguen igual', () => {
    for (const t of ['refund', 'other', '', null, undefined]) {
      expect(necesitaAprobacionPropia(t), String(t)).toBe(false)
    }
  })
})

describe('validar la aprobación', () => {
  const ok = { discount_type: 'percentage', discount_value: 100, approval_type: 'total' }

  it('pasa con los tres datos', () => {
    expect(validarAprobacion(ok)).toEqual({ ok: true, datos: ok })
  })

  // El bug fue justamente que el sistema dejaba seguir SIN nada de esto.
  it('sin nada, dice qué falta', () => {
    const r = validarAprobacion({})
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toMatch(/porcentaje o un monto fijo/)
  })

  it('rechaza un descuento de cero o negativo', () => {
    for (const v of [0, -5, NaN, 'hola']) {
      const r = validarAprobacion({ ...ok, discount_value: v })
      expect(r.ok, String(v)).toBe(false)
    }
  })

  it('un porcentaje no pasa de 100', () => {
    const r = validarAprobacion({ ...ok, discount_value: 120 })
    expect(r.ok === false && r.error).toMatch(/no puede pasar de 100/)
  })

  // Un monto fijo sí puede ser grande: hay estudios de varios miles.
  it('un monto fijo grande es válido', () => {
    expect(validarAprobacion({ ...ok, discount_type: 'fixed', discount_value: 45000 }).ok).toBe(true)
  })

  it('exige marcar total o parcial', () => {
    const r = validarAprobacion({ ...ok, approval_type: undefined })
    expect(r.ok === false && r.error).toMatch(/total o solo una parte/)
  })
})

describe('cómo se lee el descuento', () => {
  it('porcentaje', () => {
    expect(textoDelDescuento({ discount_type: 'percentage', discount_value: 100, approval_type: 'total' })).toBe('100%')
  })

  it('monto en colones', () => {
    expect(textoDelDescuento({ discount_type: 'fixed', discount_value: 15000, approval_type: 'parcial' })).toBe('₡15.000')
  })

  it('monto en dólares', () => {
    expect(textoDelDescuento({ discount_type: 'fixed', discount_value: 50, approval_type: 'parcial' }, 'USD')).toBe('$50')
  })
})

describe('aviso de incoherencia', () => {
  it('100% marcado como parcial avisa: el correo le pediría plata que no debe', () => {
    expect(avisoDeIncoherencia({ discount_type: 'percentage', discount_value: 100, approval_type: 'parcial' }))
      .toMatch(/no debe nada/)
  })

  it('menos de 100% marcado como total avisa', () => {
    expect(avisoDeIncoherencia({ discount_type: 'percentage', discount_value: 50, approval_type: 'total' }))
      .toMatch(/no le va a decir cuánto le queda/)
  })

  it('lo coherente no avisa', () => {
    expect(avisoDeIncoherencia({ discount_type: 'percentage', discount_value: 100, approval_type: 'total' })).toBeNull()
    expect(avisoDeIncoherencia({ discount_type: 'percentage', discount_value: 50, approval_type: 'parcial' })).toBeNull()
  })

  // Un fijo no se puede juzgar sin saber el costo del estudio.
  it('un monto fijo nunca avisa', () => {
    expect(avisoDeIncoherencia({ discount_type: 'fixed', discount_value: 20000, approval_type: 'total' })).toBeNull()
  })
})
