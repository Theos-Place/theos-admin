import { describe, it, expect } from 'vitest'
import { shareRegistrationUrl } from './public-register-link'

const O = 'https://admin.theosplace.org'

describe('cuál link se comparte para inscribirse', () => {
  it('CON formulario de inscripción: el del formulario', () => {
    const r = shareRegistrationUrl({ id: 'ev1', registration_form_id: 'form9' }, O)
    expect(r.url).toBe(`${O}/formularios/form9/responder`)
    expect(r.kind).toBe('formulario')
  })

  it('SIN formulario: el público del evento', () => {
    const r = shareRegistrationUrl({ id: 'ev1', registration_form_id: null }, O)
    expect(r.url).toBe(`${O}/calendario/ev1`)
    expect(r.kind).toBe('evento')
  })

  it('sin el campo del todo (eventos viejos): el del evento', () => {
    expect(shareRegistrationUrl({ id: 'ev1' }, O).kind).toBe('evento')
  })

  it('nunca devuelve los dos: es uno u otro', () => {
    // El punto del cambio: repartir dos links deja dos caminos y dos listas.
    const con = shareRegistrationUrl({ id: 'ev1', registration_form_id: 'f' }, O)
    const sin = shareRegistrationUrl({ id: 'ev1', registration_form_id: null }, O)
    expect(con.url).not.toBe(sin.url)
    expect(con.url.includes('/calendario/')).toBe(false)
    expect(sin.url.includes('/formularios/')).toBe(false)
  })

  it('respeta el origen que se le pasa (previews de Vercel)', () => {
    expect(shareRegistrationUrl({ id: 'ev1' }, 'https://preview.vercel.app/').url)
      .toBe('https://preview.vercel.app/calendario/ev1')
  })
})
