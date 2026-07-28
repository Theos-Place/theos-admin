import { describe, it, expect } from 'vitest'
import { summarizeStageRequirements, minimalMissingPrerequisites } from './stage-requirements-summary'
import type { RequirementsStatus } from '@/lib/studies/eligibility'

const name = (code: string) => ({ N1: 'Nivel 1', N2: 'Nivel 2', N4: 'Nivel 4', DIS1: 'Discípulos 1' }[code] ?? code)
const r = (req: Partial<RequirementsStatus>, is_eligible = false) => ({
  is_eligible,
  requirements: { missing_prerequisite: null, ...req } as RequirementsStatus,
})

describe('summarizeStageRequirements (MAT-1)', () => {
  it('gateways que piden N2 y N4 → muestra solo el mínimo (N2)', () => {
    const s = summarizeStageRequirements([
      r({ missing_prerequisite: 'N2' }),
      r({ missing_prerequisite: 'N4' }),
    ], name)
    expect(s.missing.map(i => i.label)).toEqual(['Completar Nivel 2'])
  })

  it('cadenas distintas muestran su mínimo cada una', () => {
    const s = summarizeStageRequirements([
      r({ missing_prerequisite: 'N4' }),
      r({ missing_prerequisite: 'DIS1' }),
    ], name)
    expect(s.missing.map(i => i.label).sort()).toEqual(['Completar Discípulos 1', 'Completar Nivel 4'])
  })

  it('compromisos repetidos entre estudios aparecen UNA vez', () => {
    const s = summarizeStageRequirements([
      r({ donor: false, server: false, attendance: false, attendance_detail: 'Al menos 12 charlas…' }),
      r({ donor: false, server: false, attendance: false, attendance_detail: 'Al menos 12 charlas…' }),
    ], name)
    expect(s.missing.map(i => i.key)).toEqual(['donor', 'server', 'attendance'])
    expect(s.missing.find(i => i.key === 'attendance')?.detail).toContain('12 charlas')
  })

  it('compromiso cumplido va a "Ya cumplís"; el detalle largo no es ítem principal', () => {
    const s = summarizeStageRequirements([
      r({ donor: true, server: false, attendance: true }),
    ], name)
    expect(s.met.map(i => i.key).sort()).toEqual(['attendance', 'donor'])
    expect(s.missing.map(i => i.key)).toEqual(['server'])
  })

  it('los prerequisitos de estudios ya elegibles no ensucian el resumen', () => {
    const s = summarizeStageRequirements([
      r({ missing_prerequisite: 'N2' }, true), // elegible: no cuenta
      r({ donor: false }),
    ], name)
    expect(s.missing.map(i => i.key)).toEqual(['donor'])
  })

  it('minimalMissingPrerequisites deja pasar códigos fuera de cadena', () => {
    expect(minimalMissingPrerequisites(['N3', 'N2', 'SCJ'])).toEqual(['N2', 'SCJ'])
  })
})
