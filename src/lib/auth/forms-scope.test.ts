import { describe, it, expect } from 'vitest'
import {
  formViewerScope, hasFormsModule, canExportFormResponses, canEditFormStructure,
} from './forms-scope'
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
