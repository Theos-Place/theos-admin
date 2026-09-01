import { describe, it, expect } from 'vitest'
import { planDeCambioDeCorreo } from './access-email-plan'

const cuenta = (id: string, o: { haEntrado?: boolean; fichas?: number } = {}) =>
  ({ id, haEntrado: o.haEntrado ?? false, fichas: o.fichas ?? 1 })

describe('planDeCambioDeCorreo', () => {
  it('sin otra cuenta, se renombra la que tiene', () => {
    expect(planDeCambioDeCorreo({ actual: cuenta('A'), conEseCorreo: null })).toEqual({ accion: 'renombrar' })
  })

  it('si la otra cuenta es la misma, también', () => {
    // Reescribir el mismo correo con otra capitalización no es un choque.
    expect(planDeCambioDeCorreo({ actual: cuenta('A'), conEseCorreo: cuenta('A') })).toEqual({ accion: 'renombrar' })
  })

  it('la otra cuenta huérfana y la actual sin usar → se religa', () => {
    // El caso repetido: se registró por su lado con el correo bueno y quedó con
    // dos cuentas; la de la ficha nunca se usó.
    expect(planDeCambioDeCorreo({
      actual: cuenta('vieja', { haEntrado: false }),
      conEseCorreo: cuenta('nueva', { fichas: 0, haEntrado: true }),
    })).toEqual({ accion: 'religar', cuentaNueva: 'nueva', cuentaAbandonada: 'vieja' })
  })

  it('si la otra cuenta ya es de alguien, se bloquea', () => {
    const r = planDeCambioDeCorreo({ actual: cuenta('A'), conEseCorreo: cuenta('B', { fichas: 1 }) })
    expect(r.accion).toBe('bloquear')
    expect(r).toHaveProperty('motivo', expect.stringContaining('otra persona'))
  })

  it('si la actual YA se usó, se bloquea aunque la otra esté huérfana', () => {
    // Dos cuentas con historia. Mover la ficha abandona los ingresos de una y
    // renombrar es imposible por el índice único: lo decide una persona.
    const r = planDeCambioDeCorreo({
      actual: cuenta('A', { haEntrado: true }),
      conEseCorreo: cuenta('B', { fichas: 0, haEntrado: true }),
    })
    expect(r.accion).toBe('bloquear')
    expect(r).toHaveProperty('motivo', expect.stringContaining('dos cuentas'))
  })

  it('nunca religa hacia una cuenta que ya tiene ficha', () => {
    for (const fichas of [1, 2, 5]) {
      const r = planDeCambioDeCorreo({ actual: cuenta('A'), conEseCorreo: cuenta('B', { fichas }) })
      expect(r.accion, `fichas=${fichas}`).toBe('bloquear')
    }
  })
})
