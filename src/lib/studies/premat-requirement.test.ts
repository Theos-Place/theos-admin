import { describe, it, expect } from 'vitest'
import { meetsPrematRequirementFromCodes } from './premat-requirement'

describe('meetsPrematRequirementFromCodes (PRE-5)', () => {
  it('N1 completado + N2 inscrito (enrolled) → pasa', () => {
    expect(meetsPrematRequirementFromCodes(['N1'], ['N2'])).toBe(true)
  })

  it('N1 completado sin N2 → falla', () => {
    expect(meetsPrematRequirementFromCodes(['N1'], [])).toBe(false)
    // waitlist/pendiente_de_pago no entran en enrolledCodes: quien arma la
    // lista solo mete status 'enrolled', así que acá simplemente no aparece.
    expect(meetsPrematRequirementFromCodes(['N1'], ['DIS1'])).toBe(false)
  })

  it('N2 completado → pasa (implica N1, regla vieja sigue pasando)', () => {
    expect(meetsPrematRequirementFromCodes(['N2'], [])).toBe(true)
  })

  it('nivel posterior completado implica los anteriores', () => {
    expect(meetsPrematRequirementFromCodes(['N3'], [])).toBe(true)
    expect(meetsPrematRequirementFromCodes(['N4'], [])).toBe(true)
  })

  it('sin N1 aunque esté inscrito en N2 → falla', () => {
    expect(meetsPrematRequirementFromCodes([], ['N2'])).toBe(false)
  })

  it('sin nada → falla', () => {
    expect(meetsPrematRequirementFromCodes([], [])).toBe(false)
  })
})
