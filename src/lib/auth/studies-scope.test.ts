import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { studiesViewScope, groupViewerScope, evaluadorAllows } from './studies-scope'
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

/**
 * RET-2 (2026-10-29) · El comité de evaluaciones abre el detalle del grupo que
 * le enlaza su tiquete. Eimy —rol `evaluaciones` y nada más— tocaba «Ver el
 * compilado» y caía en «Acceso restringido»: el layout cerraba la ruta y el API
 * contestaba 403 porque su alcance sobre ese grupo era 'none'.
 */
describe('alcance evaluador (RET-2)', () => {
  const group = { leader_id: 'lider-1', co_leader_id: 'co-1' }
  const sinComentarios = (ruta: string): string =>
    readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

  it('evaluaciones sin relación con el grupo → evaluador (no none)', () => {
    expect(groupViewerScope({ roles: ['evaluaciones'], memberId: 'x', group, isEnrolled: false })).toBe('evaluador')
    expect(groupViewerScope({ roles: ['evaluaciones'], memberId: null, group, isEnrolled: false })).toBe('evaluador')
  })

  it('si además dirige ESTE grupo, manda leader; si coordina, admin', () => {
    expect(groupViewerScope({ roles: ['evaluaciones', 'dirigente'], memberId: 'lider-1', group, isEnrolled: false })).toBe('leader')
    expect(groupViewerScope({ roles: ['coordinador_dirigentes'], memberId: 'x', group, isEnrolled: false })).toBe('admin')
  })

  it('solo el detalle del grupo: ni listado, ni asistencia, ni cierre, ni editar', () => {
    const id = '11111111-2222-4333-8444-555555555555'
    expect(evaluadorAllows(`/estudios/grupos/${id}`)).toBe(true)
    for (const r of ['/estudios', '/estudios/grupos', `/estudios/grupos/${id}/asistencia`, `/estudios/grupos/${id}/cierre`, `/estudios/grupos/${id}/editar`, '/estudios/dirigentes']) {
      expect(evaluadorAllows(r), r).toBe(false)
    }
  })

  it('las tres capas lo dicen: layout, API del grupo y pantalla', () => {
    expect(sinComentarios('src/app/(admin)/layout.tsx')).toContain('evaluadorAllows(pathname)')
    const api = sinComentarios('src/app/api/studies/groups/[id]/route.ts')
    expect(api).toContain("scope === 'member' || scope === 'evaluador'")
    expect(api).toContain("recortarRoster(roster, 'member'), viewer_scope: scope")
    const pagina = sinComentarios('src/app/(admin)/estudios/grupos/[id]/page.tsx')
    expect(pagina).toContain("const veCompilado = !readOnly || group?.viewer_scope === 'evaluador'")
    expect(pagina).toContain("group.status === 'finalizado' && veCompilado &&")
  })
})
