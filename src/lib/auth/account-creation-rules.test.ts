import { describe, it, expect } from 'vitest'
import { classifyForAccountCreation, type MemberForAccount } from './account-creation-rules'

function m(over: Partial<MemberForAccount>): MemberForAccount {
  return {
    id: over.id ?? 'x',
    first_name: 'Ana', last_name: 'Mora',
    email: 'ana@example.com',
    auth_user_id: null,
    is_active: true,
    is_system: false,
    email_bounced: false,
    email_complained: false,
    birth_date: '1990-05-10',
    ...over,
  }
}

const NOW = new Date('2026-07-28T12:00:00Z')

describe('classifyForAccountCreation (AUTH-1)', () => {
  it('miembro activo con correo válido y sin cuenta → elegible', () => {
    const r = classifyForAccountCreation([m({ id: 'a' })], NOW)
    expect(r.eligible.map(x => x.id)).toEqual(['a'])
    expect(r.excluded).toEqual([])
  })

  it('idempotente: quien ya tiene auth_user_id queda excluido (correr dos veces no duplica)', () => {
    const antes = classifyForAccountCreation([m({ id: 'a' })], NOW)
    expect(antes.eligible).toHaveLength(1)
    // "segunda corrida": el miembro ya quedó enlazado
    const despues = classifyForAccountCreation([m({ id: 'a', auth_user_id: 'auth-1' })])
    expect(despues.eligible).toHaveLength(0)
    expect(despues.excluded[0].cause).toBe('ya_tiene_cuenta')
  })

  it('exclusiones por causa: sin correo, inválido, inactivo, sistema, rebotado, queja', () => {
    const r = classifyForAccountCreation([
      m({ id: 'sin', email: null }),
      m({ id: 'vacio', email: '   ' }),
      m({ id: 'malo', email: 'no-es-correo' }),
      m({ id: 'inactivo', email: 'i@x.com', is_active: false }),
      m({ id: 'sys', email: 's@x.com', is_system: true }),
      m({ id: 'rebote', email: 'r@x.com', email_bounced: true }),
      m({ id: 'queja', email: 'q@x.com', email_complained: true }),
    ])
    expect(r.eligible).toHaveLength(0)
    const causas = Object.fromEntries(r.excluded.map(e => [e.member.id, e.cause]))
    expect(causas).toEqual({
      sin: 'sin_correo', vacio: 'sin_correo', malo: 'correo_invalido',
      inactivo: 'inactivo', sys: 'sistema', rebote: 'correo_rebotado', queja: 'correo_con_queja',
    })
  })

  it('menores de 12 quedan excluidos; sin fecha de nacimiento se incluye', () => {
    const r = classifyForAccountCreation([
      m({ id: 'nino', email: 'n@x.com', birth_date: '2016-01-15' }),      // 10 años
      m({ id: 'borde', email: 'b@x.com', birth_date: '2014-07-29' }),     // cumple 12 mañana → aún 11
      m({ id: 'doce', email: 'd@x.com', birth_date: '2014-07-28' }),      // cumplió 12 hoy
      m({ id: 'sinfecha', email: 'sf@x.com', birth_date: null }),
    ], NOW)
    expect(r.eligible.map(x => x.id).sort()).toEqual(['doce', 'sinfecha'])
    const causas = Object.fromEntries(r.excluded.map(e => [e.member.id, e.cause]))
    expect(causas).toEqual({ nino: 'menor_de_12', borde: 'menor_de_12' })
  })

  it('correo duplicado entre miembros: ninguno se crea y se listan juntos', () => {
    const r = classifyForAccountCreation([
      m({ id: 'a', email: 'Compartido@X.com' }),
      m({ id: 'b', email: 'compartido@x.com  ' }),
      m({ id: 'c', email: 'unico@x.com' }),
    ])
    expect(r.eligible.map(x => x.id)).toEqual(['c'])
    expect(r.duplicates).toHaveLength(1)
    expect(r.duplicates[0].email).toBe('compartido@x.com')
    expect(r.duplicates[0].members.map(x => x.id).sort()).toEqual(['a', 'b'])
  })

  it('duplicado con un miembro YA enlazado: el otro tampoco se crea (el correo ya existe en Auth)', () => {
    const r = classifyForAccountCreation([
      m({ id: 'viejo', email: 'dup@x.com', auth_user_id: 'auth-9' }),
      m({ id: 'nuevo', email: 'dup@x.com' }),
    ])
    expect(r.eligible).toHaveLength(0)
    const causas = Object.fromEntries(r.excluded.map(e => [e.member.id, e.cause]))
    expect(causas.viejo).toBe('ya_tiene_cuenta')
    expect(causas.nuevo).toBe('correo_duplicado')
  })

  it('la prioridad de causas no tapa el duplicado con exclusiones previas', () => {
    // el rebotado se excluye por rebote, pero el otro con el mismo correo
    // sigue siendo duplicado (crear su cuenta chocaría en Auth si el rebotado
    // se llega a crear después)
    const r = classifyForAccountCreation([
      m({ id: 'rebote', email: 'dup@x.com', email_bounced: true }),
      m({ id: 'limpio', email: 'dup@x.com' }),
    ])
    expect(r.eligible).toHaveLength(0)
    const causas = Object.fromEntries(r.excluded.map(e => [e.member.id, e.cause]))
    expect(causas.limpio).toBe('correo_duplicado')
  })
})
