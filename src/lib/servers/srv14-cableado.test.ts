import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SERVICE_APPLICATIONS_ROLES, GESTIONAN_APLICACIONES } from '@/lib/auth/service-applications'
import { rolesGrantedByPosition } from '@/lib/servers/position-roles'
import { nombreDelArchivo, lineasDelDetalle, detalleEnHtml } from '@/lib/servers/detalle-del-aplicante'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const RUTA = 'src/app/api/servers/applications/[id]/route.ts'
const NOTIFY = 'src/lib/email/application-notify.ts'

describe('SRV-14 · quién entra', () => {
  const ctx = (title: string) => ({
    title, areaName: 'Comité de Servidores', parentAreaName: 'Area de Staff',
    areaType: 'committee' as const,
  })

  it('los dos puestos del catálogo dan el rol', () => {
    // Los nombres se verificaron en la base: no llevan los «de» del pedido.
    expect(rolesGrantedByPosition(ctx('Colaborador Aplicaciones'))).toContain('aplicaciones_servicio')
    expect(rolesGrantedByPosition(ctx('Colaborador Seguimiento'))).toContain('aplicaciones_servicio')
  })

  it('y los otros puestos del mismo comité, no', () => {
    for (const t of ['Colaborador Atracción', 'Colaborador Solicitud Puestos', 'Colaborador Serv. nuevos']) {
      expect(rolesGrantedByPosition(ctx(t)), t).not.toContain('aplicaciones_servicio')
    }
  })

  it('VER la bandeja y GESTIONARLA no son la misma lista', () => {
    // `direccion` ve pero no gestiona: aceptar da de alta a alguien con
    // permisos, y su acceso es de lectura.
    expect(SERVICE_APPLICATIONS_ROLES).toContain('direccion')
    expect(GESTIONAN_APLICACIONES).not.toContain('direccion')
    // Y el rol nuevo hace las dos cosas: es quien hace el trabajo.
    expect(SERVICE_APPLICATIONS_ROLES).toContain('aplicaciones_servicio')
    expect(GESTIONAN_APLICACIONES).toContain('aplicaciones_servicio')
  })
})

describe('SRV-14 · el cambio de estado', () => {
  const src = sinComentarios(RUTA)

  it('valida el body con zod: antes el status entraba crudo hasta la base', () => {
    expect(src).toContain('bodySchema.safeParse')
    expect(src).toContain('z.enum(APPLICATION_STATES)')
  })

  it('y la transición con la regla pura', () => {
    expect(src).toContain('motivoQueImpideCambiar')
  })

  it('lee el detalle ANTES de mover el estado', () => {
    // Al aceptar, el RPC toca varias tablas: leerlo después sería notificar
    // un mundo distinto del que se leyó.
    // Se comparan las LLAMADAS y no la primera mención: la línea del import
    // nombra `setApplicationStatus` antes, y el guard daba rojo al revés.
    expect(src.indexOf('await getDetalleDeAplicante('))
      .toBeLessThan(src.indexOf('await setApplicationStatus('))
  })

  it('TODO cambio queda en audit_log', () => {
    expect(src).toContain('logAudit')
    expect(src).toContain("oldData: { status: anterior }")
  })

  it('los avisos salen de la regla y no de ifs sueltos', () => {
    expect(src).toContain('avisosDe(status)')
  })

  it('el motivo solo viaja donde tiene sentido', () => {
    expect(src).toContain('admiteMotivo(status)')
  })
})

describe('SRV-14 · a la persona que aplicó NO se le escribe', () => {
  it('los avisos son internos: al encargado, a RH y al staff', () => {
    // Un rechazo o una aceptación automática por correo reemplazan mal una
    // conversación que tiene que tener alguien.
    const src = sinComentarios(NOTIFY)
    expect(src).toContain('getEncargadosDeComite')
    expect(src).toContain('CORREO_RH')
    expect(src).not.toContain('applicant')
  })

  it('le manda a TODOS los encargados del comité, no a uno', () => {
    // Matrimonios tiene cuatro; mandarlo a uno es mandarlo a quien capaz ya
    // no está a cargo (lección de SRV-5).
    const src = sinComentarios(NOTIFY)
    expect(src).toMatch(/for \(const m of gente\)/)
  })
})

describe('SRV-14 · el detalle de la persona', () => {
  const d = {
    nombre: 'Ana Rojas', telefono: '8888-8888', correo: 'ana@x.cr',
    puesto: 'Logística', comite: 'Sede Escazú',
    ultimoEstudio: 'Nivel 4', dirigente: 'Beto Mora', telefonoDirigente: '7777-7777',
  }

  it('lleva el teléfono del dirigente, que es el punto de la hoja', () => {
    const lineas = lineasDelDetalle(d)
    expect(lineas.map(([k]) => k)).toContain('Teléfono del dirigente')
    expect(Object.fromEntries(lineas)['Teléfono del dirigente']).toBe('7777-7777')
  })

  it('lo que falta dice «No registrado» y no queda en blanco', () => {
    const vacio = Object.fromEntries(lineasDelDetalle({ ...d, telefonoDirigente: null }))
    expect(vacio['Teléfono del dirigente']).toBe('No registrado')
  })

  it('el archivo se llama «[puesto] - [persona]»', () => {
    expect(nombreDelArchivo('Logística', 'Ana Rojas')).toBe('Logística - Ana Rojas.pdf')
  })

  it('y no genera una ruta cuando el puesto trae una barra', () => {
    // «Logística / Montaje» habría hecho que la descarga saliera con un nombre
    // roto o fallara.
    expect(nombreDelArchivo('Logística / Montaje', 'Ana Rojas'))
      .toBe('Logística - Montaje - Ana Rojas.pdf')
  })

  it('el HTML del correo escapa lo que escribió una persona', () => {
    expect(detalleEnHtml({ ...d, nombre: '<script>x</script>' }))
      .not.toContain('<script>')
  })
})
