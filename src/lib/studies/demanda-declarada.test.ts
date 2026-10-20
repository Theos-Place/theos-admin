import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  zonasDeSolicitud, agruparDemanda, dirigentesParaCluster, puedeDarPlan, tendenciaSemanal, lunesDe,
  etiquetaDeZona, etapaDelCluster, SIN_ZONA, CUALQUIER_ZONA, UMBRAL_ACCIONABLE, type Solicitud, type DirigenteParaDemanda,
} from './demanda-declarada'
import { prellenadoDesdeDemanda, urlDeNuevoGrupo, diaComoLetra } from './grupo-desde-demanda'

const SEDES = [
  { code: 'escazu', name: 'Escazú' },
  { code: 'heredia', name: 'Heredia' },
  { code: 'cartago', name: 'Sede Cartago' },
]

let n = 0
const sol = (o: Partial<Solicitud> = {}): Solicitud => ({
  id: `s${++n}`, fuente: 'interes', memberId: `m${n}`, nombre: `Persona ${n}`, email: null, telefono: null,
  planCode: 'N1', zonas: ['escazu'], zonaTexto: null, dias: ['Lunes'], franja: 'noche',
  creada: '2026-10-01T12:00:00Z', estado: 'open', grupoPropuestoId: null, ...o,
})

describe('EST-29 · la zona de cada solicitud', () => {
  it('interés: el NOMBRE de la sede se traduce a su código, sin importar tildes', () => {
    expect(zonasDeSolicitud({ proposed_location: 'escazu' }, SEDES)).toEqual({ zonas: ['escazu'], texto: null })
    expect(zonasDeSolicitud({ proposed_location: 'Escazú' }, SEDES).zonas).toEqual(['escazu'])
  })

  it('con o sin «Sede» adelante', () => {
    expect(zonasDeSolicitud({ proposed_location: 'Cartago' }, SEDES).zonas).toEqual(['cartago'])
    expect(zonasDeSolicitud({ proposed_location: 'Sede Cartago' }, SEDES).zonas).toEqual(['cartago'])
  })

  it('texto libre que no es una zona: NO se adivina, queda el texto', () => {
    expect(zonasDeSolicitud({ proposed_location: 'Virtual, vive en Estados Unidos.' }, SEDES))
      .toEqual({ zonas: [], texto: 'Virtual, vive en Estados Unidos.' })
  })

  it('reubicación: ya viene en código, y «Cualquiera» se respeta', () => {
    expect(zonasDeSolicitud({ proposed_zones: ['escazu', 'heredia'] }, SEDES).zonas).toEqual(['escazu', 'heredia'])
    expect(zonasDeSolicitud({ proposed_zones: ['Cualquiera'] }, SEDES).zonas).toEqual([CUALQUIER_ZONA])
  })
})

describe('EST-29 · los clústeres', () => {
  it('mismo plan + misma zona → un clúster; otro plan o zona → otro', () => {
    const c = agruparDemanda([sol(), sol(), sol({ zonas: ['heredia'] }), sol({ planCode: 'N2' })])
    expect(c.find(x => x.planCode === 'N1' && x.zona === 'escazu')?.personas).toHaveLength(2)
    expect(c.find(x => x.planCode === 'N1' && x.zona === 'heredia')?.personas).toHaveLength(1)
    expect(c.find(x => x.planCode === 'N2')?.personas).toHaveLength(1)
  })

  it('se ordenan por tamaño', () => {
    const c = agruparDemanda([sol({ zonas: ['heredia'] }), sol(), sol()])
    expect(c[0].zona).toBe('escazu')
  })

  it(`el umbral (${UMBRAL_ACCIONABLE}+) marca los que se pueden abrir`, () => {
    const n = (k: number) => Array.from({ length: k }, () => sol())
    expect(UMBRAL_ACCIONABLE).toBe(5)
    expect(agruparDemanda(n(4))[0].accionable).toBe(false)
    expect(agruparDemanda(n(5))[0].accionable).toBe(true)
    expect(agruparDemanda(n(2), 2)[0].accionable).toBe(true)
  })

  it('tres etapas: 5+ listos, de 2 a 4 potencialmente, 1 aún no (2026-10-20)', () => {
    const n = (k: number, o: Partial<Solicitud> = {}) => Array.from({ length: k }, () => sol(o))
    expect(etapaDelCluster(agruparDemanda(n(1))[0])).toBe('aun_no')
    expect(etapaDelCluster(agruparDemanda(n(2))[0])).toBe('potencial')
    expect(etapaDelCluster(agruparDemanda(n(4))[0])).toBe('potencial')
    expect(etapaDelCluster(agruparDemanda(n(5))[0])).toBe('listo')
    // «Otra zona» con cinco no se puede abrir: no se sabe dónde.
    expect(etapaDelCluster(agruparDemanda(n(5, { zonas: [], zonaTexto: 'Grecia' }))[0])).toBe('potencial')
  })

  it('«Otra zona» nunca es accionable: no se sabe dónde abrir', () => {
    const c = agruparDemanda([1, 2, 3, 4].map(() => sol({ zonas: [], zonaTexto: 'Grecia' })))
    expect(c[0].zona).toBe(SIN_ZONA)
    expect(c[0].accionable).toBe(false)
  })

  it('quien pidió dos zonas cuenta en las dos', () => {
    const c = agruparDemanda([sol({ zonas: ['escazu', 'heredia'] })])
    expect(c.map(x => x.zona).sort()).toEqual(['escazu', 'heredia'])
  })

  it('las capacitaciones van solo por plan, sin zona', () => {
    const c = agruparDemanda([sol({ planCode: 'SCJ', zonas: ['escazu'] }), sol({ planCode: 'SCJ', zonas: ['heredia'] })])
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ esCapacitacion: true, zona: null })
    expect(etiquetaDeZona(null, {})).toBe('Centralizada')
  })

  it('días y franja más pedidos, para prellenar el grupo', () => {
    const c = agruparDemanda([sol({ dias: ['Martes'] }), sol({ dias: ['Martes', 'Lunes'] }), sol({ dias: ['Jueves'], franja: 'tarde' })])
    expect(c[0].diasMasPedidos[0]).toBe('Martes')
    expect(c[0].franjaMasPedida).toBe('noche')
  })
})

