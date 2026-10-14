/**
 * FIN-11 · Que la cadena de firmas no tenga dos versiones.
 *
 * El control de tres firmas del reglamento se rompe de una sola manera: que
 * alguien, en algún lado, decida por su cuenta quién puede aprobar. Pasó ya
 * dos veces este mes con otra cosa (los permisos de eventos, el adaptador de
 * dirigentes), y acá el costo sería una aprobación que el reglamento no da.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const RUTA_ID = 'src/app/api/travel-requests/[id]/route.ts'
const RUTA = 'src/app/api/travel-requests/route.ts'
const QUERIES = 'src/lib/supabase/queries/travel.ts'
const DETALLE = 'src/app/(admin)/viajes/[id]/page.tsx'
const FORM = 'src/components/travel/FormularioDeViaje.tsx'

describe('FIN-11 · el actor sale de los roles, nunca del body', () => {
  const src = sinComentarios(RUTA_ID)

  it('la ruta llama a actorDe con los roles de la sesión', () => {
    expect(src).toContain('actorDe(auth.ctx.roles, r.esDueno)')
  })

  it('NO lee un actor, un rol ni un estado de autoridad del cuerpo', () => {
    expect(src).not.toMatch(/body\.(actor|rol|roles)|parsed\.data\.actor/)
  })

  it('el estado de origen sale de la base, no de lo que manda la pantalla', () => {
    // Si viniera del cliente, mandar `de: 'en_revision'` saltaría la revisión.
    expect(src).toContain('de: r.viaje.status')
    expect(src).not.toMatch(/parsed\.data\.de\b/)
  })
})

describe('FIN-11 · el paso lo valida el servidor', () => {
  it('moverViaje pregunta a puedeMover antes de tocar nada', () => {
    const src = sinComentarios(QUERIES)
    const i = src.indexOf('export async function moverViaje')
    const cuerpo = src.slice(i, i + 900)
    expect(cuerpo).toContain('puedeMover(input.de, input.a, input.actor, input.nota)')
    expect(cuerpo.indexOf('puedeMover')).toBeLessThan(cuerpo.indexOf('.update('))
  })

  it('el update exige que el estado no haya cambiado mientras tanto', () => {
    const src = sinComentarios(QUERIES)
    expect(src).toMatch(/\.eq\('id', input\.id\)\.eq\('status', input\.de\)/)
  })

  it('cada paso deja historial', () => {
    const src = sinComentarios(QUERIES)
    expect(src).toContain("from('travel_request_status_history').insert")
  })

  it('editar exige que el expediente siga siendo editable', () => {
    // Si no, se aprueba una cosa y queda guardada otra.
    const src = sinComentarios(QUERIES)
    expect(src).toContain('if (!esEditable(estado))')
  })
})

describe('FIN-11 · la pantalla no inventa pasos', () => {
  it('los botones salen de PASOS, no de una lista propia', () => {
    const src = sinComentarios(DETALLE)
    expect(src).toContain('PASOS.filter(p => p.de === v.status && p.quien === actor)')
  })

  it('y el modal pregunta por el motivo con la misma regla', () => {
    const src = sinComentarios(DETALLE)
    expect(src).toContain('puedeMover(de, a, actor, nota)')
  })

  it('el formulario usa el módulo del presupuesto y no suma a mano', () => {
    const src = sinComentarios(FORM)
    expect(src).toContain('totales(v.lineas)')
    expect(src).toContain('revisarPresupuesto(v.lineas)')
    expect(src).not.toMatch(/reduce\([^)]*(subtotal|tarifa)/)
  })
})

describe('FIN-11 · lo que protege la API', () => {
  it('las dos rutas exigen sesión', () => {
    expect(sinComentarios(RUTA)).toContain('requireRoles()')
    expect(sinComentarios(RUTA_ID)).toContain('requireRoles()')
  })

  it('crear es para staff', () => {
    expect(sinComentarios(RUTA)).toContain('puedePedirViaje(auth.ctx.roles)')
  })

  it('el expediente es de quien lo pide: no se acepta member_id del body', () => {
    const src = sinComentarios(RUTA)
    expect(src).toContain('crearViaje(auth.ctx.memberId')
    expect(src).not.toMatch(/member_id:\s*z\./)
  })

  it('un borrador ajeno no se abre', () => {
    expect(sinComentarios(RUTA_ID)).toMatch(/!esDueno && viaje\.status === 'borrador'/)
  })

  it('solo el dueño edita', () => {
    expect(sinComentarios(RUTA_ID)).toContain('Solo quien pidió el viaje puede editarlo.')
  })

  it('la validación financiera no la llena el solicitante', () => {
    expect(sinComentarios(RUTA_ID)).toContain("if (actor === 'solicitante')")
  })

  it('todo escribe en el audit_log', () => {
    expect(sinComentarios(RUTA_ID)).toContain('logAudit(')
    expect(sinComentarios(RUTA)).toContain('logAudit(')
  })

  it('los bodies se validan con zod', () => {
    expect(sinComentarios(RUTA)).toContain('z.treeifyError')
    expect(sinComentarios(RUTA_ID)).toContain('z.treeifyError')
  })
})

describe('FIN-11 · la tabla queda cerrada a la llave pública', () => {
  it('la migración prende RLS en las tres tablas', () => {
    // Sin esto, PostgREST publica los viáticos de todo el mundo con la llave
    // que va en el bundle del navegador (SEC-3).
    const sql = readFileSync('supabase/migrations/20261013210000_fin11_expediente_de_viaje.sql', 'utf8')
    for (const t of ['travel_requests', 'travel_budget_items', 'travel_request_status_history']) {
      expect(sql).toContain(`alter table public.${t} enable row level security`)
    }
  })

  it('el subtotal NO se guarda en la base', () => {
    // Guardarlo abre la puerta a que la fila diga 60.000 y sus factores otra cosa.
    const sql = readFileSync('supabase/migrations/20261013210000_fin11_expediente_de_viaje.sql', 'utf8')
    expect(sql).not.toMatch(/^\s*subtotal\s/m)
  })
})
