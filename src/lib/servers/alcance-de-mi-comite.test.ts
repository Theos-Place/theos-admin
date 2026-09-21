import { describe, it, expect } from 'vitest'
import { comitesAConsultar, type QuienPregunta } from './alcance-de-mi-comite'

const encargado = (propios: string[]): QuienPregunta => ({ propios, amplio: false })
const amplio = (propios: string[] = []): QuienPregunta => ({ propios, amplio: true })

describe('el encargado de comité (SRV-4)', () => {
  it('sin pedir uno en particular, ve todos los suyos', () => {
    expect(comitesAConsultar(encargado(['a', 'b']), null)).toEqual({ ok: true, comites: ['a', 'b'] })
  })

  it('pedir uno propio lo acota a ese', () => {
    expect(comitesAConsultar(encargado(['a', 'b']), 'b')).toEqual({ ok: true, comites: ['b'] })
  })

  it('pedir uno ajeno se rechaza aunque exista', () => {
    expect(comitesAConsultar(encargado(['a']), 'z')).toEqual({ ok: false, motivo: 'ajeno' })
  })

  it('quien no es encargado de nada no ve nada, pero tampoco es un error', () => {
    expect(comitesAConsultar(encargado([]), null)).toEqual({ ok: true, comites: [] })
    expect(comitesAConsultar(encargado([]), 'a')).toEqual({ ok: false, motivo: 'ajeno' })
  })
})

describe('los roles amplios (SRV-6)', () => {
  it('pueden elegir cualquier comité', () => {
    expect(comitesAConsultar(amplio(), 'cualquiera')).toEqual({ ok: true, comites: ['cualquiera'] })
  })

  it('sin elegir no cargan nada: la pantalla arranca con el selector', () => {
    // Traer los 46 comités "por si acaso" sería casi un minuto de consultas.
    expect(comitesAConsultar(amplio(), null)).toEqual({ ok: true, comites: [] })
  })

  it('si además son encargados, sin elegir ven los suyos', () => {
    expect(comitesAConsultar(amplio(['mio']), null)).toEqual({ ok: true, comites: ['mio'] })
  })

  it('ser amplio no le afloja el recorte a nadie más', () => {
    // El mismo id que el amplio puede pedir, al encargado ajeno se le niega.
    expect(comitesAConsultar(encargado(['a']), 'otro')).toEqual({ ok: false, motivo: 'ajeno' })
  })
})

describe('no devuelve la lista original', () => {
  it('mutar el resultado no cambia los permisos', () => {
    const propios = ['a']
    const r = comitesAConsultar(encargado(propios), null)
    if (!r.ok) throw new Error('debería pasar')
    r.comites.push('z')
    expect(propios).toEqual(['a'])
  })
})
