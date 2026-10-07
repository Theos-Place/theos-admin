import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  PUBLICAN_PUESTOS, ACCIONES_DE_PUESTO, SERVICE_ADMIN_ROLES,
  puedeSolicitarParaCualquierComite, ROLES,
} from './roles'
import { SERVICE_APPLICATIONS_ROLES, canSeeServiceApplications } from './service-applications'
import { rolesGrantedByPosition } from '@/lib/servers/position-roles'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const puesto = (title: string) =>
  ({ title, areaType: 'committee' as const, areaName: 'Comité Servidores', parentAreaName: null })

describe('SRV · un solo rol para los tres puestos del comité', () => {
  it('los TRES títulos dan el MISMO rol', () => {
    /**
     * Antes eran dos roles con permisos idénticos, separados solo por los
     * guards. De esa separación salió el bug: Jazmín Sánchez armaba las
     * solicitudes y no veía el botón de publicar.
     */
    for (const t of ['Colaborador Solicitud Puestos', 'Colaborador Aplicaciones', 'Colaborador Seguimiento']) {
      expect(rolesGrantedByPosition(puesto(t)), t).toContain('puestos_servicio')
    }
  })

  it('los nombres son los del CATÁLOGO, no los del pedido', () => {
    // Los pedidos los llamaban «Colaborador de solicitud de puestos»; en la
    // base están sin los «de». Una regla contra el nombre del pedido no
    // matchea a nadie, y el fallo es silencioso.
    expect(rolesGrantedByPosition(puesto('Colaborador Solicitud Puestos'))).toContain('puestos_servicio')
  })

  it('NO se reparte por pertenecer al comité', () => {
    // Ese comité tiene además Atracción y Servidores Nuevos, que son otros
    // trabajos. Es el modo de fallo que este archivo ya sufrió.
    for (const t of ['Colaborador Atracción', 'Colaborador Servidores Nuevos', 'Servidor']) {
      expect(rolesGrantedByPosition(puesto(t)), t).not.toContain('puestos_servicio')
    }
  })

  it('ni fuera del comité de servidores', () => {
    expect(rolesGrantedByPosition({
      title: 'Colaborador Aplicaciones', areaType: 'committee', areaName: 'Comité Worship', parentAreaName: null,
    })).not.toContain('puestos_servicio')
  })

  it('el rol existe en el catálogo con nombre propio', () => {
    const r = ROLES.find(x => x.id === 'puestos_servicio')
    expect(r, 'falta puestos_servicio en ROLES').toBeTruthy()
    expect(r!.name).toBe('Puestos y aplicaciones de servicio')
  })
})

describe('SRV · el bug de Jazmín: publicar', () => {
  it('el rol del comité AHORA publica', () => {
    // Era la contradicción escrita: el endpoint de solicitudes decía «es la
    // misma gente que va a apretar Publicar» y el de publicar los excluía.
    expect(PUBLICAN_PUESTOS).toContain('puestos_servicio')
  })

  it('y sigue publicando la coordinación', () => {
    for (const r of SERVICE_ADMIN_ROLES) expect(PUBLICAN_PUESTOS, r).toContain(r)
  })

  it('el endpoint usa esa lista, no SERVICE_ADMIN_ROLES a secas', () => {
    const ep = sinComentarios('src/app/api/servers/vacancies/publish/route.ts')
    expect(ep).toContain('requireRoles(...PUBLICAN_PUESTOS)')
  })

  it('ver las solicitudes y publicarlas es la MISMA gente', () => {
    // Si se vuelven a separar, vuelve el bug.
    const req = sinComentarios('src/app/api/servers/vacancies/requests/route.ts')
    expect(req).toContain('PUBLICAN_PUESTOS')
  })
})

describe('SRV · ver las aplicaciones', () => {
  it('el rol unificado las ve', () => {
    expect(canSeeServiceApplications(['puestos_servicio'])).toBe(true)
  })

  it('el viejo sigue aceptado: sus filas quedaron apagadas, no borradas', () => {
    // Cerrarle la puerta a alguien por una fila vieja sería el peor modo de
    // fallo de esta migración.
    expect(SERVICE_APPLICATIONS_ROLES).toContain('aplicaciones_servicio')
    expect(puedeSolicitarParaCualquierComite(['solicitudes_puestos'])).toBe(true)
  })

  it('un rol cualquiera no las ve', () => {
    for (const r of ['miembro', 'dirigente', 'finanzas', 'lider_comite'] as const) {
      expect(canSeeServiceApplications([r]), r).toBe(false)
    }
  })
})

describe('SRV · los tres botones del puesto', () => {
  it('son los cuatro roles que pidió Floriana, y nadie más', () => {
    /**
     * «Ver aplicaciones», «Editar» y «Bajar». Decidido el 2026-10-07: SALEN
     * `lider_comite` y `coordinador_servidores`, que los tenían desde el
     * 25 de setiembre. Es una REDUCCIÓN y se confirmó antes de hacerla.
     */
    expect([...ACCIONES_DE_PUESTO].sort())
      .toEqual(['admin', 'direccion', 'encargado_staff', 'puestos_servicio'])
  })

  it('la pantalla usa esa lista y no una copia', () => {
    const pg = sinComentarios('src/app/(admin)/servidores/puestos/page.tsx')
    expect(pg).toContain('hasRole(...ACCIONES_DE_PUESTO)')
    expect(pg).not.toContain("const PUEDE_GESTIONAR = ['lider_comite'")
  })

  it('SOLICITAR cupos no cambió: sigue siendo del líder de comité', () => {
    // Juntarlo con lo anterior le quitaría a un líder el poder pedir puestos
    // para su gente, que nadie pidió.
    const pg = sinComentarios('src/app/(admin)/servidores/puestos/page.tsx')
    expect(pg).toContain("const PUEDE_SOLICITAR = ['lider_comite', 'coordinador_servidores', 'admin']")
  })
})

describe('SRV · la migración', () => {
  const m = readFileSync('supabase/migrations/20261007100000_srv_unificar_puestos_servicio.sql', 'utf8')

  it('agrega el rol al CHECK LEYENDO el que hay', () => {
    // Reescribir la lista a mano es como se pierde un rol que alguien agregó
    // en el medio.
    expect(m).toContain('pg_get_constraintdef(oid) into v_def')
    expect(m).toContain("position('puestos_servicio' in v_def)")
  })

  it('apaga los viejos en vez de borrarlos', () => {
    expect(m).toContain('set is_active = false')
    expect(m).not.toMatch(/delete\s+from\s+public\.member_roles/i)
  })

  it('no duplica a quien tenía los DOS roles', () => {
    expect(m).toContain('select distinct r.member_id')
    expect(m).toContain('on conflict do nothing')
  })
})
