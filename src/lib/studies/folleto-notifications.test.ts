import { describe, it, expect } from 'vitest'
import { destinatariosDeFolletos, FOLLETO_NOTIFY_ROLES, type FilaDeRol } from './folleto-notifications'
import { ROLES } from '@/lib/auth/roles'

const fila = (p: Partial<FilaDeRol>): FilaDeRol => ({
  member_id: 'm1', role: 'folletos', role_active: true, member_active: true, ...p,
})

describe('destinatariosDeFolletos', () => {
  it('avisa a quien tiene el rol folletos', () => {
    expect(destinatariosDeFolletos([fila({ member_id: 'a' })])).toEqual(['a'])
  })

  it('NO le avisa a solo_lectura — el bug del 2026-09-21', () => {
    // comunicacion@ tiene solo_lectura, que da `module: 'all'` con view y por
    // eso calificaba cuando la audiencia se derivaba de los permisos.
    expect(destinatariosDeFolletos([fila({ member_id: 'comunicacion', role: 'solo_lectura' })])).toEqual([])
  })

  it('tampoco a admin: administrar el sistema no es estar a cargo de folletos', () => {
    expect(destinatariosDeFolletos([fila({ member_id: 'ti', role: 'admin' })])).toEqual([])
  })

  it('ignora el rol revocado y a la persona inactiva', () => {
    expect(destinatariosDeFolletos([
      fila({ member_id: 'a', role_active: false }),
      fila({ member_id: 'b', member_active: false }),
    ])).toEqual([])
  })

  it('no repite a quien tiene el rol dos veces', () => {
    expect(destinatariosDeFolletos([fila({ member_id: 'a' }), fila({ member_id: 'a' })])).toEqual(['a'])
  })

  it('un rol con permiso de ver folletos NO entra solo: hay que agregarlo acá', () => {
    // El candado contra la regresión: si mañana alguien crea un rol con
    // `module: 'all'`, este test sigue en verde y ese rol NO recibe correos.
    const puedenVer = ROLES.filter(r => r.permissions.some(p =>
      (p.module === 'all' || p.module === 'folletos') && (p.actions as string[]).includes('view'))).map(r => r.id)
    expect(puedenVer.length).toBeGreaterThan(FOLLETO_NOTIFY_ROLES.length)
    for (const rol of puedenVer) {
      if (FOLLETO_NOTIFY_ROLES.includes(rol)) continue
      expect(destinatariosDeFolletos([fila({ member_id: 'x', role: rol })]), rol).toEqual([])
    }
  })
})
