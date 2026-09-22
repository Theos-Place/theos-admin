import { describe, it, expect } from 'vitest'
import {
  motivoParaQuedarse, esCandidataABorrar, esCuentaDePrueba, ETIQUETA_MOTIVO,
  type CuentaParaEvaluar,
} from './limpieza-de-cuentas'

const nadie: CuentaParaEvaluar = {
  email: 'x@y.com',
  seLogueoAlgunaVez: false,
  estaBloqueada: false,
  tieneRolActivo: false,
  asistioEnLaVentana: false,
  estudioEnLaVentana: false,
}

describe('qué cuenta se queda', () => {
  it('la que se logueó alguna vez, siempre', () => {
    expect(motivoParaQuedarse({ ...nadie, seLogueoAlgunaVez: true })).toBe('se_logueo')
  })

  it('LA BLOQUEADA — es la que casi se nos pasa', () => {
    // Las 106 cuentas de menores que FAM-2 deshabilitó cumplen todo lo que este
    // proceso busca: nunca entraron, sin rol, sin asistencia. Borrarlas rompe
    // AUT-4 (no habría nada que desbloquear al cumplir 18) y libera el correo.
    expect(motivoParaQuedarse({ ...nadie, estaBloqueada: true })).toBe('bloqueada')
    expect(esCandidataABorrar({ ...nadie, estaBloqueada: true })).toBe(false)
  })

  it('la de prueba: la maneja SEC-4, no este proceso', () => {
    expect(motivoParaQuedarse({ ...nadie, email: 'ana@prueba.theosplace.invalid' }))
      .toBe('cuenta_de_prueba')
  })

  it('la de alguien con rol activo, jamás', () => {
    expect(motivoParaQuedarse({ ...nadie, tieneRolActivo: true })).toBe('tiene_rol')
  })

  it('la de quien vino o estudió dentro de la ventana', () => {
    expect(motivoParaQuedarse({ ...nadie, asistioEnLaVentana: true })).toBe('asistencia_reciente')
    expect(motivoParaQuedarse({ ...nadie, estudioEnLaVentana: true })).toBe('estudio_reciente')
  })

  it('sin ningún motivo, es candidata', () => {
    expect(motivoParaQuedarse(nadie)).toBeNull()
    expect(esCandidataABorrar(nadie)).toBe(true)
  })

  it('el motivo más fuerte es el que se reporta', () => {
    // Para que el conteo por motivo sume el total y no cuente a nadie dos veces.
    expect(motivoParaQuedarse({
      ...nadie, seLogueoAlgunaVez: true, estaBloqueada: true, tieneRolActivo: true,
    })).toBe('se_logueo')
  })

  it('todo motivo tiene su etiqueta legible', () => {
    for (const m of ['se_logueo', 'bloqueada', 'cuenta_de_prueba', 'tiene_rol',
      'asistencia_reciente', 'estudio_reciente'] as const) {
      expect(ETIQUETA_MOTIVO[m], m).toBeTruthy()
    }
  })
})

describe('esCuentaDePrueba', () => {
  it('reconoce el dominio, sin importar mayúsculas', () => {
    expect(esCuentaDePrueba('Ana@Prueba.TheosPlace.Invalid')).toBe(true)
  })
  it('no confunde un correo que solo lo contiene en medio', () => {
    expect(esCuentaDePrueba('x@prueba.theosplace.invalid.com')).toBe(false)
  })
  it('null no es cuenta de prueba', () => {
    expect(esCuentaDePrueba(null)).toBe(false)
  })
})
