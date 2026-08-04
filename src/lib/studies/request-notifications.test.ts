import { describe, it, expect } from 'vitest'
import {
  selectStudyRequestRecipients, STUDY_REQUEST_NOTIFY_ROLES, type RoleRow,
} from './request-notifications'

const row = (p: Partial<RoleRow> & { member_id: string; role: string }): RoleRow => ({
  role_active: true, member_active: true, ...p,
})

describe('selectStudyRequestRecipients', () => {
  it('notifica a coordinadores, dirección y admin', () => {
    const rows = STUDY_REQUEST_NOTIFY_ROLES.map((r, i) => row({ member_id: `m${i}`, role: r }))
    expect(selectStudyRequestRecipients(rows).sort()).toEqual(rows.map(r => r.member_id).sort())
  })

  it('un miembro SIN roles no recibe nada (bug 2026-08-04)', () => {
    // El solicitante sin roles no aparece en member_roles: no hay filas suyas.
    expect(selectStudyRequestRecipients([])).toEqual([])
    // Y si tuviera un rol cualquiera que no sea de coordinación, tampoco.
    for (const r of ['miembro', 'dirigente', 'folletos', 'editor_grupos_estudio', 'comunicaciones', 'finanzas']) {
      expect(selectStudyRequestRecipients([row({ member_id: 'danilo', role: r })])).toEqual([])
    }
  })

  it('ignora roles inactivos y miembros inactivos', () => {
    expect(selectStudyRequestRecipients([
      row({ member_id: 'a', role: 'coordinador_estudios', role_active: false }),
      row({ member_id: 'b', role: 'coordinador_dirigentes', member_active: false }),
    ])).toEqual([])
  })

  it('deduplica a quien tiene varios roles de la lista', () => {
    expect(selectStudyRequestRecipients([
      row({ member_id: 'a', role: 'coordinador_estudios' }),
      row({ member_id: 'a', role: 'admin' }),
    ])).toEqual(['a'])
  })

  it('excluye al solicitante aunque sea coordinador (no se avisa a sí mismo)', () => {
    const rows = [
      row({ member_id: 'coord', role: 'coordinador_estudios' }),
      row({ member_id: 'otro', role: 'admin' }),
    ]
    expect(selectStudyRequestRecipients(rows, { excludeMemberId: 'coord' })).toEqual(['otro'])
  })
})
