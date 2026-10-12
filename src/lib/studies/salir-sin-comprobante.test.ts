import { describe, it, expect } from 'vitest'
import { avisoDeSalidaSinComprobante, AVISO_AL_CERRAR_PESTANA } from './salir-sin-comprobante'
import { HORAS_DE_GRACIA } from './enrollment-hold'

describe('MAT-3 · aviso al intentar salir sin el comprobante', () => {
  const a = avisoDeSalidaSinComprobante('Nivel 1 — Escazú')

  it('dice que la matrícula NO está completa, no que se perdió', () => {
    // Es la distinción que no se estaba haciendo: la matrícula existe y el
    // campo está apartado. Decir «se canceló» sería falso y la haría
    // rematricularse de gusto.
    expect(a.titulo).toMatch(/no está completa/i)
    expect(a.cuerpo).toMatch(/campo apartado/i)
  })

  it('nombra el estudio, para que no haya duda de cuál es', () => {
    expect(a.cuerpo).toContain('Nivel 1 — Escazú')
  })

  it('el plazo sale de la constante, no de un número escrito a mano', () => {
    // El plazo ya cambió una vez (48 → 72 el 2026-09-17). Un literal en la UI
    // habría quedado mintiendo sin que nadie lo notara.
    expect(a.plazo).toContain(String(HORAS_DE_GRACIA))
  })

  it('dice la consecuencia concreta: se elimina y el cupo pasa a otro', () => {
    expect(a.plazo).toMatch(/se elimina/i)
    expect(a.plazo).toMatch(/otra persona/i)
  })

  it('el aviso de cerrar pestaña no va vacío: si no, el navegador no pregunta', () => {
    expect(AVISO_AL_CERRAR_PESTANA.length).toBeGreaterThan(0)
  })
})
