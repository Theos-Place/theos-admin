import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  planDePublicacion, hayAlgoQuePublicar, motivoParaNoPublicar,
  ESTADO_PUBLICABLE, ESTADO_PUBLICADO, ESTADO_DESACTIVADO,
} from './publicacion-mensual'
import { ESTADO_INICIAL } from './vacancy-states'

const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

const AHORA = new Date('2026-10-02T12:00:00Z')
const v = (id: string, status: string, published_at: string | null = null) => ({ id, status, published_at })

describe('SRV-15 · nada se publica solo', () => {
  it('una solicitud nueva entra LISTA PARA PUBLICAR, no publicada', () => {
    expect(ESTADO_INICIAL).toBe('lista_para_publicar')
    expect(ESTADO_INICIAL).toBe(ESTADO_PUBLICABLE)
  })

  it('y eso vale aunque la pida un coordinador: se quitó `autoApprove`', () => {
    // Antes, si quien la mandaba tenía un rol administrativo, entraba ya
    // publicada. La página pública cambiaba por el solo hecho de quién tuvo
    // tiempo de llenar el formulario, que no es una decisión de publicación.
    const q = sinComentarios('src/lib/supabase/queries/servers.ts')
    expect(q).not.toContain('autoApprove')
    const fn = q.slice(q.indexOf('export async function createVacancyRequests'))
    expect(fn.slice(0, 2000)).toContain('const status: VacancyState = ESTADO_INICIAL')
    expect(fn.slice(0, 2000)).toContain('const publishedAt = null')
    expect(sinComentarios('src/app/api/servers/vacancies/request/route.ts'))
      .not.toContain('autoApprove')
  })

  it('publicar mueve SOLO las que están listas', () => {
    const plan = planDePublicacion([
      v('nueva', ESTADO_PUBLICABLE),
      v('vieja', ESTADO_PUBLICADO, '2026-09-02T00:00:00Z'),
      v('baja', ESTADO_DESACTIVADO, '2026-08-01T00:00:00Z'),
      v('no', 'denegado'),
    ], AHORA)
    expect(plan.aPublicar).toEqual(['nueva'])
    expect(plan.aDesactivar).toEqual(['vieja'])
  })

  it('las publicadas anteriores pasan a DESPUBLICADA, no se borran', () => {
    const q = sinComentarios('src/lib/supabase/queries/servers.ts')
    const fn = q.slice(q.indexOf('export async function ejecutarPublicacionMensual'))
    expect(fn).toContain('ESTADO_DESACTIVADO')
    expect(fn).not.toContain('.delete()')
  })
})

describe('SRV-15 · el botón', () => {
  it('apagado cuando no hay NADA NUEVO que publicar', () => {
    expect(hayAlgoQuePublicar({ aPublicar: [], aDesactivar: [] })).toBe(false)
    expect(motivoParaNoPublicar({ aPublicar: [], aDesactivar: [] }))
      .toBe('No hay solicitudes nuevas por publicar.')
  })

  it('y TAMBIÉN apagado si lo único que haría es bajar lo que está', () => {
    // Esa corrida solo vaciaría la página pública: se bajan los puestos del
    // mes pasado y no entra ninguno. Nadie pide eso, y se ve desde afuera.
    const plan = { aPublicar: [], aDesactivar: ['a', 'b'] }
    expect(hayAlgoQuePublicar(plan)).toBe(false)
    expect(motivoParaNoPublicar(plan)).toMatch(/solo bajaría las 2/)
  })

  it('encendido en cuanto hay una nueva', () => {
    const plan = { aPublicar: ['a'], aDesactivar: ['b'] }
    expect(hayAlgoQuePublicar(plan)).toBe(true)
    expect(motivoParaNoPublicar(plan)).toBeNull()
  })

  it('la pantalla dice POR QUÉ está apagado, no lo deja mudo', () => {
    // Un botón apagado sin explicación se lee como que la pantalla está rota.
    const src = sinComentarios('src/app/(admin)/servidores/vacantes/solicitudes/page.tsx')
    expect(src).toContain('motivoParaNoPublicar(plan)')
    expect(src).toMatch(/title=\{motivoParaNoPublicar\(plan\) \?\? undefined\}/)
  })
})

describe('SRV-15 · lo que ya estaba bien sigue estando', () => {
  const q = sinComentarios('src/lib/supabase/queries/servers.ts')
  const ruta = sinComentarios('src/app/api/servers/vacancies/publish/route.ts')

  it('el plan se recalcula en el servidor', () => {
    expect(ruta).toContain('planDePublicacion(')
    expect(ruta).not.toMatch(/req\.json\(\)/)
  })

  it('se baja antes de subir', () => {
    const fn = q.slice(q.indexOf('export async function ejecutarPublicacionMensual'))
    expect(fn.indexOf('ESTADO_DESACTIVADO')).toBeLessThan(fn.indexOf('ESTADO_PUBLICADO'))
  })

  it('sigue siendo idempotente dentro del mes', () => {
    expect(planDePublicacion([v('x', ESTADO_PUBLICADO, '2026-10-01T00:00:00Z')], AHORA).aDesactivar)
      .toEqual([])
  })

  it('y queda el registro con los números', () => {
    expect(ruta).toContain('logAudit')
    expect(ruta).toContain('ids_desactivados')
  })
})
