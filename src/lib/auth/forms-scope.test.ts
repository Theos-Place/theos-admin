import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  formViewerScope, hasFormsModule, canExportFormResponses, canEditFormStructure,
  formsNavPlacement,
} from './forms-scope'
import { hasModulePermission } from './roles'
import type { RoleId } from '@/types/auth'

const form = { id: 'f1' }
const base = { memberId: 'm1', form, hasGrant: false }

describe('hasFormsModule', () => {
  it('lo tienen el rol forms, comunicaciones, staff, dirección, admin y solo_lectura', () => {
    for (const r of ['forms', 'comunicaciones', 'encargado_staff', 'direccion', 'admin', 'solo_lectura'] as RoleId[]) {
      expect(hasFormsModule([r])).toBe(true)
    }
  })

  it('no lo tienen los demás', () => {
    for (const r of ['miembro', 'dirigente', 'finanzas', 'coordinador_estudios', 'encargado_eventos'] as RoleId[]) {
      expect(hasFormsModule([r])).toBe(false)
    }
    expect(hasFormsModule([])).toBe(false)
    expect(hasFormsModule(null)).toBe(false)
  })
})

describe('formViewerScope', () => {
  it('con el módulo → admin, aunque no tenga acceso puntual', () => {
    expect(formViewerScope({ ...base, roles: ['forms'] })).toBe('admin')
    expect(formViewerScope({ ...base, roles: ['direccion'] })).toBe('admin')
  })

  it('sin módulo pero con acceso a ESE formulario → grantee', () => {
    expect(formViewerScope({ ...base, roles: ['miembro'], hasGrant: true })).toBe('grantee')
  })

  it('sin módulo y sin acceso → none', () => {
    expect(formViewerScope({ ...base, roles: ['miembro'] })).toBe('none')
    expect(formViewerScope({ ...base, roles: [] })).toBe('none')
  })

  it('el acceso puntual necesita miembro vinculado y formulario', () => {
    expect(formViewerScope({ ...base, roles: ['miembro'], memberId: null, hasGrant: true })).toBe('none')
    expect(formViewerScope({ ...base, roles: ['miembro'], form: null, hasGrant: true })).toBe('none')
  })

  it('el grantee exporta pero NO edita la estructura', () => {
    expect(canExportFormResponses('grantee')).toBe(true)
    expect(canEditFormStructure('grantee')).toBe(false)
    expect(canEditFormStructure('admin')).toBe(true)
    expect(canExportFormResponses('none')).toBe(false)
  })
})

describe('formsNavPlacement (bug 2026-08-04: el rol forms no veía la entrada)', () => {
  it('con Comunicaciones → sub-ítem, como siempre', () => {
    for (const r of ['comunicaciones', 'direccion', 'admin'] as RoleId[]) {
      expect(formsNavPlacement({ roles: [r] })).toBe('submenu')
    }
  })

  it('rol forms sin Comunicaciones → entrada de primer nivel', () => {
    expect(formsNavPlacement({ roles: ['forms'] })).toBe('top_level')
    expect(formsNavPlacement({ roles: ['miembro', 'forms'] })).toBe('top_level')
  })

  it('encargado_staff (tiene formularios, no comunicaciones) → primer nivel', () => {
    expect(formsNavPlacement({ roles: ['encargado_staff'] })).toBe('top_level')
  })

  it('acceso puntual sin ningún módulo → entrada de primer nivel', () => {
    expect(formsNavPlacement({ roles: ['miembro'], grantedFormIds: ['f1'] })).toBe('top_level')
  })

  it('sin módulo y sin accesos → sin entrada', () => {
    expect(formsNavPlacement({ roles: ['miembro'] })).toBe('none')
    expect(formsNavPlacement({ roles: ['dirigente'], grantedFormIds: [] })).toBe('none')
    expect(formsNavPlacement({ roles: [] })).toBe('none')
  })
})

describe('matriz de acceso · rol forms', () => {
  const ROLE: RoleId[] = ['forms']

  it('ve el listado y las respuestas de TODOS los formularios', () => {
    expect(hasFormsModule(ROLE)).toBe(true)
    expect(formViewerScope({ roles: ROLE, memberId: 'm1', form, hasGrant: false })).toBe('admin')
  })

  it('crea, edita y exporta', () => {
    for (const accion of ['view', 'create', 'edit', 'export']) {
      expect(hasModulePermission(ROLE, 'formularios', accion)).toBe(true)
    }
  })

  it('NO borra formularios (se lleva las respuestas por delante)', () => {
    expect(hasModulePermission(ROLE, 'formularios', 'delete')).toBe(false)
  })

  it('NO ve comunicaciones: ni plantillas, ni envíos, ni configuración', () => {
    expect(hasModulePermission(ROLE, 'comunicaciones', 'view')).toBe(false)
    expect(formsNavPlacement({ roles: ROLE })).toBe('top_level')
  })

  it('no destapa ningún otro módulo', () => {
    for (const m of ['miembros', 'estudios', 'eventos', 'servidores', 'finanzas', 'reportes', 'empleados']) {
      expect(hasModulePermission(ROLE, m, 'view')).toBe(false)
    }
  })
})

describe('otros roles acotados que dependen de un módulo padre', () => {
  // El sidebar pinta el módulo padre solo con SU permiso; los permisos que viven
  // adentro necesitan una excepción explícita o el rol queda sin puerta de
  // entrada — que es justo lo que le pasó a 'forms'. Estas son las que existen.
  const src = readFileSync('src/components/layout/Sidebar.tsx', 'utf8')

  it('folletos abre Estudios aunque no tenga el módulo', () => {
    expect(src).toContain("can('folletos', 'view')")
  })

  it('revision_pagos y becas abren Finanzas aunque no tengan el módulo', () => {
    expect(src).toContain("can('revision_pagos', 'view')")
    expect(src).toContain("can('becas', 'view')")
  })

  it('formularios tiene entrada propia cuando no hay Comunicaciones', () => {
    expect(src).toContain('formsNavPlacement')
    expect(src).toContain("formsNav === 'top_level'")
  })
})
