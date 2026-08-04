// La validación del paso "dirigente" NO cambió con el reordenamiento visual de
// 2026-08-04 (la casilla de disponibilidad se movió junto al dirigente). Este
// test es justamente para eso: que el rediseño no la haya aflojado.
import { describe, it, expect } from 'vitest'
import { canAdvanceLeaderStep, leaderStepHint, type LeaderStepState } from './leader-step'

const state = (o: Partial<LeaderStepState> = {}): LeaderStepState => ({
  selectedLeader: '', confirmed: false, pendingLeader: false, ...o,
})

describe('canAdvanceLeaderStep', () => {
  it('sin dirigente no se avanza', () => {
    expect(canAdvanceLeaderStep(state())).toBe(false)
  })

  it('con dirigente pero SIN confirmar tampoco', () => {
    expect(canAdvanceLeaderStep(state({ selectedLeader: 'd1' }))).toBe(false)
  })

  it('marcar "confirmado" sin dirigente no alcanza', () => {
    // El caso que el orden viejo hacía fácil de provocar.
    expect(canAdvanceLeaderStep(state({ confirmed: true }))).toBe(false)
  })

  it('dirigente + confirmado → se avanza', () => {
    expect(canAdvanceLeaderStep(state({ selectedLeader: 'd1', confirmed: true }))).toBe(true)
  })

  it('"dejar pendiente" avanza siempre, sin dirigente ni confirmación', () => {
    expect(canAdvanceLeaderStep(state({ pendingLeader: true }))).toBe(true)
  })
})

describe('leaderStepHint', () => {
  it('dice qué falta en cada caso', () => {
    expect(leaderStepHint(state())).toContain('seleccioná un dirigente')
    expect(leaderStepHint(state({ selectedLeader: 'd1' }))).toContain('confirmá que el dirigente')
  })

  it('sin nada pendiente, no hay aviso', () => {
    expect(leaderStepHint(state({ selectedLeader: 'd1', confirmed: true }))).toBeNull()
    expect(leaderStepHint(state({ pendingLeader: true }))).toBeNull()
  })
})
