// EST-11 · Quién ve los estudios desactivados y en qué orden van las etapas.
import { describe, it, expect } from 'vitest'
import {
  STAGE_ORDER, stageRank, canSeeArchivedPlans, visiblePlans, isArchivedPlan,
  byStageThenArchived,
} from './plan-visibility'
import type { RoleId } from '@/types/auth'

describe('quién ve los estudios desactivados', () => {
  it('los ve quien administra estudios', () => {
    for (const r of ['coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin'] as RoleId[]) {
      expect(canSeeArchivedPlans([r])).toBe(true)
    }
  })

  it('NO los ve el resto — tampoco en gris: no salen', () => {
    for (const r of ['miembro', 'dirigente', 'finanzas', 'comunicaciones',
      'encargado_eventos', 'solo_lectura', 'editor_grupos_estudio'] as RoleId[]) {
      expect(canSeeArchivedPlans([r])).toBe(false)
    }
    expect(canSeeArchivedPlans([])).toBe(false)
    expect(canSeeArchivedPlans(null)).toBe(false)
  })
})

describe('visiblePlans', () => {
  const planes = [
    { code: 'N1', is_archived: false },
    { code: 'VIEJO', is_archived: true },
    { code: 'N2', is_archived: false },
  ]

  it('el staff los recibe todos', () => {
    expect(visiblePlans(planes, true)).toHaveLength(3)
  })

  it('el resto no recibe los desactivados', () => {
    expect(visiblePlans(planes, false).map(p => p.code)).toEqual(['N1', 'N2'])
  })

  it('entiende la forma de la BD (is_active) y la de dominio (is_archived)', () => {
    expect(isArchivedPlan({ is_archived: true })).toBe(true)
    expect(isArchivedPlan({ is_active: false })).toBe(true)
    expect(isArchivedPlan({ is_active: true })).toBe(false)
    // Sin ninguna de las dos, se asume activo (no esconder por las dudas).
    expect(isArchivedPlan({})).toBe(false)
  })
})

describe('orden de las etapas', () => {
  it('campañas SIEMPRE al final', () => {
    expect(STAGE_ORDER).toEqual(['niveles', 'inicial', 'intermedia', 'avanzada', 'campaña'])
    expect(stageRank('campaña')).toBeGreaterThan(stageRank('avanzada'))
  })

  it('una etapa desconocida va al final, nunca en medio', () => {
    expect(stageRank('inventada')).toBeGreaterThanOrEqual(STAGE_ORDER.length)
    expect(stageRank(null)).toBeGreaterThanOrEqual(STAGE_ORDER.length)
  })

  it('REGRESIÓN: una campaña no se cuela entre dos avanzados', () => {
    // El bug: CDEB y CDC se empujaban al fondo de TODA la lista antes de mirar
    // la etapa, así que las campañas quedaban entre HER y esos dos.
    const planes = [
      { code: 'HER', stage: 'avanzada', is_archived: false },
      { code: 'CAMP1', stage: 'campaña', is_archived: false },
      { code: 'CDEB', stage: 'avanzada', is_archived: false },
      { code: 'CDC', stage: 'avanzada', is_archived: false },
      { code: 'N1', stage: 'niveles', is_archived: false },
    ]
    const orden = [...planes].sort(byStageThenArchived).map(p => p.stage)
    // Todas las avanzadas antes de cualquier campaña.
    expect(orden.lastIndexOf('avanzada')).toBeLessThan(orden.indexOf('campaña'))
    expect(orden[0]).toBe('niveles')
    expect(orden[orden.length - 1]).toBe('campaña')
  })

  it('los desactivados van al final, por encima del orden de etapa', () => {
    const planes = [
      { code: 'VIEJO_N1', stage: 'niveles', is_archived: true },
      { code: 'CAMP1', stage: 'campaña', is_archived: false },
    ]
    expect([...planes].sort(byStageThenArchived).map(p => p.code)).toEqual(['CAMP1', 'VIEJO_N1'])
  })
})

// ── La guía tiene que decir lo mismo que el catálogo ─────────────────────────

describe('el camino del estudiante (guía) coincide con las etapas reales', () => {
  it('Discípulos 1 es de etapa INTERMEDIA, no inicial', async () => {
    const { STUDY_CATALOG } = await import('@/data/study-catalog')
    const dis1 = STUDY_CATALOG.find(s => s.code === 'DIS1')
    expect(dis1?.stage).toBe('intermedia')

    // La infografía lo ponía en la etapa inicial (reportado 2026-08-06).
    const { readFileSync } = await import('node:fs')
    const svg = readFileSync('public/ayuda/infografias/camino-del-estudiante.svg', 'utf8')
    const bloqueInicial = svg.slice(svg.indexOf('Etapa inicial'), svg.indexOf('Etapa intermedia'))
    expect(bloqueInicial).not.toMatch(/Discípulos/)

    const bloqueIntermedia = svg.slice(svg.indexOf('Etapa intermedia'))
    expect(bloqueIntermedia).toMatch(/Discípulos 1/)
  })
})
