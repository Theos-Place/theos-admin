import { describe, it, expect } from 'vitest'
import { studiesViewScope, groupViewerScope } from './studies-scope'
import type { RoleId } from '@/types/auth'

describe('studiesViewScope (SEC-1)', () => {
  it('coordinadores/dirección/admin/solo_lectura/editor_grupos → all', () => {
    for (const r of ['coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin', 'solo_lectura', 'editor_grupos_estudio'] as RoleId[]) {
      expect(studiesViewScope([r])).toBe('all')
    }
  })

  it('dirigente → leader (scope own)', () => {
    expect(studiesViewScope(['dirigente'])).toBe('leader')
  })

  it('miembro puro y roles sin estudios → member', () => {
    expect(studiesViewScope(['miembro'])).toBe('member')
    expect(studiesViewScope(['finanzas'])).toBe('member')
    expect(studiesViewScope([])).toBe('member')
  })

  it('multi-rol: dirigente + coordinador gana all', () => {
    expect(studiesViewScope(['dirigente', 'coordinador_estudios'])).toBe('all')
  })
})

describe('groupViewerScope (SEC-1)', () => {
  const group = { leader_id: 'lider-1', co_leader_id: 'co-1' }

  it('admin de estudios → admin aunque no sea del grupo', () => {
    expect(groupViewerScope({ roles: ['coordinador_estudios'], memberId: 'x', group, isEnrolled: false })).toBe('admin')
  })

  it('dirigente DE ESTE grupo (leader o co-leader) → leader', () => {
    expect(groupViewerScope({ roles: ['dirigente'], memberId: 'lider-1', group, isEnrolled: false })).toBe('leader')
    expect(groupViewerScope({ roles: ['dirigente'], memberId: 'co-1', group, isEnrolled: false })).toBe('leader')
  })

  it('dirigente de OTRO grupo sin inscripción → none (no ve roster ajeno)', () => {
    expect(groupViewerScope({ roles: ['dirigente'], memberId: 'otro', group, isEnrolled: false })).toBe('none')
  })

  it('miembro inscrito → member (read-only de su grupo)', () => {
    expect(groupViewerScope({ roles: ['miembro'], memberId: 'est-1', group, isEnrolled: true })).toBe('member')
  })

  it('miembro sin relación → none (grupo sin roster, p. ej. confirmación de matrícula)', () => {
    expect(groupViewerScope({ roles: ['miembro'], memberId: 'est-1', group, isEnrolled: false })).toBe('none')
    expect(groupViewerScope({ roles: ['miembro'], memberId: null, group, isEnrolled: false })).toBe('none')
  })
})
