import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const PAGINA = 'src/app/(admin)/servidores/vacantes/solicitudes/page.tsx'
const PUBLICAR = 'src/app/api/servers/vacancies/publish/route.ts'
const LISTA = 'src/app/api/servers/vacancies/requests/route.ts'
const QUERIES = 'src/lib/supabase/queries/servers.ts'

describe('SRV-12 · quién ve y quién publica NO son lo mismo', () => {
  it('la lista y el Excel los abre también solicitudes_puestos', () => {
    expect(sinComentarios(LISTA)).toMatch(/SERVICE_ADMIN_ROLES,\s*'solicitudes_puestos'/)
  })

  it('pero PUBLICAR es solo de la coordinación', () => {
    // Publicar BAJA lo que está en la calle. Quien arma las solicitudes no
    // decide eso.
    const src = sinComentarios(PUBLICAR)
    expect(src).toMatch(/requireRoles\(\.\.\.SERVICE_ADMIN_ROLES\)/)
    expect(src).not.toContain('solicitudes_puestos')
    expect(SERVICE_ADMIN_ROLES).not.toContain('solicitudes_puestos')
  })

  it('y la pantalla usa los mismos dos criterios, no uno solo', () => {
    const src = sinComentarios(PAGINA)
    expect(src).toMatch(/puedeVer = hasRole\(\.\.\.SERVICE_ADMIN_ROLES, 'solicitudes_puestos'\)/)
    expect(src).toMatch(/puedePublicar = hasRole\(\.\.\.SERVICE_ADMIN_ROLES\)/)
  })
})

describe('SRV-12 · la publicación no se la dicta el cliente', () => {
  it('el POST recalcula el plan con SU hora y SU estado', () => {
    // Una pestaña abierta desde ayer podría bajar algo que se publicó hoy, o
    // publicar una solicitud que mientras tanto se denegó.
    const src = sinComentarios(PUBLICAR)
    expect(src).toContain('planDePublicacion(')
    expect(src).not.toMatch(/req\.json\(\)/)
  })

  it('baja PRIMERO y sube después', () => {
    // Si fallara la segunda mitad, la página pública queda vacía —visible y
    // arreglable— en vez de mezclando los puestos del mes pasado con los
    // nuevos, que nadie notaría.
    // Se miran los UPDATE, no la primera mención: la firma nombra
    // `aPublicar` antes y el guard daría verde al revés.
    const src = sinComentarios(QUERIES)
    const fn = src.slice(src.indexOf('export async function ejecutarPublicacionMensual'))
    expect(fn.indexOf("status: 'cerrada'")).toBeLessThan(fn.indexOf("status: 'aprobado'"))
  })

  it('NO borra: desactiva', () => {
    const fn = sinComentarios(QUERIES).slice(
      sinComentarios(QUERIES).indexOf('export async function ejecutarPublicacionMensual'))
    expect(fn).toContain("status: 'cerrada'")
    expect(fn).not.toContain('.delete()')
  })

  it('queda firmado quién publicó y cuántos entraron y salieron', () => {
    // No tiene deshacer: sin registro, «¿quién bajó los puestos?» no se
    // contesta.
    const src = sinComentarios(PUBLICAR)
    expect(src).toContain('logAudit')
    expect(src).toContain('ids_desactivados')
  })

  it('la pantalla pide confirmación y dice los DOS números', () => {
    const src = sinComentarios(PAGINA)
    expect(src).toContain('textoDeConfirmacion')
    expect(src).toMatch(/setConfirmando\(true\)/)
  })
})
