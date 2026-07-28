import { describe, it, expect } from 'vitest'
import { hasModulePermission } from './roles'
import type { RoleId } from '@/types/auth'

// REV-3: la página unificada de pagos (/finanzas/pagos y GET
// /api/finance/payments) se autoriza con any-of ['finanzas','revision_pagos'].
// Estos tests fijan la matriz de acceso por rol y la semántica any-of de
// hasModulePermission (la lógica que ejecuta requireModuleView server-side).

const UNIFIED_PAYMENTS = ['finanzas', 'revision_pagos']

describe('acceso a la página unificada de pagos (REV-3)', () => {
  const canView = (...roles: RoleId[]) => hasModulePermission(roles, UNIFIED_PAYMENTS, 'view')

  it('los roles de revisión ven todos los pagos sin el módulo finanzas', () => {
    expect(canView('revision_pagos')).toBe(true)
    expect(canView('folletos')).toBe(true)
    expect(canView('coordinador_dirigentes')).toBe(true)
    expect(canView('coordinador_estudios')).toBe(true)
  })

  it('finanzas, direccion y admin ven la página', () => {
    expect(canView('finanzas')).toBe(true)
    expect(canView('direccion')).toBe(true)
    expect(canView('admin')).toBe(true)
  })

  it('solo_lectura ve (módulo all) pero no puede revisar', () => {
    expect(canView('solo_lectura')).toBe(true)
    expect(hasModulePermission(['solo_lectura'], 'revision_pagos', 'edit')).toBe(false)
  })

  it('un miembro común NO ve la página', () => {
    expect(canView('miembro')).toBe(false)
    expect(canView('dirigente')).toBe(false)
    expect(canView('becas')).toBe(false)
    expect(canView('encargado_eventos')).toBe(false)
  })

  it('las acciones de revisión siguen exigiendo revision_pagos:edit', () => {
    const canReview = (...roles: RoleId[]) => hasModulePermission(roles, 'revision_pagos', 'edit')
    expect(canReview('revision_pagos')).toBe(true)
    expect(canReview('folletos')).toBe(true)
    expect(canReview('finanzas')).toBe(true)
    expect(canReview('miembro')).toBe(false)
    expect(canReview('becas')).toBe(false)
  })

  it('multi-rol: alcanza con que UN rol otorgue el permiso', () => {
    expect(canView('miembro', 'revision_pagos')).toBe(true)
    expect(canView('miembro', 'dirigente')).toBe(false)
  })
})

describe('hasModulePermission — semántica general', () => {
  it('beyondOwn excluye permisos con scope own', () => {
    // miembro tiene miembros:view scope 'own' — no autoriza el padrón.
    expect(hasModulePermission(['miembro'], 'miembros', 'view')).toBe(true)
    expect(hasModulePermission(['miembro'], 'miembros', 'view', { beyondOwn: true })).toBe(false)
  })

  it('acepta módulo único (retro-compatible con las rutas existentes)', () => {
    expect(hasModulePermission(['finanzas'], 'finanzas', 'view')).toBe(true)
    expect(hasModulePermission(['revision_pagos'], 'finanzas', 'view')).toBe(false)
  })

  it('roles vacíos o desconocidos no otorgan nada', () => {
    expect(hasModulePermission([], UNIFIED_PAYMENTS, 'view')).toBe(false)
  })
})
