import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const PAGINA = 'src/app/(admin)/servidores/puestos/solicitudes/page.tsx'
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

  it('y la pantalla sigue separando VER de PUBLICAR', () => {
    const src = sinComentarios(PAGINA)
    /**
     * SRV-20 (2026-10-05): VER ya no se decide por rol en el cliente, porque
     * ahora también entra quien COORDINA UN COMITÉ —a lo suyo nada más— y
     * eso no se sabe por rol: un comité se coordina por PUESTO. Lo contesta
     * el endpoint con un 403, que la pantalla guarda en `sinAcceso`.
     *
     * Lo que NO cambió, y es lo que este test cuida: publicar sigue siendo
     * de la coordinación y nada más. Publicar BAJA lo que está en la calle.
     */
    expect(src).toContain('setSinAcceso(true)')
    expect(src).toMatch(/if \(user && sinAcceso\) return <AccessDenied \/>/)
    expect(src).toMatch(/puedePublicar = hasRole\(\.\.\.SERVICE_ADMIN_ROLES\)/)
    // Y el botón de publicar sigue colgando de ese criterio, no del acceso.
    expect(src).toMatch(/\{puedePublicar && \(/)
  })

  it('el recorte por comité lo hace el SERVIDOR, no la pantalla', () => {
    // Si lo hiciera la pantalla, la lista completa igual habría viajado al
    // navegador de alguien que no debe verla.
    const src = sinComentarios(LISTA)
    expect(src).toContain('getManageableCommitteeIds(auth.ctx.memberId)')
    expect(src).toMatch(/misComites\s*\n?\s*\? todasSinRecortar\.filter/)
  })

  it('sin comités propios responde 403, no una lista vacía', () => {
    // Una pantalla vacía se lee como «no hay solicitudes», que es una
    // respuesta falsa cuando la verdad es «esto no es para vos».
    const src = sinComentarios(LISTA)
    expect(src).toMatch(/if \(!esAmplio && \(!misComites \|\| misComites\.length === 0\)\)/)
    expect(src).toMatch(/status: 403/)
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
    expect(fn.indexOf('ESTADO_DESACTIVADO')).toBeLessThan(fn.indexOf('ESTADO_PUBLICADO'))
  })

  it('NO borra: desactiva', () => {
    const fn = sinComentarios(QUERIES).slice(
      sinComentarios(QUERIES).indexOf('export async function ejecutarPublicacionMensual'))
    expect(fn).toContain('ESTADO_DESACTIVADO')
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
