import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  hasModulePermission, isDirigentesOnly, isStudyGroupsOnly, DIRIGENTES_ADMIN_ROLES,
} from '@/lib/auth/roles'
import { dirigentesOnlyAllows } from '@/lib/auth/studies-scope'
import { rolesGrantedByPosition, type PositionContext } from '@/lib/servers/position-roles'
import type { RoleId } from '@/types/auth'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const enComiteDirigentes = (title: string, areaName = 'Comité Dirigentes Administrativo'): PositionContext =>
  ({ title, areaName, areaType: 'committee', parentAreaName: 'Area Enseñanza' })

/**
 * ROL-1 · `editor_dirigentes`, el rol acotado que reemplaza a
 * `coordinador_dirigentes` en quien solo actualiza datos.
 *
 * El problema medido el 2026-09-30: siete personas tenían el rol de
 * COORDINACIÓN, que abre 58 endpoints —planes de estudio, evaluaciones de
 * dirigentes y, hasta ese día, la cola de pagos—. Tres de ellas solo tenían
 * que mantener datos al día, y ninguna registraba una sola acción.
 */
describe('qué abre el rol nuevo', () => {
  it('el módulo estudios, para poder entrar a la sección', () => {
    expect(hasModulePermission(['editor_dirigentes'] as RoleId[], 'estudios', 'view')).toBe(true)
  })

  it('pero NO trae crear ni editar a nivel módulo', () => {
    // Mismo molde que `editor_grupos_estudio`: el poder de editar se autoriza
    // por rol explícito en los endpoints, no por el permiso de módulo, y así
    // no se derrama al plan ni a los grupos.
    expect(hasModulePermission(['editor_dirigentes'] as RoleId[], 'estudios', 'create')).toBe(false)
    expect(hasModulePermission(['editor_dirigentes'] as RoleId[], 'estudios', 'delete')).toBe(false)
  })

  it('ni miembros, ni reportes, ni la cola de pagos', () => {
    for (const m of ['miembros', 'reportes', 'revision_pagos', 'finanzas', 'servidores']) {
      expect(hasModulePermission(['editor_dirigentes'] as RoleId[], m, 'view'), m).toBe(false)
    }
  })

  it('y está en la lista que autoriza editar dirigentes', () => {
    expect(DIRIGENTES_ADMIN_ROLES).toContain('editor_dirigentes')
    expect(DIRIGENTES_ADMIN_ROLES).toContain('coordinador_dirigentes')
    expect(DIRIGENTES_ADMIN_ROLES).toContain('admin')
  })
})

describe('el recorte por ruta, que es lo que lo hace acotado', () => {
  it('abre su sección y lo que cuelga de ella', () => {
    expect(dirigentesOnlyAllows('/estudios/dirigentes')).toBe(true)
    expect(dirigentesOnlyAllows('/estudios/dirigentes/abc-123')).toBe(true)
    expect(dirigentesOnlyAllows('/estudios/dirigentes/confirmaciones')).toBe(true)
    expect(dirigentesOnlyAllows('/estudios/dirigentes/disponibilidad')).toBe(true)
  })

  it('y NADA más de estudios', () => {
    /**
     * Sin este recorte el rol se llevaría el módulo entero, porque lleva
     * `estudios:view` para poder entrar. Es exactamente lo que se está
     * quitando, así que si esto se cae el cambio no sirvió de nada.
     */
    for (const r of ['/estudios', '/estudios/grupos', '/estudios/plan', '/estudios/bloques',
                     '/estudios/folletos', '/estudios/evaluaciones', '/estudios/importar',
                     '/estudios/solicitudes']) {
      expect(dirigentesOnlyAllows(r), r).toBe(false)
    }
  })

  it('«dirigentes» como prefijo de otra cosa no cuela', () => {
    expect(dirigentesOnlyAllows('/estudios/dirigentes-reporte')).toBe(false)
  })

  it('el acotado se apaga si además tiene un rol de estudios completo', () => {
    // Karina y Luis Guillermo tienen `coordinador_estudios`: para ellos el
    // recorte no debe aplicar, o les cerraría media sección.
    expect(isDirigentesOnly(['editor_dirigentes'] as RoleId[])).toBe(true)
    expect(isDirigentesOnly(['editor_dirigentes', 'coordinador_estudios'] as RoleId[])).toBe(false)
    expect(isDirigentesOnly(['editor_dirigentes', 'solo_lectura'] as RoleId[])).toBe(false)
    expect(isDirigentesOnly(['coordinador_dirigentes'] as RoleId[])).toBe(false)
  })

  it('y no se pisa con el acotado de grupos', () => {
    expect(isStudyGroupsOnly(['editor_dirigentes'] as RoleId[])).toBe(false)
    expect(isDirigentesOnly(['editor_grupos_estudio'] as RoleId[])).toBe(false)
  })
})

