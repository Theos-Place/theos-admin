import { describe, it, expect } from 'vitest'
import { puedeCerrarPorRol, puedeCerrarEsteGrupo, ROLES_QUE_CIERRAN } from './quien-cierra'

const GRUPO = { leader_id: 'danilo', co_leader_id: 'floriana' }

describe('quién puede cerrar un grupo', () => {
  it('coordinación, dirección y admin, cualquier grupo', () => {
    for (const r of ROLES_QUE_CIERRAN) {
      expect(puedeCerrarEsteGrupo({ roles: [r], memberId: 'otra', grupo: GRUPO }), r).toBe(true)
    }
  })

  it('el DIRIGENTE puede cerrar el suyo, aunque no tenga rol de coordinación', () => {
    // El caso que estaba roto: Floriana es co-dirigente de su grupo
    // prematrimonial y sus roles son `dirigente` y `lider_comite`. Podía
    // cerrar —el endpoint de cierre sí lo contemplaba— pero recibía 403 al
    // cargar las parejas, porque esa lista se había escrito aparte.
    expect(puedeCerrarEsteGrupo({
      roles: ['dirigente', 'lider_comite'], memberId: 'floriana', grupo: GRUPO,
    })).toBe(true)
    expect(puedeCerrarEsteGrupo({
      roles: ['dirigente'], memberId: 'danilo', grupo: GRUPO,
    })).toBe(true)
  })

  it('pero NO el grupo de otro', () => {
    expect(puedeCerrarEsteGrupo({
      roles: ['dirigente'], memberId: 'ajena', grupo: GRUPO,
    })).toBe(false)
  })

  it('sin grupo cargado, no se asume que sí', () => {
    expect(puedeCerrarEsteGrupo({
      roles: ['dirigente'], memberId: 'floriana', grupo: null,
    })).toBe(false)
  })

  it('sin sesión, no', () => {
    expect(puedeCerrarEsteGrupo({ roles: [], memberId: null, grupo: GRUPO })).toBe(false)
  })

  it('el rol solo, sin mirar el grupo, es otra pregunta', () => {
    expect(puedeCerrarPorRol(['dirigente'])).toBe(false)
    expect(puedeCerrarPorRol(['admin'])).toBe(true)
  })
})