describe('EST-29 · el cruce con dirigentes disponibles', () => {
  const dir = (o: Partial<DirigenteParaDemanda>): DirigenteParaDemanda => ({ memberId: 'd', nombre: 'D', disponible: true, puedeDar: ['N1'], zonas: [], ...o })

  it('disponible + puede dar el plan + su zona (o sin preferencia)', () => {
    const lista = [
      dir({ memberId: 'a', nombre: 'Ana', zonas: ['escazu'] }),
      dir({ memberId: 'b', nombre: 'Beto', zonas: [] }),
      dir({ memberId: 'c', nombre: 'Caro', zonas: ['heredia'] }),
      dir({ memberId: 'e', nombre: 'Eva', disponible: false }),
      dir({ memberId: 'f', nombre: 'Fede', puedeDar: ['DIS2'] }),
    ]
    expect(dirigentesParaCluster({ planCode: 'N1', zona: 'escazu' }, lista).map(d => d.nombre)).toEqual(['Ana', 'Beto'])
  })

  it('dar un Nivel habilita para todos los Niveles', () => {
    expect(puedeDarPlan({ puedeDar: ['N3'] }, 'N1')).toBe(true)
    expect(puedeDarPlan({ puedeDar: ['N3'] }, 'DIS2')).toBe(false)
  })

  it('en capacitaciones no se filtra por zona', () => {
    expect(dirigentesParaCluster({ planCode: 'SCJ', zona: null }, [dir({ puedeDar: ['SCJ'], zonas: ['heredia'] })])).toHaveLength(1)
  })

  it('la disponibilidad sale de la regla del reporte (dirigiendo incluido), no de la ficha a secas', () => {
    const q = readFileSync('src/lib/supabase/queries/demanda-declarada.ts', 'utf8')
    expect(q).toContain('disponibilidadEfectiva({')
    expect(q).toContain('ocupaAlDirigente(plan?.code)')
  })
})

describe('EST-29 · la tendencia', () => {
  it('cuenta por semana (lunes) y por plan', () => {
    const t = tendenciaSemanal([
      { planCode: 'N1', creada: '2026-10-13T10:00:00Z' },
      { planCode: 'N1', creada: '2026-10-15T10:00:00Z' },
      { planCode: 'SCJ', creada: '2026-10-06T10:00:00Z' },
    ], new Date('2026-10-16T12:00:00Z'), 4)
    expect(lunesDe('2026-10-15T10:00:00Z')).toBe('2026-10-12')
    expect(t.semanas.at(-1)).toBe('2026-10-12')
    expect(t.porPlan[0]).toMatchObject({ planCode: 'N1', total: 2 })
  })
})

