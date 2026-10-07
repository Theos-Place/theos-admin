import { describe, it, expect } from 'vitest'
import { ACCIONES_DE_PUESTO } from '@/lib/auth/roles'
import { readFileSync } from 'node:fs'
import { esEmbebible, frameAncestors, EMBEDDABLE_PREFIXES } from '@/lib/embed'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const API = 'src/app/api/public/vacancies/route.ts'
const PAGINA = 'src/app/(public)/puestos/page.tsx'
const PROXY = 'src/proxy.ts'

/**
 * LO QUE MÁS IMPORTA DE SRV-13: esta página no tiene login y se va a incrustar
 * en el sitio público. Lo que sale por su API es, literalmente, público.
 */
describe('SRV-13 · qué NO sale en público', () => {
  const src = sinComentarios(API)

  it('las funciones y el perfil del puesto NO viajan al navegador', () => {
    // Son la descripción interna del puesto: lo que se le exige a quien sirve.
    // No alcanza con no pintarlos — un campo que llega al navegador es público
    // aunque no se muestre, y se encuentra con las herramientas del navegador.
    expect(src).not.toContain('position_functions')
    expect(src).not.toContain('position_profile')
    expect(src).not.toContain('v.functions')
  })

  it('y sí salen la descripción y el requisito de estudios, que es lo pedido', () => {
    expect(src).toContain('position_description')
    expect(src).toContain('position_study_requirement')
  })

  it('la pantalla tampoco los conoce: si vuelven al API, el tipo no los tapa', () => {
    const pag = sinComentarios(PAGINA)
    expect(pag).not.toContain('position_functions')
    expect(pag).not.toContain('position_profile')
  })

  it('solo se listan las PUBLICADAS', () => {
    expect(src).toMatch(/status === 'publicada'/)
  })

  it('sigue con rate limit: es un endpoint abierto', () => {
    expect(src).toContain('rateLimit')
  })
})

describe('SRV-13 · embebible, y solo desde los orígenes configurados', () => {
  it('/vacantes se puede meter en un iframe', () => {
    expect(EMBEDDABLE_PREFIXES).toContain('/puestos')
    expect(esEmbebible('/puestos')).toBe(true)
  })

  it('con orígenes configurados, frame-ancestors los incluye', () => {
    expect(frameAncestors('/puestos', ['https://theosplace.org']))
      .toBe("frame-ancestors 'self' https://theosplace.org")
  })

  it('sin orígenes configurados NO se abre nada: activar esto no abre por sí solo', () => {
    expect(frameAncestors('/puestos', [])).toBe("frame-ancestors 'self'")
  })

  it('el resto del sistema sigue cerrado', () => {
    for (const ruta of ['/miembros', '/finanzas', '/servidores/puestos/solicitudes']) {
      expect(frameAncestors(ruta, ['https://theosplace.org']), ruta)
        .toBe("frame-ancestors 'self'")
    }
  })

  it('y la ruta es pública en el proxy: sin eso el iframe mostraría el login', () => {
    expect(sinComentarios(PROXY)).toContain("'/puestos'")
  })
})

describe('SRV-13 · aplicar sin perder el puesto', () => {
  it('el botón vuelve AL PUESTO, no a la lista', () => {
    // Volver a la lista obliga a buscarlo de nuevo entre treinta, y ahí es
    // donde se abandona.
    const pag = sinComentarios(PAGINA)
    expect(pag).toMatch(/volverA=\{`\/puestos\?puesto=\$\{[^}]+\.id\}`\}/)
  })

  it('y la página abre el puesto que venga en la URL', () => {
    expect(sinComentarios(PAGINA)).toContain("params.get('puesto')")
  })

  it('la pública NO enlaza a pantallas de administración', () => {
    /**
     * Antes este test exigía lo contrario: que la página tuviera un «¿No ves
     * el puesto que necesitás? Sugerinos uno nuevo» apuntando a
     * `/servidores/puestos/nuevo`.
     *
     * Se quitó el 2026-09-30 a pedido de Floriana, y la razón vale más que el
     * enlace: esa pantalla es de ADMINISTRACIÓN —pide sesión y rol—, así que
     * a quien llega de afuera, que es todo el público de esta página, el
     * enlace lo mandaba al login sin ninguna explicación. Pedir un puesto
     * nuevo es un trámite interno del comité.
     *
     * El test se invierte en vez de borrarse: lo que hay que cuidar ahora es
     * que no vuelva a colarse un enlace a `/servidores/*` en una página
     * pública.
     */
    const pag = sinComentarios(PAGINA)
    expect(pag).not.toContain('/servidores/')
  })
})

