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

  it('abrir la hoja QUEDA REGISTRADO: es sacar datos personales', () => {
    // Teléfono, correo y con quién llevó su último estudio. Sin registro,
    // «¿quién se llevó la hoja de fulano?» no se contesta. Mismo criterio que
    // el export del padrón.
    const src = sinComentarios('src/app/api/servers/applications/[id]/detalle/route.ts')
    expect(src).toContain('logAudit')
    expect(src).toMatch(/action: 'EXPORT'/)
  })

  it('y no la ve cualquiera con sesión', () => {
    const src = sinComentarios('src/app/api/servers/applications/[id]/detalle/route.ts')
    expect(src).toMatch(/requireRoles\(\.\.\.SERVICE_APPLICATIONS_ROLES\)/)
  })

  it('la hoja usa el CSS de marca y el nombre sale del título del documento', () => {
    // El título ES lo que el navegador propone al guardar como PDF, así que
    // «[puesto] - [persona]» se cumple sin poder forzarlo por cabecera.
    const src = sinComentarios('src/app/(admin)/servidores/aplicaciones/[id]/hoja/page.tsx')
    expect(src).toMatch(/document\.title = `\$\{detalle\.puesto\} - \$\{detalle\.nombre\}`/)
    expect(src).toContain('bg-navy')
    // Los botones NO se imprimen.
    expect(src).toContain('print:hidden')
  })

  it('y el CSS de impresión existe: sin él el PDF sale con el menú', () => {
    expect(readFileSync('src/app/globals.css', 'utf8')).toContain('@media print')
  })

  it('el HTML del correo escapa lo que escribió una persona', () => {
    expect(detalleEnHtml({ ...d, nombre: '<script>x</script>' }))
      .not.toContain('<script>')
  })
})

/**
 * El menú de servidores tiene DOS entradas que suenan parecido y son cosas
 * distintas, y con SRV-12 quedaron una al lado de la otra:
 *   · «Solicitudes de puestos» — el COMITÉ pide cupos (SRV-11/12).
 *   · «Aplicaciones de Servicio» — una PERSONA aplica a un puesto publicado.
 * La segunda se llamaba «Solicitudes» a secas. Lo corrigió Floriana.
 */
describe('las dos entradas del menú no se confunden', () => {
  const sidebar = sinComentarios('src/components/layout/Sidebar.tsx')

  it('la de aplicaciones dice «Aplicaciones de Servicio»', () => {
    expect(sidebar).toMatch(/href: '\/servidores\/aplicaciones', label: 'Aplicaciones de Servicio'/)
  })

  it('y ya no se llama «Solicitudes» a secas', () => {
    expect(sidebar).not.toMatch(/href: '\/servidores\/aplicaciones', label: 'Solicitudes'/)
  })

  it('la del comité sigue siendo «Solicitudes de puestos»', () => {
    expect(sidebar).toContain("label: 'Solicitudes de puestos'")
  })

  it('la pantalla y su pestaña dicen lo mismo que el menú', () => {
    const pag = sinComentarios('src/app/(admin)/servidores/aplicaciones/page.tsx')
    expect(pag).toContain('>Aplicaciones de Servicio<')
    expect(pag).toContain("useTituloDePantalla('Aplicaciones de Servicio'")
  })
})

/**
 * El panel de revisión es UNO SOLO.
 *
 * Eran dos con la misma intención —el de la bandeja y el del tab de la
 * vacante— y ya se había visto a dónde lleva: las etiquetas de estado estaban
 * escritas a mano en los dos lados y el mismo estado se llamaba «Aprobada» en
 * uno y «Aceptada» en el otro.
 */
describe('SRV-14 · el panel de revisión no está duplicado', () => {
  const PANEL = 'src/components/servers/PanelDeAplicacion.tsx'
  const BANDEJA = 'src/app/(admin)/servidores/aplicaciones/page.tsx'
  const VACANTE = 'src/app/(admin)/servidores/vacantes/[id]/page.tsx'

  it('las dos pantallas usan el MISMO componente', () => {
    for (const r of [BANDEJA, VACANTE]) {
      expect(sinComentarios(r), r).toContain("from '@/components/servers/PanelDeAplicacion'")
      expect(sinComentarios(r), r).toContain('<PanelDeAplicacion')
    }
  })

  it('la bandeja tiene el mismo botón «Revisar» que el tab de la vacante', () => {
    expect(sinComentarios(BANDEJA)).toMatch(/>\s*Revisar\s*</)
  })

  it('la nota SOLO aparece en «en revisión»', () => {
    // Antes había un cuadro de notas siempre visible… que no guardaba nada:
    // escribía en un estado local que nadie mandaba al servidor.
    const src = sinComentarios(PANEL)
    expect(src).toMatch(/estado && admiteMotivo\(estado\) && \(/)
    expect(sinComentarios(VACANTE)).not.toContain('panelNotes')
  })

  it('y ahora se GUARDA', () => {
    const q = sinComentarios('src/lib/supabase/queries/servers.ts')
    const fn = q.slice(q.indexOf('export async function setApplicationStatus'))
    expect(fn.slice(0, 1200)).toContain('notes: notas')
  })

  it('el panel ofrece TODOS los estados válidos, no solo aprobar y rechazar', () => {
    expect(sinComentarios(PANEL)).toContain('estadosDestino(app.status)')
  })

  it('y respeta que VER no es GESTIONAR', () => {
    expect(sinComentarios(PANEL)).toContain('puedeGestionar')
  })
})

describe('SRV-14 · los filtros de la bandeja', () => {
  it('por comité y por ubicación, los dos en el SERVIDOR', () => {
    // La lista está paginada: filtrar en pantalla recortaría solo la página
    // cargada y el total diría otra cosa.
    const src = sinComentarios('src/app/(admin)/servidores/aplicaciones/page.tsx')
    expect(src).toContain("u.set('committee', committeeFilter)")
    expect(src).toContain("u.set('location', ubicacionFiltro)")
  })

  it('el API los acepta y la consulta los cruza', () => {
    expect(sinComentarios('src/app/api/servers/applications/route.ts')).toContain("searchParams.get('location')")
    const q = sinComentarios('src/lib/supabase/queries/servers.ts')
    expect(q).toContain("eq('location', filters.location)")
  })

  it('el filtro de estado usa la lista compartida, no una escrita a mano', () => {
    // Estaba escrita a mano y NO incluía `sent_to_leader`: filtrar por ese
    // estado devolvía TODAS las aplicaciones en silencio.
    const src = sinComentarios('src/app/api/servers/applications/route.ts')
    expect(src).toContain('isApplicationState(statusParam)')
    expect(src).not.toMatch(/\['pending', 'reviewing', 'approved', 'rejected'\]/)
  })
})
