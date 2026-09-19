import { describe, it, expect } from 'vitest'
import { comitesAConsultar } from './alcance-de-mi-comite'

describe('comitesAConsultar', () => {
  it('sin pedir uno en particular, devuelve todos los suyos', () => {
    expect(comitesAConsultar(['a', 'b'], null)).toEqual({ ok: true, comites: ['a', 'b'] })
  })

  it('pedir uno propio lo acota a ese', () => {
    expect(comitesAConsultar(['a', 'b'], 'b')).toEqual({ ok: true, comites: ['b'] })
  })

  it('pedir uno ajeno se rechaza aunque exista', () => {
    expect(comitesAConsultar(['a'], 'z')).toEqual({ ok: false, motivo: 'ajeno' })
  })

  it('quien no es encargado de nada no ve nada, pero tampoco es un error', () => {
    expect(comitesAConsultar([], null)).toEqual({ ok: true, comites: [] })
    expect(comitesAConsultar([], 'a')).toEqual({ ok: false, motivo: 'ajeno' })
  })

  it('no devuelve la lista original: mutarla no cambia los permisos', () => {
    const propios = ['a']
    const r = comitesAConsultar(propios, null)
    if (!r.ok) throw new Error('debería pasar')
    r.comites.push('z')
    expect(propios).toEqual(['a'])
  })
})