/**
 * La pantalla INTERNA de «Puestos de Servicio» (/servidores/puestos) la ve
 * cualquier miembro: lista los puestos publicados para que la gente aplique.
 * Por eso lo que no es aplicar está acotado.
 */
describe('Puestos de Servicio · lo que no es aplicar, acotado', () => {
  const PAGINA = 'src/app/(admin)/servidores/puestos/page.tsx'
  const src = sinComentarios(PAGINA)

  it('solicitar y actuar sobre el puesto son DOS listas distintas', () => {
    /**
     * Eran la misma y se separaron el 2026-10-07 por decisión de Floriana:
     * «Ver aplicaciones», «Editar» y «Bajar» pasaron al rol del comité, a
     * encargado de staff, dirección y admin — y SALIERON `lider_comite` y
     * `coordinador_servidores`, que las tenían desde el 25 de setiembre.
     *
     * SOLICITAR no se tocó: juntarlas de nuevo le quitaría a un líder de
     * comité el poder pedir puestos para su gente, que nadie pidió.
     */
    expect(src).toContain('const isAdmin = hasRole(...ACCIONES_DE_PUESTO)')
    expect(src).toMatch(/PUEDE_SOLICITAR = \['lider_comite', 'coordinador_servidores', 'admin'\]/)
    expect(src).toContain('const canRequest = hasRole(...PUEDE_SOLICITAR)')
  })

  it('las acciones del puesto siguen SIN direccion-como-lectura por accidente', () => {
    // `direccion` entra ahora, pero PEDIDO explícitamente, no heredado de
    // SERVICE_ADMIN_ROLES como pasaba antes del 25 de setiembre.
    expect(ACCIONES_DE_PUESTO).toContain('direccion')
    expect(ACCIONES_DE_PUESTO).not.toContain('lider_comite')
    expect(ACCIONES_DE_PUESTO).not.toContain('coordinador_servidores')
  })

  it('y ya no se cuelan por las listas anchas de antes', () => {
    expect(src).not.toContain('SERVICE_ADMIN_ROLES')
    expect(src).not.toContain('STAFF_IMPORT_ROLES')
  })

  it('«Ver aplicaciones», «Editar» y cerrar siguen detrás de ese gate', () => {
    const bloque = src.slice(src.indexOf('{isAdmin && ('), src.indexOf('</div>', src.indexOf('{isAdmin && (')))
    expect(bloque).toContain('Ver aplicaciones')
    expect(bloque).toContain('Editar')
    expect(bloque).toContain('CloseVacancyButton')
  })

  it('el botón se llama «Solicitar puestos de servicio»', () => {
    expect(src).toContain('Solicitar puestos de servicio')
    expect(src).not.toMatch(/>\s*Solicitar vacantes\s*</)
  })

  it('la descripción y el nivel de estudio caen al PUESTO', () => {
    // SRV-11 dejó de pedirlos en cada solicitud porque ya viven en la ficha
    // del puesto; la tarjeta seguía leyendo solo los de la vacante y desde
    // entonces salía vacía.
    expect(src).toContain('v.description || v.position_description')
    expect(src).toContain('v.position_study_requirement')
    expect(src).toContain('v.position_functions')
  })
})
