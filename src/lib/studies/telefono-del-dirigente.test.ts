import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { puedeVerTelefonoDelDirigente, recortarTelefonos } from './telefono-del-dirigente'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const RUTA = 'src/app/api/studies/groups/route.ts'

/** Los roles que pueden listar grupos (`GROUPS_LIST_ROLES`). */
const LISTAN_GRUPOS = [
  'coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin',
  'editor_grupos_estudio', 'dirigente', 'finanzas', 'comunicaciones', 'solo_lectura',
]

describe('quién ve el teléfono del dirigente en el listado', () => {
  it('quien ya tiene el padrón completo, sí', () => {
    for (const r of ['admin', 'direccion', 'coordinador_estudios', 'coordinador_dirigentes',
                     'finanzas', 'comunicaciones']) {
      expect(puedeVerTelefonoDelDirigente([r, 'miembro']), r).toBe(true)
    }
  })

  it('`solo_lectura` también — su permiso es un COMODÍN', () => {
    /**
     * Esto se afirma porque se falló al deducirlo: `solo_lectura` declara
     * `{ module: 'all', scope: 'all' }` («ver todo el sistema, sin editar
     * nada»), que un grep de `module: 'miembros'` no encuentra. La primera
     * versión de este archivo daba por hecho que quedaba afuera.
     */
    expect(puedeVerTelefonoDelDirigente(['solo_lectura', 'miembro'])).toBe(true)
  })

  it('el dirigente NO: tiene el padrón con alcance propio', () => {
    expect(puedeVerTelefonoDelDirigente(['dirigente', 'miembro'])).toBe(false)
  })

  it('ni el editor de grupos', () => {
    expect(puedeVerTelefonoDelDirigente(['editor_grupos_estudio', 'miembro'])).toBe(false)
  })

  it('ni un miembro a secas, ni sin roles', () => {
    expect(puedeVerTelefonoDelDirigente(['miembro'])).toBe(false)
    expect(puedeVerTelefonoDelDirigente([])).toBe(false)
    expect(puedeVerTelefonoDelDirigente(null)).toBe(false)
    expect(puedeVerTelefonoDelDirigente(undefined)).toBe(false)
  })

  it('EXACTAMENTE dos de los nueve que listan grupos quedan afuera', () => {
    // Si alguien suma un rol a GROUPS_LIST_ROLES, esto NO se cae solo —
    // pero el número deja escrito lo que se midió el 2026-09-30, así que la
    // próxima persona compara contra un dato y no contra una suposición.
    const afuera = LISTAN_GRUPOS.filter(r => !puedeVerTelefonoDelDirigente([r, 'miembro']))
    expect(afuera.sort()).toEqual(['dirigente', 'editor_grupos_estudio'])
  })
})

describe('el recorte quita el campo, no lo pone en null', () => {
  const grupos = [
    { id: 'a', leader: { first_name: 'Dora', phone: '8000-0001' }, co_leader: { phone: '8000-0002' } },
    { id: 'b', leader: null, co_leader: undefined },
  ]

  it('a quien no le toca, el campo NO viaja', () => {
    const out = recortarTelefonos(grupos, false)
    // `in` y no `=== undefined`: un `phone: null` se leería como «no tiene
    // teléfono», que es otra afirmación y es falsa.
    expect('phone' in (out[0].leader as object)).toBe(false)
    expect('phone' in (out[0].co_leader as object)).toBe(false)
    expect(JSON.stringify(out)).not.toContain('8000-0001')
  })

  it('el resto de los datos del dirigente se queda', () => {
    const out = recortarTelefonos(grupos, false)
    expect((out[0].leader as { first_name: string }).first_name).toBe('Dora')
  })

  it('un grupo sin dirigente no rompe', () => {
    const out = recortarTelefonos(grupos, false)
    expect(out[1].leader).toBeNull()
    expect(out[1].co_leader).toBeUndefined()
  })

  it('a quien sí le toca, llega igual', () => {
    expect(recortarTelefonos(grupos, true)).toEqual(grupos)
  })

  it('no muta la lista original', () => {
    recortarTelefonos(grupos, false)
    expect(grupos[0].leader?.phone).toBe('8000-0001')
  })
})

describe('el recorte vive en el SERVIDOR y cubre TODAS las salidas', () => {
  const api = sinComentarios(RUTA)

  it('las cuatro ramas que devuelven grupos lo aplican', () => {
    /**
     * El endpoint tiene cuatro salidas con grupos —`include=enrollments`,
     * `all=1`, la histórica sin params y la paginada— y recortar tres de
     * cuatro es no recortar: basta con que alguien pida por la que falta.
     */
    expect(api.split('recortarTelefonos(').length - 1).toBe(4)
  })

  it('se decide con la función, no con una lista de roles a mano', () => {
    expect(api).toContain('puedeVerTelefonoDelDirigente(auth.ctx.roles)')
  })

  it('el recorte opera sobre la forma de la BASE, no sobre el plano', () => {
    // El endpoint devuelve `leader.phone` anidado; el aplanado a
    // `leader_phone` lo hace el adaptador en el CLIENTE, o sea después.
    // Recortar el nombre plano no habría quitado nada.
    const mod = sinComentarios('src/lib/studies/telefono-del-dirigente.ts')
    expect(mod).toContain('sinTel(g.leader)')
    expect(mod).toContain('sinTel(g.co_leader)')
  })
})

describe('la columna del export', () => {
  const pag = sinComentarios('src/app/(admin)/estudios/grupos/page.tsx')

  it('existe y es seleccionable', () => {
    expect(pag).toContain("key: 'leader_phone', label: 'Teléfono del dirigente'")
  })

  it('NO viene marcada por defecto: es un dato de contacto', () => {
    const col = pag.slice(pag.indexOf("key: 'leader_phone'"))
    expect(col.slice(0, 120)).toContain('defaultVisible: false')
  })

  it('y la consulta de la lista trae el teléfono, o la columna saldría vacía', () => {
    const q = sinComentarios('src/lib/supabase/queries/studies.ts')
    const sel = q.slice(q.indexOf('const LIST_GROUP_SELECT'), q.indexOf('const LIST_GROUP_MEMBERS_SELECT'))
    expect(sel).toContain('leader:members!study_groups_leader_id_fkey(first_name, last_name, phone)')
  })
})
