import { describe, it, expect } from 'vitest'
import { planDeEnlace } from './enlace-de-cuenta'

const AUTH = 'auth-1'

describe('planDeEnlace', () => {
  it('enlaza la única ficha con ese correo y sin cuenta', () => {
    expect(planDeEnlace([{ id: 'm1', auth_user_id: null }], AUTH, null))
      .toEqual({ accion: 'enlazar', memberId: 'm1' })
  })

  it('no adivina cuando dos fichas comparten el correo (familias)', () => {
    expect(planDeEnlace([{ id: 'm1', auth_user_id: null }, { id: 'm2', auth_user_id: null }], AUTH, null))
      .toEqual({ accion: 'nada', motivo: 'correo_compartido' })
  })

  it('no toca nada si la cuenta ya es de esa ficha', () => {
    expect(planDeEnlace([{ id: 'm1', auth_user_id: AUTH }], AUTH, 'm1'))
      .toEqual({ accion: 'nada', motivo: 'ya_enlazada' })
  })

  it('no le roba la cuenta a otra ficha', () => {
    expect(planDeEnlace([{ id: 'm1', auth_user_id: null }], AUTH, 'm2'))
      .toEqual({ accion: 'nada', motivo: 'cuenta_de_otra_ficha' })
  })

  it('no pisa la cuenta que la ficha ya tenía', () => {
    expect(planDeEnlace([{ id: 'm1', auth_user_id: 'otra' }], AUTH, null))
      .toEqual({ accion: 'nada', motivo: 'ficha_con_otra_cuenta' })
  })

  it('sin ficha no hace nada', () => {
    expect(planDeEnlace([], AUTH, null)).toEqual({ accion: 'nada', motivo: 'sin_ficha' })
  })
})