describe('el rol llega por el PUESTO, no a mano', () => {
  it('«Colaborador actualización y datos» del comité de Dirigentes lo otorga', () => {
    // El título se verificó en el catálogo: va sin «de» entre las palabras, y
    // lo ocupan cuatro personas.
    expect(rolesGrantedByPosition(enComiteDirigentes('Colaborador actualización y datos')))
      .toContain('editor_dirigentes')
    expect(rolesGrantedByPosition(enComiteDirigentes('Colaborador actualizacion y datos')))
      .toContain('editor_dirigentes')
  })

  it('en el Comité Dirigentes (no administrativo) también', () => {
    expect(rolesGrantedByPosition(enComiteDirigentes('Colaborador actualización y datos', 'Comité Dirigentes')))
      .toContain('editor_dirigentes')
  })

  it('el MISMO título en otro comité, NO', () => {
    expect(rolesGrantedByPosition(enComiteDirigentes('Colaborador actualización y datos', 'Comité Youth')))
      .not.toContain('editor_dirigentes')
  })

  it('y otros puestos del mismo comité tampoco', () => {
    // El permiso no se reparte por pertenecer al comité — regla de la casa en
    // `position-roles`.
    for (const t of ['Colaborador evaluaciones y retroalimentación', 'Dirigente CR', 'Encargado Dirigentes']) {
      expect(rolesGrantedByPosition(enComiteDirigentes(t)), t).not.toContain('editor_dirigentes')
    }
  })

  it('no se lleva de paso el rol de evaluaciones', () => {
    // Son dos puestos distintos del mismo comité, y cada uno su cosa (RET-1).
    expect(rolesGrantedByPosition(enComiteDirigentes('Colaborador actualización y datos')))
      .not.toContain('evaluaciones')
  })
})

describe('las tres capas dicen lo mismo', () => {
  it('1· el layout recorta las rutas', () => {
    const s = sinComentarios('src/app/(admin)/layout.tsx')
    expect(s).toContain('isDirigentesOnly(user.roles ?? [])')
    expect(s).toContain('!dirigentesOnlyAllows(pathname)')
  })

  it('2· el menú le muestra solo su sección', () => {
    // Sin esto vería el submenú entero y cada enlace lo llevaría a un
    // "Acceso restringido".
    const s = sinComentarios('src/components/layout/Sidebar.tsx')
    expect(s).toContain('isDirigentesOnly(userRoles as RoleId[])')
    expect(s).toContain("const estudiosSub: SubItem[] = dirigentesOnly")
  })

  it('3· los endpoints de dirigentes usan UNA sola lista', () => {
    /**
     * Estaba escrita a mano y repetida en seis rutas, con dos variantes que
     * no coincidían: cuatro incluían `admin` y dos se lo olvidaban. Agregar
     * el rol nuevo fue cambiar un lugar en vez de seis.
     */
    for (const ruta of [
      'src/app/api/studies/dirigentes/route.ts',
      'src/app/api/studies/dirigentes/bulk-status/route.ts',
      'src/app/api/studies/dirigentes/bulk-studies/route.ts',
      'src/app/api/studies/dirigentes/contact/route.ts',
      'src/app/api/studies/leaders/route.ts',
      'src/app/api/studies/leaders/[id]/route.ts',
    ]) {
      const s = sinComentarios(ruta)
      expect(s, ruta).toContain('requireRoles(...DIRIGENTES_ADMIN_ROLES)')
      // La lista vieja no puede sobrevivir en ninguna de las dos variantes.
      expect(s, ruta).not.toContain("requireRoles('admin', 'direccion', 'coordinador_dirigentes'")
      expect(s, ruta).not.toContain("requireRoles('coordinador_estudios', 'coordinador_dirigentes'")
    }
  })
})

describe('la migración', () => {
  // SIN COMENTARIOS: la cabecera explica el CHECK y nombra
  // `coordinador_dirigentes` para decir que NO se toca, así que buscar sobre
  // el archivo crudo se encuentra a sí misma. Pasó al escribir este test.
  const sql = readFileSync('supabase/migrations/20260930180000_rol1_editor_dirigentes.sql', 'utf8')
    .split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n')

  it('amplía el CHECK de member_roles ANTES de otorgar', () => {
    /**
     * La lista de roles vive DOS veces —`types/auth.ts` y esta restricción—,
     * y sin ampliarla el grant falla con 23514. Es una trampa que este
     * esquema ya cobró antes.
     */
    expect(sql).toContain('member_roles_role_check')
    expect(sql.indexOf('member_roles_role_check')).toBeLessThan(sql.indexOf('grant_position_role'))
  })

  it('no reescribe la lista de roles a mano', () => {
    // Sería la tercera copia, y la que se desactualiza.
    expect(sql).toContain('pg_get_constraintdef')
    expect(sql).toContain("replace(v_def, 'ARRAY[',")
  })

  it('otorga con el RPC, para que al dejar el puesto se pierda', () => {
    expect(sql).toContain("grant_position_role(v.member_id, 'editor_dirigentes', v.position_id)")
    expect(sql).not.toMatch(/insert\s+into\s+(public\.)?member_roles/i)
  })

  it('NO quita `coordinador_dirigentes` a nadie', () => {
    /**
     * La parte que quita va aparte, en `scripts/rol1/dry-run.cjs`, porque
     * toca a seis personas y dos pierden la cola de evaluaciones. Regla de la
     * casa: dry-run aprobado antes de un cambio de roles masivo.
     */
    /**
     * La aserción era `not.toContain('coordinador_dirigentes')` y se afinó:
     * el helper de RLS que esta misma migración redefine LISTA ese rol, muy
     * legítimamente. Lo que hay que prohibir no es la palabra, es que la
     * migración ESCRIBA sobre los roles de alguien.
     */
    expect(sql).not.toMatch(/update\s+(public\.)?member_roles/i)
    expect(sql).not.toMatch(/delete\s+from\s+(public\.)?member_roles/i)
    expect(sql).not.toContain('revoke_position_role')
  })
})
