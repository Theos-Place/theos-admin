import { describe, it, expect } from 'vitest'
import { groupLocksLeader, shouldAutoActivateLeader, CAMPAIGN_LEVEL } from './leader-activation'

describe('leader-activation (EST-1)', () => {
  it('asignar dirigente inactivo a grupo normal → se activa', () => {
    expect(shouldAutoActivateLeader('niveles', false)).toBe(true)
    expect(shouldAutoActivateLeader('etapa_inicial', null)).toBe(true)
  })

  it('asignar dirigente inactivo a grupo de campaña → sigue inactivo', () => {
    expect(shouldAutoActivateLeader(CAMPAIGN_LEVEL, false)).toBe(false)
  })

  it('dirigente ya activo no requiere activación', () => {
    expect(shouldAutoActivateLeader('niveles', true)).toBe(false)
  })

  it('bloqueo de desactivación: campañas no amarran, el resto sí', () => {
    expect(groupLocksLeader(CAMPAIGN_LEVEL)).toBe(false)
    expect(groupLocksLeader('niveles')).toBe(true)
    expect(groupLocksLeader('etapa_intermedia')).toBe(true)
    // plan sin level conocido: conservador, amarra.
    expect(groupLocksLeader(null)).toBe(true)
  })
})
