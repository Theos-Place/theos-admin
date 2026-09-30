import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  esPuestoDeDirectorDeArea, tituloEsDeDirectorDeArea, nombresDeDirectores,
  TITULO_DIRECTOR_DE_AREA,
} from './director-de-area'
import { rolesGrantedByPosition, type PositionContext } from './position-roles'
import { esPuestoDeEncargado } from './encargados'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const MIGRACION = 'supabase/migrations/20260930170000_director_de_area.sql'

const enArea = (title: string, areaName = 'Area Espiritual'): PositionContext =>
  ({ title, areaName, areaType: 'area', parentAreaName: null })

/**
 * Director de Área · el puesto que está por encima de los comités.
 *
 * NO ES UN CAMPO DE `areas`, y ahí está la decisión. `areas.leader_id` ya
 * existía para los comités: lo llenaban 12 de 44 y en DOS apuntaba a alguien
 * distinto del puesto. SRV-5 lo declaró muerto. Repetir ese campo un nivel
 * más arriba habría reintroducido el mismo problema donde nadie mira.
 */
describe('quién dirige un área', () => {
  it('el título oficial es «Director de Área»', () => {
    expect(TITULO_DIRECTOR_DE_AREA).toBe('Director de Área')
    expect(esPuestoDeDirectorDeArea(enArea('Director de Área'))).toBe(true)
  })

  it('«Director» a secas sigue contando', () => {
    // Es como se llamaban los seis puestos que ya existían. Reconocer de más
    // es barato; reconocer de menos es un permiso que no llega y nadie sabe
    // por qué.
    expect(esPuestoDeDirectorDeArea(enArea('Director'))).toBe(true)
  })

  it('el acento y el «de» dan igual', () => {
    for (const t of ['Director de Area', 'Director Área', 'director de área', '  DIRECTOR  ']) {
      expect(esPuestoDeDirectorDeArea(enArea(t)), t).toBe(true)
    }
  })

  it('admite VARIOS directores', () => {
    // Área Enseñanza tiene dos y está bien (confirmado 2026-09-30). Un diseño
    // de uno solo habría obligado a elegir — el error de `leader_id`, que era
    // una columna única.
    expect(nombresDeDirectores([{ name: 'Luis Guillermo Alonso' }, { name: 'Maria Adelia Piza' }]))
      .toBe('Luis Guillermo Alonso, Maria Adelia Piza')
  })

  it('y ninguno: el puesto existe aunque esté vacante', () => {
    expect(nombresDeDirectores([])).toBe('')
  })
})

describe('lo que NO es un director de área', () => {
  it('«Director Ejecutivo» y «Director General» NO lo son', () => {
    /**
     * Viven en el COMITÉ «Directores» (3 personas, medido el 2026-09-30) y
     * son otro cargo. Por eso la comparación es contra títulos exactos y no
     * por prefijo «director»: un `startsWith` se los habría llevado por
     * delante junto con sus permisos.
     */
    for (const t of ['Director Ejecutivo', 'Director General', 'Directora Ejecutiva']) {
      expect(tituloEsDeDirectorDeArea(t), t).toBe(false)
    }
  })

  it('un «Director» dentro de un COMITÉ tampoco', () => {
    // La condición de `areaType === 'area'` es la que lo impide.
    expect(esPuestoDeDirectorDeArea({
      title: 'Director', areaName: 'Directores', areaType: 'committee', parentAreaName: 'Area Dirección',
    })).toBe(false)
  })

  it('y no se confunde con el encargado de comité', () => {
    // Floriana lo pidió explícito: «desligarlo de algún puesto como encargado
    // de comité». Son dos cargos en dos niveles distintos.
    expect(esPuestoDeEncargado('Director de Área')).toBe(false)
    expect(esPuestoDeDirectorDeArea(enArea('Encargado Comité'))).toBe(false)
  })
})

