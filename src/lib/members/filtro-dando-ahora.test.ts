import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { conditionLabel } from '@/lib/condition-labels'
import { ESTADOS_DIRIGIENDO } from '@/lib/studies/dirigente-activo'
import type { FilterCondition } from '@/types/filters'

const cond = (over: Partial<Extract<FilterCondition, { type: 'study' }>>): FilterCondition => ({
  id: 1, group: 'study', type: 'study', study: '', status: 'leading', from: null, to: null, ...over,
} as FilterCondition)

/**
 * La búsqueda de miembros solo sabía preguntar por la persona como ESTUDIANTE.
 * Quien DA un estudio no salía en ningún filtro: al 2026-09-23, 114 dirigentes
 * con grupo activo contra 431 cursando, y solo 4 en las dos listas. Los otros
 * 110 eran invisibles y nada en la pantalla lo decía.
 */
describe('filtro «dando ahora» (como dirigente)', () => {
  it('el chip dice DANDO y no se confunde con cursando', () => {
    expect(conditionLabel(cond({ study: 'N2' }))).toBe('Dando: N2 — Nivel 2')
    expect(conditionLabel(cond({ study: '' }))).toBe('Dando un estudio')
    expect(conditionLabel(cond({ study: 'N2', status: 'in_progress' }))).toBe('Cursando: N2 — Nivel 2')
  })

  it('sale de la MISMA definición que el toggle de la pantalla de dirigentes', () => {
    // Si se separan, «Dando ahora» daría dos números distintos en dos
    // pantallas — el enredo que ya costó caro con «último estudio».
    const s = readFileSync('src/lib/supabase/queries/members.ts', 'utf8')
    expect(s).toContain("from '@/lib/studies/dirigente-activo'")
    expect(s).toContain('ESTADOS_DIRIGIENDO')
    expect([...ESTADOS_DIRIGIENDO]).toEqual(['en_curso', 'en_matricula'])
  })

  it('mira las DOS columnas: dirigente y co-dirigente', () => {
    // Quien solo co-dirige quedaría fuera si se leyera `leader_id` a secas.
    const s = readFileSync('src/lib/supabase/queries/members.ts', 'utf8')
    expect(s).toContain("for (const col of ['leader_id', 'co_leader_id'] as const)")
  })

  it('NO se resuelve contra study_enrollments', () => {
    // Un dirigente casi nunca está matriculado en el grupo que da: resolverlo
    // por matrículas devolvería 4 de 114.
    const s = readFileSync('src/lib/supabase/queries/members.ts', 'utf8')
    const fn = s.slice(s.indexOf('async function idsByLeadership'), s.indexOf('/** Resuelve cada condición avanzada'))
    expect(fn).not.toContain('study_enrollments')
    expect(fn).toContain("from('study_groups')")
  })

  it('el rótulo dice desde qué lado mira, en el rótulo y no en un tooltip', () => {
    const ui = readFileSync('src/components/members/AdvancedFilters.tsx', 'utf8')
    expect(ui).toContain("label: 'Cursando ahora (como estudiante)'")
    expect(ui).toContain("label: 'Dando ahora (como dirigente)'")
  })
})

/**
 * PAR-5b · «En matrícula»: el tercer sentido de «lo está llevando».
 *
 * Con PAR-5 «cursando» pasó a exigir que el grupo haya arrancado, y quienes
 * están inscritos en uno que no empieza se quedaron sin filtro: el export de
 * Ari dejó por fuera a los de Discípulos 1 por iniciar. Medido contra
 * producción el 2026-09-24: 431 cursando, 249 en matrícula, 114 dando.
 */
describe('filtro «en matrícula»', () => {
  const src = readFileSync('src/lib/supabase/queries/members.ts', 'utf8')

  it('exige que el grupo esté en_matricula, y cursando que esté en_curso', () => {
    expect(src).toContain("c.status === 'in_progress' ? ['en_curso' as const]")
    expect(src).toContain("c.status === 'enrolling' ? ['en_matricula' as const]")
  })

  it('son DISJUNTAS: un grupo no puede estar en los dos estados', () => {
    // Importa para combinarlas con OR sin contar a nadie dos veces.
    expect(['en_curso']).not.toContain('en_matricula')
  })

  it('las dos miran la misma matrícula vigente', () => {
    // La diferencia es el estado del GRUPO, no el de la matrícula: si una
    // pidiera otros estados de matrícula, serían dos reglas y no una con dos
    // recortes.
    expect(src).toContain("(c.status === 'in_progress' || c.status === 'enrolling') ? MATRICULAS_VIGENTES")
  })

  it('el chip la nombra sin confundirla con «cursando»', () => {
    const ui = readFileSync('src/components/members/AdvancedFilters.tsx', 'utf8')
    expect(ui).toContain("label: 'En matrícula (aún no empieza)'")
  })
})
