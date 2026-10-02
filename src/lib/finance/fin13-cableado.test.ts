import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const RUTA_PLAN = 'src/app/api/payments/[id]/payment-plan/route.ts'
const RUTA_ENABLE = 'src/app/api/payments/[id]/payment-plan/enable/route.ts'
const QUERY = 'src/lib/supabase/queries/payment-plans.ts'
const MIGRACION = 'supabase/migrations/20261002140000_fin13_habilitar_arreglo_por_persona.sql'

describe('FIN-13 · los límites se aplican en el SERVIDOR', () => {
  it('createPaymentPlan los valida, no solo el formulario', () => {
    // El endpoint es alcanzable con un POST a mano, y esto decide cuánta
    // plata se cobra y cuándo. Una regla que solo vive en la pantalla no es
    // una regla: es una sugerencia.
    const src = sinComentarios(QUERY)
    expect(src).toContain('motivoParaRechazarArreglo(')
    expect(src).toMatch(/throw new Error\(rechazo\.code\)/)
  })

  it('y el contexto sale del VÍNCULO del pago, no de entity_type', () => {
    // entity_type es texto y viene vacío en lo histórico; el vínculo lo
    // obliga un CHECK de la tabla, así que no miente.
    const src = sinComentarios(QUERY)
    expect(src).toMatch(/if \(p\.enrollment_id\)/)
  })

  it('la fecha del evento se pasa a día de Costa Rica antes de comparar', () => {
    // events.starts_at es timestamptz: un evento de las 6 p.m. del viernes
    // es sábado en UTC, y con eso el arreglo ganaría un día que no tiene.
    expect(sinComentarios(QUERY)).toMatch(/limite: starts \? diaCR\(starts\) : null/)
  })

  it('la ruta traduce cada motivo a un mensaje y un 409', () => {
    const src = sinComentarios(RUTA_PLAN)
    for (const code of [
      'FRECUENCIA_NO_PERMITIDA', 'DEMASIADOS_TRACTOS',
      'VENCE_DESPUES_DE_LA_ACTIVIDAD', 'VENCE_DESPUES_DE_LA_MATRICULA',
    ]) expect(src, code).toContain(code)
  })
})

describe('FIN-13 · habilitar persona por persona', () => {
  it('no existe un botón público: se habilita desde finanzas', () => {
    expect(sinComentarios(RUTA_ENABLE))
      .toMatch(/requireRoles\(\.\.\.PLAN_ROLES\)/)
    expect(sinComentarios(RUTA_ENABLE))
      .toMatch(/PLAN_ROLES = \['finanzas', 'direccion', 'admin'\]/)
  })

  it('queda registrado quién habilitó', () => {
    // «¿Quién le habilitó el arreglo a fulano?» es la primera pregunta
    // cuando algo se discute, y la columna sola no dice quién lo QUITÓ.
    const src = sinComentarios(RUTA_ENABLE)
    expect(src).toContain('logAudit')
    expect(src).toMatch(/entityType: 'payments'/)
  })

  it('al quitar se borran las dos columnas, no solo la fecha', () => {
    // Dejar el «quién» sin el «cuándo» haría creer que sigue habilitado.
    expect(sinComentarios(QUERY))
      .toMatch(/payment_plan_enabled_at: null, payment_plan_enabled_by: null/)
  })

  it('la migración no asume: NULL es no habilitado', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    expect(sql).toContain('payment_plan_enabled_at')
    expect(sql).toContain('payment_plan_enabled_by')
    // Sin DEFAULT: los 358 pagos que ya existen quedan en no habilitado.
    expect(sql).not.toMatch(/default\s+(true|now\(\))/i)
  })
})

describe('FIN-13 · lo que puede hacer la persona', () => {
  it('se acoge por el MISMO endpoint que usa finanzas', () => {
    // Un segundo camino para crear arreglos serían dos lugares donde aplicar
    // los límites, y uno se va a quedar atrás el día que cambie una regla.
    const src = sinComentarios(RUTA_PLAN)
    expect(src).toContain('puedeAcogerseAlArreglo(id, auth.ctx.memberId)')
  })

  it('y solo si finanzas se lo habilitó: lo verifica el servidor', () => {
    // Si la habilitación viniera en el cuerpo, cualquiera se la pondría.
    const src = sinComentarios(QUERY)
    expect(src).toContain('payment_plan_enabled_at')
    expect(src).toMatch(/if \(!p\.payment_plan_enabled_at\)/)
  })

  it('un familiar NO puede acogerse por otro', () => {
    // En Mis pagos uno puede PAGAR por un familiar, pero una deuda que
    // bloquea matricularse la asume cada quien.
    expect(sinComentarios(QUERY)).toMatch(/if \(p\.member_id !== memberId\)/)
  })

  it('y un cobro ajeno responde 404, no 403', () => {
    // Un 403 confirmaría que ese pago existe, y el id va en la URL.
    const src = sinComentarios(QUERY)
    const i = src.indexOf('if (p.member_id !== memberId)')
    expect(src.slice(i, i + 160)).toContain('status: 404')
  })
})