describe('qué gana el director de área', () => {
  it('el rol `reportes`', () => {
    expect(rolesGrantedByPosition(enArea('Director de Área'))).toContain('reportes')
    expect(rolesGrantedByPosition(enArea('Director'))).toContain('reportes')
  })

  it('pero NO se lo gana un Director Ejecutivo', () => {
    expect(rolesGrantedByPosition({
      title: 'Director General', areaName: 'Directores',
      areaType: 'committee', parentAreaName: 'Area Dirección',
    })).not.toContain('reportes')
  })

  it('ni `lider_comite`: dirigir un área no es encabezar un comité', () => {
    expect(rolesGrantedByPosition(enArea('Director de Área'))).not.toContain('lider_comite')
  })

  it('«Mi comité» le abre TODOS los comités de su área', () => {
    /**
     * Verificado en staging: con el puesto en Área de Comunidad, el endpoint
     * devolvió sus 7 comités; al quitárselo, 403.
     *
     * El detalle que costó: el bucle descartaba `area_type !== 'committee'`
     * ANTES de mirar el puesto, y el del director cuelga de un ÁREA — así que
     * el primer intento no le habría dado acceso a nadie.
     */
    const q = sinComentarios('src/lib/supabase/queries/servers.ts')
    const fn = q.slice(q.indexOf('export async function getComitesQueAbrenMiComite'))
    expect(fn).toContain('esPuestoDeDirectorDeArea({')
    expect(fn).toContain('areasQueDirige')
    // Los comités del área, en UNA consulta y no una por área.
    expect(fn).toContain(".in('parent_id', [...areasQueDirige])")
  })
})

describe('la migración deja el catálogo completo', () => {
  const sql = readFileSync(MIGRACION, 'utf8')

  it('renombra los «Director» de ÁREAS, no los de comités', () => {
    expect(sql).toContain("set title = 'Director de Área'")
    expect(sql).toContain("a.area_type = 'area'")
    expect(sql).toContain("lower(btrim(sp.title)) = 'director'")
  })

  it('crea el puesto en las áreas que no lo tenían, y vacío', () => {
    // Dirección y Sedes. Vacío a propósito: quién las dirige no es una
    // decisión que pueda tomar una migración, y un puesto sin asignar se ve
    // en la pantalla y pide que lo llenen.
    expect(sql).toContain('insert into public.service_positions')
    expect(sql).toContain('not exists (')
    expect(sql).not.toMatch(/insert into public\.volunteers/i)
  })

  it('otorga el rol con el RPC, no con un insert', () => {
    /**
     * Sin este paso la regla no le llega a nadie: el sync corre cuando
     * alguien TOCA una asignación y los 7 directores ya tienen el puesto.
     * Se descubrió PROBÁNDOLO —«Mi comité» abría sus 7 comités y los
     * reportes daban 403—, no leyendo el código.
     */
    expect(sql).toContain("grant_position_role(v.member_id, 'reportes', v.position_id)")
    expect(sql).not.toMatch(/insert\s+into\s+(public\.)?member_roles/i)
  })

  it('y el backfill solo mira áreas y asignaciones vivas', () => {
    const bloque = sql.slice(sql.indexOf('do $$', sql.indexOf('-- 3)')))
    expect(bloque).toContain("a.area_type = 'area'")
    expect(bloque).toContain("vol.status = 'active'")
    expect(bloque).toContain('sp.is_active')
  })
})

describe('se ve en la pantalla de Áreas y comités', () => {
  const pag = sinComentarios('src/app/(admin)/servidores/admin/page.tsx')

  it('la cabecera del área dice quién la dirige', () => {
    expect(pag).toContain('selectedArea.directores')
    expect(pag).toContain('nombresDeDirectores(selectedArea.directores)')
  })

  it('y dice cuando está sin asignar, en vez de dejar la línea vacía', () => {
    // Es el caso de Dirección y Sedes. Una línea en blanco se lee como «no
    // aplica»; el texto se lee como «falta hacerlo».
    expect(pag).toContain('Director de Área sin asignar')
  })

  it('el dato sale del PUESTO, no de un campo de `areas`', () => {
    const org = sinComentarios('src/lib/supabase/queries/org.ts')
    expect(org).toContain('tituloEsDeDirectorDeArea')
    expect(org).toContain("from('service_positions')")
    // El campo muerto no vuelve por la puerta de atrás.
    expect(org).not.toContain('leader_id')
  })
})

