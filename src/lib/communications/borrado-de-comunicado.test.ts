import { describe, it, expect } from 'vitest'
import {
  sePuedeBorrar, sePuedeBorrarEnServidor, MENSAJE_NO_BORRABLE,
  textoDeConfirmacion, resumenDelBorrado,
} from './borrado-de-comunicado'

describe('sePuedeBorrar', () => {
  it('un borrador se borra', () => {
    expect(sePuedeBorrar('draft')).toEqual({ ok: true })
  })
  it('un programado no: primero se cancela', () => {
    expect(sePuedeBorrar('scheduled')).toEqual({ ok: false, error: 'programado' })
  })
  it('uno enviándose ahora, tampoco', () => {
    expect(sePuedeBorrar('sending')).toEqual({ ok: false, error: 'en_curso' })
  })
  it('uno que ya salió es historial', () => {
    for (const e of ['sent', 'partial', 'failed']) {
      expect(sePuedeBorrar(e)).toEqual({ ok: false, error: 'ya_salio' })
    }
  })
  it('un estado desconocido se trata como historial, no como borrable', () => {
    // Ante la duda no se borra: equivocarse hacia "no borrar" es reversible.
    expect(sePuedeBorrar('lo_que_sea')).toEqual({ ok: false, error: 'ya_salio' })
  })
})

describe('sePuedeBorrarEnServidor', () => {
  it('borrador sin envíos: pasa', () => {
    expect(sePuedeBorrarEnServidor('draft', 0)).toEqual({ ok: true })
  })
  it('borrador CON envíos registrados: no pasa aunque el estado diga draft', () => {
    expect(sePuedeBorrarEnServidor('draft', 3)).toEqual({ ok: false, error: 'tiene_envios', envios: 3 })
  })
  it('el estado manda primero: un enviado con 0 logs sigue sin borrarse', () => {
    expect(sePuedeBorrarEnServidor('sent', 0)).toEqual({ ok: false, error: 'ya_salio' })
  })
})

describe('textos', () => {
  it('el de un solo borrador no dice cantidad', () => {
    expect(textoDeConfirmacion(1)).toContain('este borrador')
  })
  it('el de varios dice cuántos', () => {
    expect(textoDeConfirmacion(14)).toContain('14 borradores')
  })
  it('los dos avisan que no se deshace', () => {
    expect(textoDeConfirmacion(1)).toContain('No se puede deshacer')
    expect(textoDeConfirmacion(9)).toContain('No se puede deshacer')
  })
  it('el resumen distingue todo bien, nada, y a medias', () => {
    expect(resumenDelBorrado(14, 0)).toBe('14 borradores eliminados.')
    expect(resumenDelBorrado(1, 0)).toBe('Borrador eliminado.')
    expect(resumenDelBorrado(0, 3)).toBe('No se pudo borrar ninguno.')
    expect(resumenDelBorrado(10, 4)).toContain('4 no se pudieron borrar')
  })
  it('cada motivo tiene mensaje', () => {
    for (const m of ['programado', 'en_curso', 'ya_salio', 'tiene_envios'] as const) {
      expect(MENSAJE_NO_BORRABLE[m].length).toBeGreaterThan(10)
    }
  })
})
