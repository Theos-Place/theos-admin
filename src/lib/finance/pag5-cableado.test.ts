/**
 * PAG-5 · Que la regla viva en UN solo lugar, y que el monto no lo mande el
 * cliente.
 *
 * Las dos cosas que este cambio puede romper en silencio:
 *
 *  1. Que la pantalla se escriba su propia versión de «qué se puede
 *     seleccionar». Pasó el 2026-10-12 con los permisos de eventos y con el
 *     adaptador de dirigentes: la misma regla en dos lugares diverge, y la
 *     que se ve no es la que manda.
 *  2. Que el total lo mande el navegador. Sería dejar que quien paga declare
 *     cuánto pagó — la versión nueva del bug de FIN-6.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const RUTA = 'src/app/api/payments/receipts/route.ts'
const BARRA = 'src/components/finance/PagarVariosJuntos.tsx'
const LISTA = 'src/components/members/MemberPaymentsList.tsx'

describe('PAG-5 · la regla no se duplica', () => {
  it('la barra usa evaluarSeleccion y no suma por su cuenta', () => {
    const src = sinComentarios(BARRA)
    expect(src).toContain('evaluarSeleccion(seleccionados, memberId)')
    // Nada de un `reduce` de montos en la pantalla.
    expect(src).not.toMatch(/reduce\([^)]*amount/)
  })

  it('la lista pregunta por sePuedeIncluir, no compara el estado a mano', () => {
    const src = sinComentarios(LISTA)
    expect(src).toContain('sePuedeIncluir(p)')
    expect(src).toContain('ofrecerPagoJunto(visible)')
  })

  it('el servidor vuelve a evaluar la selección: no confía en la pantalla', () => {
    const src = sinComentarios('src/lib/supabase/queries/payments.ts')
    expect(src).toContain('evaluarSeleccion(cobros, input.member_id)')
  })
})

describe('PAG-5 · el monto no viaja desde el navegador', () => {
  it('la ruta NO lee un total del formulario', () => {
    const src = sinComentarios(RUTA)
    expect(src).not.toMatch(/form\.get\(['"](total|amount|monto)['"]\)/)
  })

  it('la barra manda ids, archivo, referencia y persona — nada más', () => {
    const src = sinComentarios(BARRA)
    const campos = [...src.matchAll(/fd\.append\('([a-z_]+)'/g)].map(m => m[1]).sort()
    expect(campos).toEqual(['file', 'member_id', 'payment_ids', 'reference'])
  })
})

describe('PAG-5 · lo que protege la ruta', () => {
  const src = sinComentarios(RUTA)

  it('exige sesión', () => {
    expect(src).toContain('requireRoles()')
  })

  it('no acepta el member_id del body a secas: comprueba familia o staff', () => {
    expect(src).toContain('family_members')
    expect(src).toMatch(/status: 403/)
  })

  it('NO usa canViewMemberProfile', () => {
    // Ese permiso incluye «compartimos un comité que yo encargo», que sirve
    // para ver una ficha y no para pagar a nombre de alguien.
    expect(src).not.toContain('canViewMemberProfile')
  })

  it('tiene rate limit: el endpoint sube archivos', () => {
    expect(src).toContain('rateLimit(')
  })

  it('valida que los ids sean uuid', () => {
    expect(src).toContain('isUuid(x)')
  })

  it('responde 409 cuando algo cambió por debajo y 400 cuando nunca fue válido', () => {
    expect(src).toContain("error.code === 'no_pendiente'")
    expect(src).toMatch(/conflicto \? 409 : 400/)
  })
})

describe('PAG-5 · FIN-6 sigue de pie', () => {
  it('el guard de referencia se consulta por el TOTAL, una sola vez', () => {
    const src = sinComentarios('src/lib/supabase/queries/payments.ts')
    expect(src).toContain('{ member_id: input.member_id, amount: veredicto.total }')
  })

  it('el update exige que el pago siga pendiente', () => {
    const src = sinComentarios('src/lib/supabase/queries/payments.ts')
    expect(src).toMatch(/\.in\('id', veredicto\.ids\)\s*\.eq\('status', 'pending'\)/)
  })

  it('la cola de finanzas cuenta los repetidos con la regla nueva', () => {
    const src = sinComentarios('src/lib/supabase/queries/payments.ts')
    expect(src).toContain('referenciasRepetidas(')
  })
})
