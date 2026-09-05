import { describe, it, expect } from 'vitest'
import { estadoDeBaja, esTipoDeBaja, BAJA_COPY, TIPOS_DE_BAJA } from './baja-matricula'

describe('estadoDeBaja', () => {
  it('quitar del grupo deja la matrícula como si no hubiera pasado', () => {
    expect(estadoDeBaja('cancelar')).toBe('cancelada')
  })

  it('retirar deja constancia de que cursaba y se fue', () => {
    expect(estadoDeBaja('retirar')).toBe('dropped')
  })

  it('los dos estados son distintos: ese es el punto', () => {
    expect(estadoDeBaja('cancelar')).not.toBe(estadoDeBaja('retirar'))
  })
})

describe('esTipoDeBaja', () => {
  it('acepta los dos válidos', () => {
    for (const t of TIPOS_DE_BAJA) expect(esTipoDeBaja(t)).toBe(true)
  })

  it('rechaza cualquier otra cosa', () => {
    for (const v of ['dropped', 'cancelada', '', null, undefined, 5, {}]) {
      expect(esTipoDeBaja(v)).toBe(false)
    }
  })
})

describe('los textos', () => {
  it('cada tipo tiene su copy completo', () => {
    for (const t of TIPOS_DE_BAJA) {
      const c = BAJA_COPY[t]
      for (const k of ['titulo', 'boton', 'gerundio', 'efecto', 'labelMotivo', 'placeholderMotivo'] as const) {
        expect(c[k]).toBeTruthy()
      }
    }
  })

  it('quitar del grupo NO habla de retiro: era justo la confusión', () => {
    // El modal viejo decía "Desinscribir" en el título y "Quedará como
    // retirado" en el cuerpo, con un campo "Motivo del retiro".
    const c = BAJA_COPY.cancelar
    expect(`${c.titulo} ${c.boton} ${c.efecto} ${c.labelMotivo}`.toLowerCase()).not.toContain('retir')
  })

  it('retirar sí dice que queda en el historial', () => {
    expect(BAJA_COPY.retirar.efecto).toContain('historial')
    expect(BAJA_COPY.retirar.efecto).toContain('Se retiró')
  })

  it('quitar del grupo aclara que se puede volver a matricular', () => {
    expect(BAJA_COPY.cancelar.efecto).toContain('volver a matricular')
  })
})
