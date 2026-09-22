import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { groupViewerScope } from '@/lib/auth/studies-scope'
import type { RoleId } from '@/types/auth'

/**
 * Pasar lista es el trabajo del DIRIGENTE.
 *
 * Reportado el 2026-09-22: una dirigente marcaba la asistencia de su propio
 * grupo, tocaba Guardar y recibía "No se pudo guardar la asistencia". El guard
 * exigía coordinador/dirección y venía del barrido `00b55074`, que le puso
 * roles a todos los endpoints mutantes de una pasada y acá dejó afuera justo a
 * la persona para la que existe la pantalla.
 */
const RUTA = 'src/app/api/studies/groups/[id]/attendance/route.ts'
const SRC = readFileSync(RUTA, 'utf8')
/** Sin comentarios: el porqué del arreglo CITA el guard viejo. */
const CODIGO = SRC.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
const DIRIGENTE: RoleId[] = ['miembro', 'dirigente']
const YO = 'mem-1'

describe('quién puede pasar lista', () => {
  it('el dirigente de ESE grupo', () => {
    expect(groupViewerScope({
      roles: DIRIGENTE, memberId: YO,
      group: { leader_id: YO, co_leader_id: null }, isEnrolled: false,
    })).toBe('leader')
  })

  it('y el codirigente', () => {
    expect(groupViewerScope({
      roles: DIRIGENTE, memberId: YO,
      group: { leader_id: 'otro', co_leader_id: YO }, isEnrolled: false,
    })).toBe('leader')
  })

  it('NO el dirigente de otro grupo', () => {
    expect(groupViewerScope({
      roles: DIRIGENTE, memberId: YO,
      group: { leader_id: 'otro', co_leader_id: null }, isEnrolled: false,
    })).toBe('none')
  })

  it('NO un estudiante inscrito', () => {
    // Estar en el grupo no es dirigirlo. Por eso el endpoint pasa
    // `isEnrolled: false`: la inscripción no entra en esta decisión.
    expect(groupViewerScope({
      roles: DIRIGENTE, memberId: YO,
      group: { leader_id: 'otro', co_leader_id: null }, isEnrolled: true,
    })).toBe('member')
  })

  it('las coordinaciones pueden en cualquiera', () => {
    for (const r of ['coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin'] as RoleId[]) {
      expect(groupViewerScope({
        roles: [r], memberId: YO,
        group: { leader_id: 'otro', co_leader_id: null }, isEnrolled: false,
      }), r).toBe('admin')
    }
  })
})

describe('el endpoint resuelve el permiso CONTRA EL GRUPO', () => {
  it('no vuelve a la lista de roles sueltos', () => {
    // Si alguien lo devuelve a requireRoles(...), la dirigente queda afuera
    // otra vez y el síntoma es el mismo: marcar la lista y no poder guardarla.
    expect(CODIGO).toContain('groupViewerScope(')
    expect(CODIGO).not.toContain("requireRoles('coordinador_estudios'")
  })

  it('y niega con 403 cuando el alcance no alcanza', () => {
    expect(SRC).toContain("alcance !== 'admin' && alcance !== 'leader'")
    expect(SRC).toContain('403')
  })

  it('estar inscrito no cuenta', () => {
    expect(SRC).toContain('isEnrolled: false')
  })
})
