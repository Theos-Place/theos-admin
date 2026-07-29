import { describe, it, expect } from 'vitest'
import { checkCoupleGender, missingGenderMessage } from './premat-gender'

describe('checkCoupleGender (PRE-7)', () => {
  it('hombre + mujer → ok (en ambos órdenes y sin importar mayúsculas)', () => {
    expect(checkCoupleGender('M', 'F')).toEqual({ ok: true })
    expect(checkCoupleGender('F', 'M')).toEqual({ ok: true })
    expect(checkCoupleGender('f', 'm')).toEqual({ ok: true })
  })

  it('mismo género → mismo_genero (409)', () => {
    expect(checkCoupleGender('M', 'M')).toEqual({ ok: false, code: 'mismo_genero' })
    expect(checkCoupleGender('F', 'F')).toEqual({ ok: false, code: 'mismo_genero' })
  })

  it('género vacío → genero_faltante (pide completar perfil, NO bloquea como mismo género)', () => {
    expect(checkCoupleGender(null, 'F')).toEqual({ ok: false, code: 'genero_faltante', who: 'requester' })
    expect(checkCoupleGender('M', null)).toEqual({ ok: false, code: 'genero_faltante', who: 'spouse' })
    expect(checkCoupleGender('', '  ')).toEqual({ ok: false, code: 'genero_faltante', who: 'both' })
  })

  it('valores fuera de M/F (ej. "otro") se tratan como dato a completar/corregir', () => {
    expect(checkCoupleGender('otro', 'F')).toEqual({ ok: false, code: 'genero_faltante', who: 'requester' })
  })

  it('mensajes de faltante nombran a quién', () => {
    expect(missingGenderMessage('spouse')).toContain('pareja')
    expect(missingGenderMessage('requester')).toContain('quien se inscribe')
    expect(missingGenderMessage('both')).toContain('Ambos')
  })
})
