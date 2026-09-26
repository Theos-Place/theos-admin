import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esEmbebible, frameAncestors, EMBEDDABLE_PREFIXES } from '@/lib/embed'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const API = 'src/app/api/public/vacancies/route.ts'
const PAGINA = 'src/app/(public)/vacantes/page.tsx'
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
    expect(src).toMatch(/status === 'aprobado'/)
  })

  it('sigue con rate limit: es un endpoint abierto', () => {
    expect(src).toContain('rateLimit')
  })
})

describe('SRV-13 · embebible, y solo desde los orígenes configurados', () => {
  it('/vacantes se puede meter en un iframe', () => {
    expect(EMBEDDABLE_PREFIXES).toContain('/vacantes')
    expect(esEmbebible('/vacantes')).toBe(true)
  })

  it('con orígenes configurados, frame-ancestors los incluye', () => {
    expect(frameAncestors('/vacantes', ['https://theosplace.org']))
      .toBe("frame-ancestors 'self' https://theosplace.org")
  })

  it('sin orígenes configurados NO se abre nada: activar esto no abre por sí solo', () => {
    expect(frameAncestors('/vacantes', [])).toBe("frame-ancestors 'self'")
  })

  it('el resto del sistema sigue cerrado', () => {
    for (const ruta of ['/miembros', '/finanzas', '/servidores/vacantes/solicitudes']) {
      expect(frameAncestors(ruta, ['https://theosplace.org']), ruta)
        .toBe("frame-ancestors 'self'")
    }
  })

  it('y la ruta es pública en el proxy: sin eso el iframe mostraría el login', () => {
    expect(sinComentarios(PROXY)).toContain("'/vacantes'")
  })
})

describe('SRV-13 · aplicar sin perder el puesto', () => {
  it('el botón vuelve AL PUESTO, no a la lista', () => {
    // Volver a la lista obliga a buscarlo de nuevo entre treinta, y ahí es
    // donde se abandona.
    const pag = sinComentarios(PAGINA)
    expect(pag).toMatch(/volverA=\{`\/vacantes\?puesto=\$\{[^}]+\.id\}`\}/)
  })

  it('y la página abre el puesto que venga en la URL', () => {
    expect(sinComentarios(PAGINA)).toContain("params.get('puesto')")
  })

  it('el enlace para pedir un puesto nuevo dice que es para los que NO existen', () => {
    const pag = sinComentarios(PAGINA)
    expect(pag).toContain('/servidores/puestos/solicitar')
    expect(pag).toMatch(/todavía no existen/)
  })
})

/**
 * La pantalla INTERNA de «Puestos de Servicio» (/servidores/vacantes) la ve
 * cualquier miembro: lista los puestos publicados para que la gente aplique.
 * Por eso lo que no es aplicar está acotado.
 */
describe('Puestos de Servicio · lo que no es aplicar, acotado', () => {
  const PAGINA = 'src/app/(admin)/servidores/vacantes/page.tsx'
  const src = sinComentarios(PAGINA)

  it('solicitar y gestionar usan LA MISMA lista, y es corta', () => {
    // Antes eran dos listas distintas y más anchas: `canRequest` incluía
    // `encargado_staff` y `solicitudes_puestos`, y las acciones de gestión
    // salían para todo SERVICE_ADMIN_ROLES —o sea también para `direccion`,
    // cuyo acceso es de lectura—.
    expect(src).toMatch(/PUEDE_GESTIONAR = \['lider_comite', 'coordinador_servidores', 'admin'\]/)
    expect(src).toContain('const isAdmin = hasRole(...PUEDE_GESTIONAR)')
    expect(src).toContain('const canRequest = hasRole(...PUEDE_GESTIONAR)')
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
