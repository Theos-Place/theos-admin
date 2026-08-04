import { describe, it, expect } from 'vitest'
import {
  accountState, ACCOUNT_STATE_LABEL, ACCOUNT_STATE_ACTION, type AccountState,
} from './account-state'

describe('accountState', () => {
  it('sin usuario de Auth → "Sin cuenta"', () => {
    expect(accountState({ authUserId: null, lastSignInAt: null })).toBe('none')
    // Aunque por lo que sea traiga un last_sign_in_at colgado: sin usuario, no hay cuenta.
    expect(accountState({ authUserId: null, lastSignInAt: '2026-08-01T10:00:00Z' })).toBe('none')
    expect(accountState({ authUserId: undefined, lastSignInAt: undefined })).toBe('none')
  })

  it('con usuario y sin ningún ingreso → "Nunca ha entrado" (el caso normal hoy)', () => {
    expect(accountState({ authUserId: 'u1', lastSignInAt: null })).toBe('never_entered')
    expect(accountState({ authUserId: 'u1', lastSignInAt: undefined })).toBe('never_entered')
  })

  it('con al menos un ingreso → "Activa"', () => {
    expect(accountState({ authUserId: 'u1', lastSignInAt: '2026-08-01T10:00:00Z' })).toBe('active')
  })

  it('tener usuario creado NO alcanza para contar como activa', () => {
    // AUTH-1 creó 18.101 cuentas en lote: si "tiene usuario" marcara activo, se
    // perdería la métrica de adopción (quién nunca ha entrado).
    expect(accountState({ authUserId: 'u1', lastSignInAt: null })).not.toBe('active')
  })

  it('cada estado tiene etiqueta, y solo el activo no pide acción', () => {
    for (const s of ['none', 'never_entered', 'active'] as AccountState[]) {
      expect(ACCOUNT_STATE_LABEL[s]).toBeTruthy()
    }
    expect(ACCOUNT_STATE_LABEL.never_entered).toBe('Nunca ha entrado')
    expect(ACCOUNT_STATE_ACTION.none).toBeTruthy()
    expect(ACCOUNT_STATE_ACTION.never_entered).toBeTruthy()
    expect(ACCOUNT_STATE_ACTION.active).toBeNull()
  })
})
