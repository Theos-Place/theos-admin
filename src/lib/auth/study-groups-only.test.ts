// Matriz de acceso del rol acotado 'editor_grupos_estudio' (bug 2026-08-04:
// gestionaba grupos pero no veía el listado, y a la vez le aparecían secciones
// de coordinación que no le tocan). Las tres capas —sidebar, ModuleGuard de las
// páginas y guards de API— se apoyan en estas funciones puras, así que el test
// fija la regla en un solo lugar.
import { describe, it, expect } from 'vitest'
import {
  isStudyGroupsOnly, hasModulePermission, GROUP_ADMIN_ROLES, STUDY_ADMIN_ROLES,
} from './roles'
import { studiesViewScope, studyGroupsOnlyAllows } from './studies-scope'
import type { RoleId } from '@/types/auth'

const ROLE: RoleId[] = ['editor_grupos_estudio']

describe('isStudyGroupsOnly', () => {
  it('el rol solo → true', () => {
    expect(isStudyGroupsOnly(ROLE)).toBe(true)
    expect(isStudyGroupsOnly(['miembro', 'editor_grupos_estudio'])).toBe(true)
  })

  it('con un rol de estudios completo o solo_lectura → false (ve todo por ese otro rol)', () => {
    for (const r of [...STUDY_ADMIN_ROLES, 'solo_lectura' as RoleId]) {
      expect(isStudyGroupsOnly(['editor_grupos_estudio', r])).toBe(false)
    }
  })

  it('sin el rol → false', () => {
    expect(isStudyGroupsOnly(['coordinador_estudios'])).toBe(false)
    expect(isStudyGroupsOnly(['dirigente'])).toBe(false)
    expect(isStudyGroupsOnly([])).toBe(false)
    expect(isStudyGroupsOnly(null)).toBe(false)
  })
})

describe('matriz de acceso · editor_grupos_estudio', () => {
  it('VE el listado de grupos: módulo estudios más allá de own', () => {
    // Es la condición que exige el listado (GROUPS_LIST_ROLES lo incluye vía
    // GROUP_ADMIN_ROLES) y la que usa el sidebar para mostrar el módulo.
    expect(hasModulePermission(ROLE, 'estudios', 'view', { beyondOwn: true })).toBe(true)
    expect(studiesViewScope(ROLE)).toBe('all')
  })

  it('GESTIONA grupos: está en GROUP_ADMIN_ROLES (crear/editar/eliminar)', () => {
    expect(GROUP_ADMIN_ROLES).toContain('editor_grupos_estudio')
  })

  it('NO es admin de estudios: fuera de STUDY_ADMIN_ROLES', () => {
    expect(STUDY_ADMIN_ROLES).not.toContain('editor_grupos_estudio')
  })

  it('rutas permitidas: solo el listado y el detalle de un grupo', () => {
    for (const p of [
      '/estudios/grupos',
      '/estudios/grupos/11111111-1111-1111-1111-111111111111',
      '/estudios/grupos/11111111-1111-1111-1111-111111111111/asistencia',
    ]) {
      expect(studyGroupsOnlyAllows(p)).toBe(true)
    }
  })

  it('rutas negadas: resumen, plan, bloques, dirigentes, análisis, solicitudes, folletos, importar', () => {
    for (const p of [
      '/estudios',
      '/estudios/plan',
      '/estudios/bloques',
      '/estudios/dirigentes',
      '/estudios/analisis',
      '/estudios/solicitudes',
      '/estudios/folletos',
      '/estudios/importar',
    ]) {
      expect(studyGroupsOnlyAllows(p)).toBe(false)
    }
  })

  it('no tiene folletos ni ningún otro módulo del sistema', () => {
    for (const m of ['folletos', 'miembros', 'reportes', 'revision_pagos', 'comunicaciones', 'formularios']) {
      expect(hasModulePermission(ROLE, m, 'view')).toBe(false)
    }
  })

  it('no crea ni exporta a nivel de módulo estudios (el CRUD de grupos va por rol explícito)', () => {
    expect(hasModulePermission(ROLE, 'estudios', 'create')).toBe(false)
    expect(hasModulePermission(ROLE, 'estudios', 'export')).toBe(false)
  })
})