describe('se edita desde «Editar área»', () => {
  const pag = sinComentarios('src/app/(admin)/servidores/admin/page.tsx')
  const api = sinComentarios('src/app/api/servers/areas/[id]/director/route.ts')
  const q = sinComentarios('src/lib/supabase/queries/servers.ts')

  it('el modal tiene el campo, con buscador de persona', () => {
    expect(pag).toContain('<MemberCombobox')
    expect(pag).toContain('setDirectores')
  })

  it('los cambios se acumulan y se aplican al GUARDAR', () => {
    /**
     * Es un modal con Guardar y Cancelar. Si el nombre esperara y el director
     * se aplicara al instante, «Cancelar» revertiría la mitad de lo que la
     * persona hizo — y acá la otra mitad es un permiso, no una etiqueta.
     */
    expect(pag).toContain('onSave: (name: string, directores:')
    expect(pag).toContain('onSave(name.trim(), directores)')
  })

  it('y solo se manda si algo cambió', () => {
    // Un PUT con la misma lista no rompe nada, pero deja un registro de
    // auditoría que no corresponde a ningún cambio.
    expect(pag).toContain('if (areaId && antes !== ahora)')
  })

  it('si falla el director, se dice que el ÁREA sí se guardó', () => {
    // Un «no se pudo guardar» a secas haría pensar que se perdió todo.
    expect(pag).toContain('El área se guardó, pero no se pudo cambiar el director.')
  })

  it('el endpoint reemplaza la lista completa, no agrega de a uno', () => {
    // El área puede tener varios directores; una pantalla que manda el estado
    // final no puede desincronizarse con el servidor.
    expect(api).toContain('member_ids: z.array(')
    expect(api).toContain('setDirectoresDeArea(id, memberIds, auth.ctx.userId)')
  })

  it('y un COMITÉ lo rechaza con su motivo', () => {
    expect(api).toContain("message === 'NO_ES_AREA'")
    expect(api).toContain('{ status: 409 }')
  })

  it('pasa por assignVolunteer/removeVolunteer, que sincronizan los roles', () => {
    /**
     * LA PIEZA QUE HACE QUE ESTO FUNCIONE SIN MIGRACIÓN. Un upsert a mano en
     * `volunteers` habría cambiado el puesto y dejado el rol `reportes`
     * pegado — el mismo modo de fallo que obligó a poner un backfill en la
     * migración. Verificado en staging: asignar desde la pantalla otorga el
     * rol y quitar lo revoca, con su fila de `member_role_position_grants`.
     */
    const fn = q.slice(q.indexOf('export async function setDirectoresDeArea'))
    const fin = fn.indexOf('\n}')
    const cuerpo = fn.slice(0, fin)
    expect(cuerpo).toContain('assignVolunteer(positionId, id, actorUserId)')
    expect(cuerpo).toContain('removeVolunteer(positionId, id, actorUserId)')
    expect(cuerpo).not.toMatch(/from\('volunteers'\)\s*\.upsert/)
  })

  it('crea el puesto si el área no lo tiene', () => {
    // La migración lo puso en las ocho que existían, pero la pantalla deja
    // crear áreas nuevas y esas nacerían sin él.
    const fn = q.slice(q.indexOf('export async function setDirectoresDeArea'))
    expect(fn).toContain('TITULO_DIRECTOR_DE_AREA')
    expect(fn).toContain('if (!positionId)')
  })
})
