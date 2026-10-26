import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cierrePideFolletos } from './folletos'
import { FOLLETOS_DE_DISCIPULOS } from './corte-de-bloque'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('folletos de DISCÍPULOS: los tres al crear DIS1, nada en los cierres (decisión 2026-10-26)', () => {
  it('los tres juegos salen de una sola lista', () => {
    expect(FOLLETOS_DE_DISCIPULOS).toEqual(['DIS1', 'DIS2', 'DIS3'])
  })

  it('el cierre 1→2 y 2→3 de discípulos NO pide folletos, en ninguna modalidad', () => {
    for (const m of ['legacy', 'bloques', null]) {
      expect(cierrePideFolletos('DIS1', m), `DIS1 ${m}`).toBe(false)
      expect(cierrePideFolletos('DIS2', m), `DIS2 ${m}`).toBe(false)
    }
    // DIS3 no tiene sucesor: tampoco.
    expect(cierrePideFolletos('DIS3', 'legacy')).toBe(false)
  })

  it('los niveles siguen como estaban: legacy pide por nivel, bloques solo al abrir el par', () => {
    expect(cierrePideFolletos('N1', 'legacy')).toBe(true)
    expect(cierrePideFolletos('N3', 'legacy')).toBe(true)
    expect(cierrePideFolletos('N1', 'bloques')).toBe(false)
    expect(cierrePideFolletos('N2', 'bloques')).toBe(true)
    expect(cierrePideFolletos('N4', 'legacy')).toBe(false)
  })

  it('el endpoint y la pantalla de cierre preguntan si el SUCESOR pide folletos, no solo si existe', () => {
    const ruta = sinComentarios('src/app/api/studies/groups/[id]/close/route.ts')
    expect(ruta).toContain('cierrePideFolletos(sourceCode, sourceModalidad)')
    expect(ruta).toContain("select('modalidad, plan:study_plans(code)')")
    const pantalla = sinComentarios('src/app/(admin)/estudios/grupos/[id]/cierre/page.tsx')
    expect(pantalla).toContain('haySucesor && cierrePideFolletos(group.study_type_id, group.modalidad)')
  })

  it('el tiquete automático se niega cuando el plan no pide nada, así que el cierre no manda nada', () => {
    const q = sinComentarios('src/lib/supabase/queries/folletos.ts')
    expect(q).toContain("if (aPedir.length === 0) return { created: false, reason: 'ya_los_tiene_del_bloque' }")
  })
})
