import { describe, it, expect } from 'vitest'
import { resolveOnBehalf, recordedByLabel, FORM_ON_BEHALF_ROLES } from './on-behalf'
import type { AuthContext } from '@/lib/auth/guard'

const ctx = (roles: string[], memberId: string | null = 'yo'): AuthContext =>
  ({ roles, memberId } as unknown as AuthContext)

describe('resolveOnBehalf', () => {
  // El caso normal: nadie está actuando por nadie, y no se ensucia la fila.
  it('sin pedir a otro, no deja rastro', () => {
    const r = resolveOnBehalf(ctx(['comunicaciones']), undefined, FORM_ON_BEHALF_ROLES)
    expect(r).toEqual({ memberId: 'yo', recordedBy: null, esPorOtro: false })
  })

  it('con rol y pidiendo a otro, deja el rastro', () => {
    const r = resolveOnBehalf(ctx(['comunicaciones']), 'otra-persona', FORM_ON_BEHALF_ROLES)
    expect(r).toEqual({ memberId: 'otra-persona', recordedBy: 'yo', esPorOtro: true })
  })

  // Anti-suplantación: sin el rol, pedir a otro no hace nada.
  it('sin rol, el pedido se ignora y queda el propio', () => {
    const r = resolveOnBehalf(ctx(['miembro']), 'otra-persona', FORM_ON_BEHALF_ROLES)
    expect(r).toEqual({ memberId: 'yo', recordedBy: null, esPorOtro: false })
  })

  it('admin siempre puede', () => {
    const r = resolveOnBehalf(ctx(['admin']), 'otra-persona', FORM_ON_BEHALF_ROLES)
    expect(r.esPorOtro).toBe(true)
    expect(r.recordedBy).toBe('yo')
  })

  // Pedirse a uno mismo NO es actuar por otro: si no, cada envío del staff
  // quedaría marcado como "registrado por el staff" sin razón.
  it('pedirse a sí mismo no deja rastro', () => {
    const r = resolveOnBehalf(ctx(['comunicaciones']), 'yo', FORM_ON_BEHALF_ROLES)
    expect(r).toEqual({ memberId: 'yo', recordedBy: null, esPorOtro: false })
  })

  it('un pedido vacío se trata como no pedido', () => {
    for (const v of ['', null, undefined, 42, {}]) {
      const r = resolveOnBehalf(ctx(['comunicaciones']), v, FORM_ON_BEHALF_ROLES)
      expect(r.memberId).toBe('yo')
      expect(r.recordedBy).toBeNull()
    }
  })

  it('una sesión sin perfil de miembro no queda como quien digitó', () => {
    const r = resolveOnBehalf(ctx(['admin'], null), 'otra-persona', FORM_ON_BEHALF_ROLES)
    expect(r.memberId).toBe('otra-persona')
    expect(r.recordedBy).toBeNull()
    // esPorOtro sigue siendo true: la fila es de otro, solo no se sabe de quién
    // es la mano. Mejor eso que inventar un autor.
    expect(r.esPorOtro).toBe(true)
  })
})

describe('recordedByLabel', () => {
  it('nombra a quien la digitó', () => {
    expect(recordedByLabel('Floriana Fonseca')).toBe('Registrada por Floriana Fonseca')
  })

  it('sin nombre no queda una frase colgando', () => {
    for (const v of [null, undefined, '', '   ']) {
      expect(recordedByLabel(v)).toBe('Registrada por el staff')
    }
  })
})

describe('quién puede llenar por otro', () => {
  it('incluye el rol forms, que la ficha pedía sumar', () => {
    expect(FORM_ON_BEHALF_ROLES).toContain('forms')
  })

  it('no incluye al miembro ni a solo_lectura', () => {
    expect(FORM_ON_BEHALF_ROLES).not.toContain('miembro')
    expect(FORM_ON_BEHALF_ROLES).not.toContain('solo_lectura')
  })
})
