import { describe, it, expect } from 'vitest'
import { isEmailSilentMode, silentDecision, silentLogLine } from './silent-mode'

describe('isEmailSilentMode', () => {
  it('enciende con los valores afirmativos', () => {
    for (const v of ['1', 'true', 'TRUE', 'yes', 'si', ' 1 ']) {
      expect(isEmailSilentMode({ EMAIL_SILENT_MODE: v })).toBe(true)
    }
  })

  // Lo importante: el default es ENVIAR. Un env mal escrito no puede dejar el
  // sistema mudo sin que nadie se dé cuenta.
  it('sin variable, el sistema envía', () => {
    expect(isEmailSilentMode({})).toBe(false)
    expect(isEmailSilentMode({ EMAIL_SILENT_MODE: '' })).toBe(false)
  })

  it('un valor que no es afirmativo no enciende', () => {
    for (const v of ['0', 'false', 'no', 'off', 'quizás']) {
      expect(isEmailSilentMode({ EMAIL_SILENT_MODE: v })).toBe(false)
    }
  })
})

describe('silentDecision', () => {
  it('con el modo apagado se envía todo', () => {
    expect(silentDecision({ silent: false })).toBe('enviar')
    expect(silentDecision({ silent: false, authCritical: true })).toBe('enviar')
  })

  it('con el modo encendido se silencia', () => {
    expect(silentDecision({ silent: true })).toBe('silenciar')
    expect(silentDecision({ silent: true, authCritical: false })).toBe('silenciar')
  })

  // La única excepción: sin esto el staff no puede entrar a trabajar.
  it('los correos de acceso salen igual', () => {
    expect(silentDecision({ silent: true, authCritical: true })).toBe('enviar')
  })
})

describe('silentLogLine', () => {
  it('lleva destinatario y asunto, que es lo que se revisa después', () => {
    const l = silentLogLine('a@b.com', 'Te toca cerrar Nivel 3')
    expect(l).toContain('a@b.com')
    expect(l).toContain('Te toca cerrar Nivel 3')
    expect(l).toContain('EMAIL_SILENT_MODE')
  })
})
