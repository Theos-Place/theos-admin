// GRU-3 · El contacto del dirigente no se le manda a quien no gestiona el grupo.
import { describe, it, expect } from 'vitest'
import { stripLeaderContact, canSeeLeaderContact } from './leader-contact'

const GRUPO = {
  id: 'g1',
  name: 'N1 — Centro',
  leader: { first_name: 'Ana', last_name: 'Mora', phone: '88888888', email: 'ana@x.com' },
  co_leader: { first_name: 'Luis', last_name: 'Soto', phone: '77777777', email: 'luis@x.com' },
}

describe('quién puede ver el contacto', () => {
  it('quien gestiona el grupo, sí', () => {
    expect(canSeeLeaderContact('admin')).toBe(true)
    expect(canSeeLeaderContact('leader')).toBe(true)
  })

  it('un estudiante del grupo, NO', () => {
    expect(canSeeLeaderContact('member')).toBe(false)
    expect(canSeeLeaderContact('none')).toBe(false)
    expect(canSeeLeaderContact(null)).toBe(false)
  })
})

describe('stripLeaderContact', () => {
  const limpio = stripLeaderContact(GRUPO)

  it('borra teléfono y correo de los dos', () => {
    expect(limpio.leader.phone).toBeNull()
    expect(limpio.leader.email).toBeNull()
    expect(limpio.co_leader.phone).toBeNull()
    expect(limpio.co_leader.email).toBeNull()
  })

  it('el NOMBRE se conserva: el estudiante sí sabe quién lo dirige', () => {
    expect(limpio.leader.first_name).toBe('Ana')
    expect(limpio.co_leader.last_name).toBe('Soto')
    expect(limpio.name).toBe('N1 — Centro')
  })

  it('no muta el original', () => {
    expect(GRUPO.leader.phone).toBe('88888888')
  })

  it('aguanta un grupo sin dirigente asignado', () => {
    const sinDirigente = stripLeaderContact({ leader: null, co_leader: undefined })
    expect(sinDirigente.leader).toBeNull()
    expect(sinDirigente.co_leader).toBeUndefined()
  })
})
