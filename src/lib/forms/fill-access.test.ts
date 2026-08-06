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
  isPublic: false,
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
  it('CERRADO por defecto: si no sabemos a quién va, no va a cualquiera', () => {
    expect(formFillAccess(BASE).allowed).toBe(false)
    expect(formFillAccess({ ...BASE, entityType: null }).allowed).toBe(false)
  })

  it('se abre marcándolo como público, a propósito', () => {
    expect(formFillAccess({ ...BASE, isPublic: true }).allowed).toBe(true)
    expect(formFillAccess({ ...BASE, entityType: null, isPublic: true }).allowed).toBe(true)
  })

  it('marcarlo público NO abre los que tienen audiencia definida', () => {
    // Un formulario de evento sigue siendo de sus inscritos aunque alguien
    // marque la casilla sin pensar.
    expect(formFillAccess({ ...BASE, entityType: 'event', isPublic: true }).allowed).toBe(false)
    expect(formFillAccess({ ...BASE, hasConvocationList: true, isPublic: true }).allowed).toBe(false)
  })
})

// ── El criterio de "convocado" no puede tener dos versiones ─────────────────
describe('la lista de convocatoria y el guard usan la MISMA regla', () => {
  it('las dos consultas filtran por status enviada y recomendación "si%"', async () => {
    const { readFileSync } = await import('node:fs')
    const seleccion = readFileSync('src/lib/supabase/queries/form-selection.ts', 'utf8')
    const guard = readFileSync('src/lib/supabase/queries/form-fill-access.ts', 'utf8')

    // Las constantes viven en un solo lado y el guard las importa.
    expect(seleccion).toContain("export const CONVOKED_STATUS = 'enviada'")
    expect(seleccion).toContain("export const CONVOKED_RECOMMENDATION_PREFIX = 'si%'")
    expect(guard).toContain('CONVOKED_STATUS')
    expect(guard).toContain('CONVOKED_RECOMMENDATION_PREFIX')

    // Y ninguno de los dos tiene el criterio escrito a mano.
    for (const [nombre, src] of [['form-selection', seleccion], ['form-fill-access', guard]] as const) {
      const aMano = src.match(/\.like\('recommendation',\s*'si%'\)/)
      expect(aMano, `${nombre} repite el criterio en vez de usar la constante`).toBeNull()
    }
  })
})
