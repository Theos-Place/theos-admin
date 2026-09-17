/**
 * GRU-3 · Lo que devuelve el DETALLE DE GRUPO según quién pregunta.
 *
 * Se compone lo mismo que hace el GET de /api/studies/groups/[id]:
 * groupViewerScope() decide el alcance y recortarRoster() arma el payload. Los
 * asserts son sobre la RESPUESTA, no sobre la pantalla — esconder una columna
 * en la UI no esconde el dato, que viaja igual en el JSON.
 */
import { describe, it, expect } from 'vitest'
import { groupViewerScope } from '@/lib/auth/studies-scope'
import { recortarRoster, permisosDelRoster, type FilaDeRoster } from './roster-por-alcance'
import { hasModulePermission } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

const GRUPO = { leader_id: 'dirigente-1', co_leader_id: 'co-1' }
const ROSTER: FilaDeRoster[] = [
  { id: 'e1', member_id: 'ana', status: 'enrolled', grade: 90, notes: 'aprobado',
    member: { first_name: 'Ana', last_name: 'Solís', phone: '8888-8888', birth_date: '1990-09-14' } },
  { id: 'e2', member_id: 'beto', status: 'enrolled', grade: null, notes: null,
    member: { first_name: 'Beto', last_name: 'Mora', phone: '7777-7777', birth_date: '1985-03-02' } },
]

/** Lo que el endpoint devolvería para esta sesión. */
function respuesta(input: { roles: RoleId[]; memberId: string | null; isEnrolled: boolean }) {
  const scope = groupViewerScope({ ...input, group: GRUPO })
  return { scope, enrollments: recortarRoster(ROSTER, scope) }
}

describe('el ESTUDIANTE', () => {
  const estudiante = { roles: ['miembro'] as RoleId[], memberId: 'ana', isEnrolled: true }

  it('ve a sus compañeros, con nombre', () => {
    const r = respuesta(estudiante)
    expect(r.scope).toBe('member')
    expect(r.enrollments).toHaveLength(2)
    expect(r.enrollments[1].member?.first_name).toBe('Beto')
  })

  it('NO recibe teléfonos', () => {
    for (const e of respuesta(estudiante).enrollments) {
      expect(e.member && 'phone' in e.member, e.member_id).toBe(false)
    }
  })

  it('NO recibe cumpleaños', () => {
    for (const e of respuesta(estudiante).enrollments) {
      expect(e.member && 'birth_date' in e.member, e.member_id).toBe(false)
    }
  })

  it('NO recibe notas ni evaluaciones de nadie', () => {
    for (const e of respuesta(estudiante).enrollments) {
      expect('grade' in e, e.member_id).toBe(false)
      expect('notes' in e, e.member_id).toBe(false)
    }
  })

  it('no ve el tab de asistencia', () => {
    expect(permisosDelRoster(respuesta(estudiante).scope).verAsistencia).toBe(false)
  })
})

describe('el DIRIGENTE (y el co-dirigente)', () => {
  for (const [quien, memberId] of [['dirigente', 'dirigente-1'], ['co-dirigente', 'co-1']] as const) {
    it(`${quien}: recibe teléfono y cumpleaños`, () => {
      const r = respuesta({ roles: ['dirigente'], memberId, isEnrolled: false })
      expect(r.scope).toBe('leader')
      expect(r.enrollments[0].member?.phone).toBe('8888-8888')
      expect(r.enrollments[0].member?.birth_date).toBe('1990-09-14')
    })
  }

  it('pero NUNCA el enlace al perfil', () => {
    expect(permisosDelRoster('leader').verPerfil).toBe(false)
  })

  it('y el servidor le niega el perfil de un miembro', () => {
    // El endpoint del perfil exige módulo `miembros` más allá de 'own' cuando no
    // es el propio ni el de la familia. Ser dirigente no alcanza: por eso el
    // enlace se quitó, no era una decisión estética.
    expect(hasModulePermission(['dirigente'], 'miembros', 'view', { beyondOwn: true })).toBe(false)
  })
})

describe('la GESTIÓN queda intacta', () => {
  it('ve todo, incluidos los datos nuevos y el perfil', () => {
    const r = respuesta({ roles: ['coordinador_estudios'], memberId: 'otro', isEnrolled: false })
    expect(r.scope).toBe('admin')
    expect(r.enrollments[0].member?.phone).toBe('8888-8888')
    expect(r.enrollments[0].grade).toBe(90)
    expect(permisosDelRoster('admin').verPerfil).toBe(true)
    expect(hasModulePermission(['coordinador_estudios'], 'miembros', 'view', { beyondOwn: true })).toBe(true)
  })
})

describe('quien no tiene nada que ver con el grupo', () => {
  it('no recibe la lista', () => {
    const r = respuesta({ roles: ['miembro'], memberId: 'ajeno', isEnrolled: false })
    expect(r.scope).toBe('none')
    expect(r.enrollments).toEqual([])
  })
})
