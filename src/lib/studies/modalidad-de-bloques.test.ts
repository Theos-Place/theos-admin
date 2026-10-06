import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { modalidadDe, esLegacy, MODALIDAD_POR_DEFECTO } from './modalidad-de-bloques'
import { nivelesACobrar, folletosQuePide, montoDelBloque } from './corte-de-bloque'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('la modalidad, y hacia dónde se equivoca', () => {
  it('lo desconocido cae en LEGACY, no en bloques', () => {
    /**
     * Es la decisión del módulo y vale la pena fijarla: equivocarse hacia
     * legacy genera un cobro y un folleto de más —visible y corregible— y
     * equivocarse hacia bloques deja a alguien sin material, que es el error
     * que nadie ve hasta que llega a clase.
     */
    for (const v of [null, undefined, '', 'BLOQUES', 'otra cosa']) {
      expect(modalidadDe(v), String(v)).toBe('legacy')
    }
    expect(MODALIDAD_POR_DEFECTO).toBe('legacy')
    expect(modalidadDe('bloques')).toBe('bloques')
    expect(esLegacy('bloques')).toBe(false)
  })
})

describe('un grupo LEGACY cobra y entrega POR NIVEL', () => {
  const COSTOS = { N1: 0, N2: 5000, N3: 5000, N4: 5000 }

  it('el cierre 3→4 SÍ cobra el Nivel 4 — el bug del 2026-10-05', () => {
    // Bajo bloques no cobra nada, y por eso cinco cierres dejaron a 32
    // estudiantes sin cobro.
    expect(nivelesACobrar('N4', 'legacy')).toEqual(['N4'])
    expect(montoDelBloque('N4', COSTOS, 'legacy')).toBe(5000)
    // Y bajo bloques sigue sin cobrar, que es lo correcto allá.
    expect(nivelesACobrar('N4', 'bloques')).toEqual([])
    expect(montoDelBloque('N4', COSTOS, 'bloques')).toBe(0)
  })

  it('el cierre 1→2 SÍ cobra el Nivel 2', () => {
    expect(montoDelBloque('N2', COSTOS, 'legacy')).toBe(5000)
    expect(montoDelBloque('N2', COSTOS, 'bloques')).toBe(0)
  })

  it('entrar a N1 legacy cobra solo N1 (₡0), no el par', () => {
    expect(nivelesACobrar('N1', 'legacy')).toEqual(['N1'])
    expect(montoDelBloque('N1', COSTOS, 'legacy')).toBe(0)
    expect(montoDelBloque('N1', COSTOS, 'bloques')).toBe(5000)
  })

  it('un grupo de N4 legacy SÍ pide su folleto', () => {
    expect(folletosQuePide('N4', 'legacy')).toEqual(['N4'])
    expect(folletosQuePide('N4', 'bloques')).toEqual([])
    expect(folletosQuePide('N2', 'legacy')).toEqual(['N2'])
  })

  it('un grupo de N1 legacy pide UNO, no el par', () => {
    expect(folletosQuePide('N1', 'legacy')).toEqual(['N1'])
    expect(folletosQuePide('N1', 'bloques')).toEqual(['N1', 'N2'])
  })

  it('lo que no es un nivel se comporta igual en las dos', () => {
    // Discípulos, prematrimonial y capacitaciones nunca entraron en bloques.
    for (const code of ['DIS1', 'DIS2', 'PREMAT', 'CAP-X']) {
      expect(nivelesACobrar(code, 'legacy'), code).toEqual([code])
      expect(nivelesACobrar(code, 'bloques'), code).toEqual([code])
      expect(folletosQuePide(code, 'bloques'), code).toEqual([code])
    }
  })
})

describe('el cableado: nadie decide esto solo', () => {
  it('el sucesor HEREDA la modalidad, no la deduce de la fecha', () => {
    /**
     * Los 5 grupos de N4 que hubo que reparar nacieron el 2026-10-05 como
     * sucesores de N3 legacy. Con un criterio de fecha quedaban «bloques»,
     * que es exactamente al revés.
     */
    const q = sinComentarios('src/lib/supabase/queries/payments.ts')
    expect(q).toContain('const modalidad = modalidadDe(src.modalidad)')
    expect(q).toMatch(/findOrCreateSuccessorGroup\([^)]*modalidad\)/)
    expect(q).toContain('modalidad,')
    // Y NUNCA por fecha.
    expect(q).not.toMatch(/created_at\s*<\s*['"]2026-10-05/)
  })

  it('en un grupo MIXTO no se le cobra a quien ya pagó el par', () => {
    // El N3 de Michelle Guier: 9 viejos y 1 que pagó ₡10.000 el 5-oct.
    const q = sinComentarios('src/lib/supabase/queries/payments.ts')
    expect(q).toContain("eq('cubre_bloque', true)")
    // La aserción apunta al GUARD del cobro, no a cualquier mención: la
    // primera versión pasaba porque el nombre aparece también en el insert
    // de la matrícula, así que borrar el guard no la rompía.
    expect(q).toMatch(/memberFree\s*=[\s\S]{0,160}yaPagaronElPar\.has\(memberId\)/)
  })

  it('y tampoco se le imprime folleto', () => {
    const q = sinComentarios('src/lib/supabase/queries/folletos.ts')
    expect(q).toContain("eq('cubre_bloque', true)")
    expect(q).toContain('const aImprimir = Math.max(0, enrolled - (conPar ?? 0))')
    expect(q).toContain('quantity: aImprimir')
  })

  it('la matrícula guarda si pagó el par, en vez de deducirlo del monto', () => {
    // ₡5.000 es el par N1+N2 bajo bloques y el nivel suelto N2 bajo legacy:
    // el monto solo no distingue.
    const q = sinComentarios('src/lib/supabase/queries/studies.ts')
    expect(q).toContain('cubre_bloque: delBloque.length > 1')
    expect(q).toContain('const modalidad = modalidadDe(group?.modalidad)')
  })

  it('la migración marca legacy TODO lo que ya existe', () => {
    const m = readFileSync('supabase/migrations/20261006120000_est14_modalidad_legacy.sql', 'utf8')
    expect(m).toContain("update public.study_groups set modalidad = 'legacy'")
    expect(m).toContain("default 'bloques'")
    expect(m).toContain('cubre_bloque')
  })
})
