// Quién puede LLENAR un formulario (decisión 2026-08-06: solo quien fue
// convocado). Antes alcanzaba con tener sesión y el link.
import { describe, it, expect } from 'vitest'
import { formFillAccess, type FillAccessInput } from './fill-access'

const BASE: FillAccessInput = {
  isStaff: false,
  entityType: 'general',
  isEventRegistrant: false,
  isGroupEnrolled: false,
  hasConvocationList: false,
  isConvoked: false,
  wasSentLink: false,
  hasResponded: false,
}

describe('quién entra siempre', () => {
  it('el staff de formularios', () => {
    expect(formFillAccess({ ...BASE, isStaff: true, hasConvocationList: true }).allowed).toBe(true)
  })

  it('quien ya respondió (no se lo deja afuera de su propia respuesta)', () => {
    expect(formFillAccess({ ...BASE, hasConvocationList: true, hasResponded: true }).allowed).toBe(true)
  })

  it('a quien se le mandó el link por correo — eso ES la convocatoria', () => {
    expect(formFillAccess({ ...BASE, hasConvocationList: true, wasSentLink: true }).allowed).toBe(true)
  })
})

describe('formulario de un evento', () => {
  const ev = { ...BASE, entityType: 'event' }

  it('lo llena quien está inscrito', () => {
    expect(formFillAccess({ ...ev, isEventRegistrant: true }).allowed).toBe(true)
  })

  it('quien no está inscrito, no — y se le dice por qué', () => {
    const r = formFillAccess(ev)
    expect(r.allowed).toBe(false)
    expect(r.allowed === false && r.reason).toMatch(/inscritas al evento/i)
  })
})

describe('formulario de un grupo de estudio', () => {
  const gr = { ...BASE, entityType: 'study_group' }

  it('lo llena quien está matriculado', () => {
    expect(formFillAccess({ ...gr, isGroupEnrolled: true }).allowed).toBe(true)
  })

  it('quien no, no', () => {
    expect(formFillAccess(gr).allowed).toBe(false)
  })
})

describe('preinscripción con audiencia definida (CDEB)', () => {
  const cdeb = { ...BASE, hasConvocationList: true }

  it('el convocado sí', () => {
    expect(formFillAccess({ ...cdeb, isConvoked: true }).allowed).toBe(true)
  })

  it('EL CASO QUE SE CERRÓ: alguien con el link pero sin convocatoria, no', () => {
    const r = formFillAccess(cdeb)
    expect(r.allowed).toBe(false)
    expect(r.allowed === false && r.reason).toMatch(/convocadas por el comité/i)
  })
})

describe('formulario suelto, sin audiencia y sin envío registrado', () => {
  it('se deja pasar a propósito', () => {
    // Cerrarlo dejaría inservibles los formularios que se comparten por
    // WhatsApp o se linkean a mano: no hay contra qué comparar.
    expect(formFillAccess(BASE).allowed).toBe(true)
    expect(formFillAccess({ ...BASE, entityType: null }).allowed).toBe(true)
  })
})