describe('EST-29 · abrir el grupo desde un clúster', () => {
  it('la URL lleva plan, zona, día, franja y las solicitudes', () => {
    const u = urlDeNuevoGrupo({ planCode: 'N1', zona: 'escazu', diasMasPedidos: ['Martes'], franjaMasPedida: 'noche', solicitudes: ['a'] })
    expect(u).toBe('/estudios/grupos/nuevo?plan=N1&zona=escazu&dia=M&franja=noche&solicitudes=a')
  })

  it('«Otra zona» no se manda como zona', () => {
    expect(urlDeNuevoGrupo({ planCode: 'N1', zona: SIN_ZONA, diasMasPedidos: [], franjaMasPedida: null, solicitudes: [] })).toBe('/estudios/grupos/nuevo?plan=N1')
  })

  it('el prellenado ignora lo que no entiende', () => {
    const p = prellenadoDesdeDemanda(new URLSearchParams('plan=N1&zona=__otra__&dia=Miércoles&franja=noche&solicitudes=no-es-uuid,11111111-1111-1111-1111-111111111111'))
    expect(p).toEqual({ plan: 'N1', zona: null, dia: 'X', hora: '19:00', solicitudes: ['11111111-1111-1111-1111-111111111111'] })
    expect(prellenadoDesdeDemanda(new URLSearchParams(''))).toBeNull()
    expect(diaComoLetra('sábado')).toBe('S')
  })

  it('al crear, vincula SOLO solicitudes abiertas y no resuelve ni matricula', () => {
    const q = readFileSync('src/lib/supabase/queries/demanda-declarada.ts', 'utf8')
    const f = q.slice(q.indexOf('export async function vincularSolicitudesAGrupo'))
    expect(f).toContain(".in('status', ESTADOS_ABIERTOS)")
    expect(f).not.toMatch(/resolveStudyRequest|enrollMember|status: 'resolved'/)
    const ruta = readFileSync('src/app/api/studies/groups/route.ts', 'utf8')
    // request_ids NO llega a createGroup (no es columna del grupo).
    expect(ruta).toContain('const { study_type_id, request_ids, enrollment_restrictions: rawRestriction, ...rest } = parsed.data')
  })
})

describe('EST-29 · solo el equipo de estudios', () => {
  it('los dos endpoints exigen STUDY_ADMIN_ROLES', () => {
    for (const r of ['src/app/api/studies/demand-clusters/route.ts', 'src/app/api/studies/demand-clusters/export/route.ts']) {
      expect(readFileSync(r, 'utf8')).toContain('requireRoles(...STUDY_ADMIN_ROLES)')
    }
  })

  it('el panel y la pestaña de Solicitudes usan el mismo gate', () => {
    expect(readFileSync('src/components/studies/DemandaDeclaradaPanel.tsx', 'utf8')).toContain('(STUDY_ADMIN_ROLES as string[]).includes(r)')
    const solicitudes = readFileSync('src/app/(admin)/estudios/solicitudes/page.tsx', 'utf8')
    expect(solicitudes).toContain('(STUDY_ADMIN_ROLES as string[]).includes(r)')
    expect(solicitudes).toContain("{ key: 'demanda', label: 'Análisis de demanda' }")
  })

  it('la ruta vieja redirige a la pestaña y ya no está en el menú (2026-10-20)', () => {
    expect(readFileSync('src/app/(admin)/estudios/demanda/page.tsx', 'utf8')).toContain("redirect('/estudios/solicitudes?tab=demanda')")
    expect(readFileSync('src/components/layout/Sidebar.tsx', 'utf8')).not.toContain("href: '/estudios/demanda'")
  })
})

describe('zona virtual en el interés de estudio (2026-10-20)', () => {
  it('«Virtual» es su propia zona, no «Otra zona»', async () => {
    const { ZONA_VIRTUAL, esZonaVirtual } = await import('./demanda-declarada')
    expect(zonasDeSolicitud({ proposed_location: 'Virtual' }, SEDES)).toEqual({ zonas: [ZONA_VIRTUAL], texto: null })
    expect(esZonaVirtual(' virtual ')).toBe(true)
    expect(etiquetaDeZona(ZONA_VIRTUAL, {})).toBe('Virtual')
    // Un texto libre que MENCIONA virtual sigue siendo «Otra zona»: no se adivina.
    expect(zonasDeSolicitud({ proposed_location: 'Virtual, vive en Estados Unidos.' }, SEDES).zonas).toEqual([])
  })

  it('cualquier dirigente disponible sirve para un grupo virtual', async () => {
    const { ZONA_VIRTUAL } = await import('./demanda-declarada')
    const d = { memberId: 'a', nombre: 'Ana', disponible: true, puedeDar: ['N1'], zonas: ['heredia'] }
    expect(dirigentesParaCluster({ planCode: 'N1', zona: ZONA_VIRTUAL }, [d])).toHaveLength(1)
  })

  it('el formulario pide el porqué solo con virtual, y el servidor lo exige', () => {
    const f = readFileSync('src/components/studies/StudyRequestActions.tsx', 'utf8')
    expect(f).toContain("{zoneSel === 'virtual' && (")
    expect(f).toContain('¿Por qué te sirve virtual?')
    const api = readFileSync('src/app/api/studies/requests/route.ts', 'utf8')
    expect(api).toContain('esVirtual && reason.length < MIN_RAZON_VIRTUAL')
    expect(api).toContain("reason: body.request_type === 'relocation' || esVirtual ? reason : null")
  })
})
