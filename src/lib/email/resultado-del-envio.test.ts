import { describe, it, expect } from 'vitest'
import {
  MESSAGE_ID_OMITIDO, ENVIADO, omitido, resultadoDeMessageId, seRegistraElEnvio, mensajeDeOmision,
} from './resultado-del-envio'

describe('resultadoDeMessageId', () => {
  it('un messageId real cuenta como enviado', () => {
    expect(resultadoDeMessageId('<abc123@theosplace.org>')).toEqual(ENVIADO)
  })
  it('el modo silencioso NO cuenta como enviado', () => {
    expect(resultadoDeMessageId(MESSAGE_ID_OMITIDO.modo_silencioso))
      .toEqual({ enviado: false, motivo: 'modo_silencioso' })
  })
  it('un dominio .invalid tampoco', () => {
    expect(resultadoDeMessageId(MESSAGE_ID_OMITIDO.dominio_invalido))
      .toEqual({ enviado: false, motivo: 'dominio_invalido' })
  })
  it('los dos ids omitidos son distintos entre sí', () => {
    expect(MESSAGE_ID_OMITIDO.modo_silencioso).not.toBe(MESSAGE_ID_OMITIDO.dominio_invalido)
  })
})

describe('seRegistraElEnvio', () => {
  it('se anota la fecha solo cuando el correo salió', () => {
    expect(seRegistraElEnvio(ENVIADO)).toBe(true)
  })
  it('un correo silenciado no deja fecha de envío', () => {
    // Es el bug BEC-3: la beca decía "último envío" de algo que nunca salió.
    expect(seRegistraElEnvio(omitido('modo_silencioso'))).toBe(false)
  })
  it('una cuenta de prueba tampoco', () => {
    expect(seRegistraElEnvio(omitido('dominio_invalido'))).toBe(false)
  })
})

describe('mensajeDeOmision', () => {
  it('el del modo silencioso dice qué hacer', () => {
    const m = mensajeDeOmision('modo_silencioso')
    expect(m).toContain('modo silencioso')
    expect(m).toContain('volvé a intentarlo')
  })
  it('el de la cuenta de prueba no promete reintentos', () => {
    const m = mensajeDeOmision('dominio_invalido')
    expect(m).toContain('prueba')
    expect(m).not.toContain('volvé a intentarlo')
  })
})
