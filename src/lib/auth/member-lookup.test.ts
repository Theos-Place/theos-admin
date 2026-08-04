// Buscadores de personas: quién puede usar cuál (auditoría 2026-08-04).
//
// El bug era siempre el mismo: la pantalla pegaba a GET /api/members —que exige
// el PADRÓN (módulo miembros más allá de 'own')— desde un rol acotado que no lo
// tiene. La caja de búsqueda aparecía y no devolvía a nadie nunca.
//
// Ahora hay dos niveles y este test fija cuál le toca a cada rol:
//   · /api/members        → el padrón: filtros, paginado, export. Módulo miembros.
//   · /api/members/lookup → elegir a una persona: nombre, cédula y correo de
//                           gente activa, tope 20. Cualquier rol de GESTIÓN.
import { describe, it, expect } from 'vitest'
import { ROLES, hasModulePermission, hasManagementRole } from './roles'
import type { RoleId } from '@/types/auth'

/** Espejo del guard de GET /api/members. */
const puedeElPadron = (r: RoleId) => hasModulePermission([r], 'miembros', 'view', { beyondOwn: true })
/** Espejo del guard de GET /api/members/lookup. */
const puedeElLookup = (r: RoleId) => hasManagementRole([r])

describe('quién puede el padrón completo', () => {
  it('los roles acotados NO pueden', () => {
    for (const r of ['reportes', 'folletos', 'revision_pagos', 'becas',
      'editor_grupos_estudio', 'forms', 'encargado_eventos'] as RoleId[]) {
      expect(puedeElPadron(r)).toBe(false)
    }
  })

  it('el miembro y el dirigente tampoco (alcance own)', () => {
    expect(puedeElPadron('miembro')).toBe(false)
    expect(puedeElPadron('dirigente')).toBe(false)
  })

  it('sí pueden las coordinaciones, staff, comunicaciones, finanzas y dirección', () => {
    for (const r of ['coordinador_estudios', 'coordinador_dirigentes', 'coordinador_servidores',
      'encargado_staff', 'comunicaciones', 'finanzas', 'editor_perfiles', 'lider_comite',
      'direccion', 'admin', 'solo_lectura'] as RoleId[]) {
      expect(puedeElPadron(r)).toBe(true)
    }
  })
})

describe('quién puede el buscador de gestión (/api/members/lookup)', () => {
  it('los roles que tenían el buscador roto ahora sí pueden', () => {
    // encargado_eventos hace check-in; becas asigna becas;
    // editor_grupos_estudio agrega gente a un grupo; forms da accesos.
    for (const r of ['encargado_eventos', 'becas', 'editor_grupos_estudio', 'forms'] as RoleId[]) {
      expect(puedeElPadron(r)).toBe(false)   // sigue sin el padrón
      expect(puedeElLookup(r)).toBe(true)    // pero puede elegir a una persona
    }
  })

  it('el rol miembro NO puede: no gestiona nada', () => {
    expect(puedeElLookup('miembro')).toBe(false)
  })

  it('cualquier otro rol del catálogo puede', () => {
    for (const r of ROLES) {
      if (r.id === 'miembro') continue
      expect(puedeElLookup(r.id)).toBe(true)
    }
  })
})
