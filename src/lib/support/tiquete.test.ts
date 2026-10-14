import { describe, it, expect } from 'vitest'
import {
  motivoQueImpideCrear, puedeLevantarTiquete, puedeResolverTiquetes, puedeMover,
  ACCION_A_ESTADO, MINIMO_DE_DETALLE, SOPORTE_ROLES,
} from './tiquete'

describe('SOP-1 · crear un tiquete', () => {
  it('rechaza el texto vacío o de un «hola»', () => {
    expect(motivoQueImpideCrear('')).toContain(`mínimo ${MINIMO_DE_DETALLE}`)
    expect(motivoQueImpideCrear('   hola   ')).not.toBeNull()
  })

  it('acepta un detalle real', () => {
    expect(motivoQueImpideCrear('A María le sale otra familia al entrar.')).toBeNull()
  })

  it('rechaza el texto desmedido', () => {
    expect(motivoQueImpideCrear('x'.repeat(5000))).toContain('muy largo')
  })
})

describe('SOP-1 · quién levanta y quién resuelve', () => {
  it('levanta quien opera el check-in: encargado_eventos, direccion, admin', () => {
    expect(puedeLevantarTiquete(['encargado_eventos'])).toBe(true)
    expect(puedeLevantarTiquete(['direccion'])).toBe(true)
    expect(puedeLevantarTiquete(['admin'])).toBe(true)
  })

  it('NO levanta quien no opera la puerta', () => {
    // El cebo: soporte resuelve, no levanta; finanzas y el miembro tampoco.
    expect(puedeLevantarTiquete(['soporte_tecnico'])).toBe(false)
    expect(puedeLevantarTiquete(['finanzas'])).toBe(false)
    expect(puedeLevantarTiquete(['miembro'])).toBe(false)
    expect(puedeLevantarTiquete([])).toBe(false)
  })

  it('resuelve soporte_tecnico y admin, nadie más', () => {
    expect(SOPORTE_ROLES).toEqual(['soporte_tecnico', 'admin'])
    expect(puedeResolverTiquetes(['soporte_tecnico'])).toBe(true)
    expect(puedeResolverTiquetes(['admin'])).toBe(true)
    expect(puedeResolverTiquetes(['direccion'])).toBe(false)
    expect(puedeResolverTiquetes(['encargado_eventos'])).toBe(false)
  })
})

describe('SOP-1 · mover un tiquete', () => {
  it('las tres acciones del tablero llevan a su estado', () => {
    expect(ACCION_A_ESTADO).toEqual({ take: 'in_review', resolve: 'resolved', reject: 'rejected' })
  })

  it('desde abierto se puede tomar, resolver o rechazar directo', () => {
    expect(puedeMover('open', 'in_review')).toBe(true)
    expect(puedeMover('open', 'resolved')).toBe(true)
    expect(puedeMover('open', 'rejected')).toBe(true)
  })

  it('en revisión lo puede tomar otra persona y cerrarse', () => {
    expect(puedeMover('in_review', 'in_review')).toBe(true)
    expect(puedeMover('in_review', 'resolved')).toBe(true)
  })

  it('un tiquete cerrado no se reabre ni se vuelve a mover', () => {
    expect(puedeMover('resolved', 'in_review')).toBe(false)
    expect(puedeMover('rejected', 'resolved')).toBe(false)
    expect(puedeMover('in_review', 'open')).toBe(false)
  })
})
