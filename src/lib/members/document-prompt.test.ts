import { describe, it, expect } from 'vitest'
import {
  shouldShowDocumentPrompt,
  DOCUMENT_PROMPT_SNOOZE_DAYS,
} from './document-prompt'

const AHORA = new Date('2026-08-21T12:00:00Z')

/** Fecha a N días antes de AHORA. */
function haceDias(n: number): string {
  return new Date(AHORA.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

describe('shouldShowDocumentPrompt', () => {
  it('se muestra si falta el documento y nunca lo descartó', () => {
    expect(shouldShowDocumentPrompt({ hasDocument: false, now: AHORA })).toBe(true)
  })

  it('no se muestra si ya tiene documento', () => {
    expect(shouldShowDocumentPrompt({ hasDocument: true, now: AHORA })).toBe(false)
    // Ni siquiera con un descarte viejo.
    expect(shouldShowDocumentPrompt({
      hasDocument: true, dismissedAt: haceDias(90), now: AHORA,
    })).toBe(false)
  })

  it('no se muestra en perfiles de sistema ni en sesiones sin miembro', () => {
    expect(shouldShowDocumentPrompt({ hasDocument: false, isSystem: true, now: AHORA })).toBe(false)
    expect(shouldShowDocumentPrompt({ hasDocument: false, hasMember: false, now: AHORA })).toBe(false)
  })

  // El corazón de FIN-2: el descarte silencia 14 días, no para siempre.
  it('queda silenciado durante los 14 días posteriores al descarte', () => {
    expect(shouldShowDocumentPrompt({ hasDocument: false, dismissedAt: haceDias(0), now: AHORA })).toBe(false)
    expect(shouldShowDocumentPrompt({ hasDocument: false, dismissedAt: haceDias(1), now: AHORA })).toBe(false)
    expect(shouldShowDocumentPrompt({ hasDocument: false, dismissedAt: haceDias(13), now: AHORA })).toBe(false)
  })

  it('reaparece a los 14 días', () => {
    expect(shouldShowDocumentPrompt({
      hasDocument: false, dismissedAt: haceDias(DOCUMENT_PROMPT_SNOOZE_DAYS), now: AHORA,
    })).toBe(true)
    expect(shouldShowDocumentPrompt({ hasDocument: false, dismissedAt: haceDias(30), now: AHORA })).toBe(true)
  })

  it('acepta Date además de string ISO', () => {
    expect(shouldShowDocumentPrompt({
      hasDocument: false, dismissedAt: new Date(haceDias(2)), now: AHORA,
    })).toBe(false)
  })

  // Postgres devuelve '+00:00' donde JS serializa 'Z' — es el string que llega
  // real desde /api/auth/me, así que se prueba con ese formato.
  it('acepta el formato de timestamptz de Postgres (+00:00)', () => {
    expect(shouldShowDocumentPrompt({
      hasDocument: false, dismissedAt: '2026-08-20T12:00:00.348+00:00', now: AHORA,
    })).toBe(false)
    expect(shouldShowDocumentPrompt({
      hasDocument: false, dismissedAt: '2026-07-01T12:00:00.348+00:00', now: AHORA,
    })).toBe(true)
  })

  it('con fecha de descarte corrupta se muestra el aviso', () => {
    expect(shouldShowDocumentPrompt({ hasDocument: false, dismissedAt: 'no-es-fecha', now: AHORA })).toBe(true)
  })

  it('una fecha futura no silencia para siempre (sigue oculto hasta que pase)', () => {
    expect(shouldShowDocumentPrompt({ hasDocument: false, dismissedAt: haceDias(-5), now: AHORA })).toBe(false)
  })
})
