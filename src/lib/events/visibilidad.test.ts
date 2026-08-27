/**
 * Evento público vs interno. Lo que se prueba es la asimetría, que es la parte
 * fácil de romper: un evento interno NO se lista, pero SÍ tiene que abrir por su
 * link directo. Si alguien "arregla" el filtro poniéndolo también en el detalle,
 * el link deja de servir y con él el QR y lo que se mandó por WhatsApp.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { computeEventEligibility } from './eligibility'

const evento = (id: string, isPublic: boolean) => ({
  id, title: id, starts_at: '2026-12-01T00:00:00Z', ends_at: null,
  event_type: 'otro', status: 'upcoming' as const, location: null, flyer_url: null,
  is_recurring: false, recurrence_rule: null, max_capacity: null,
  is_public: isPublic, registrations: [],
})

describe('la elegibilidad devuelve los internos, con su bandera', () => {
  const precios = new Map([
    ['pub', { requiresPayment: false, isServer: false, exempt: false, price: 0 }],
    ['int', { requiresPayment: false, isServer: false, exempt: false, price: 0 }],
  ])

  it('un evento interno SÍ viene en la elegibilidad', () => {
    // Si se filtrara acá, el deep link ?register=<id> de un evento interno no
    // encontraría nada y el botón "Inscribirme" no haría nada — el bug que ya
    // se arregló una vez.
    const res = computeEventEligibility(
      [evento('pub', true), evento('int', false)] as unknown as Parameters<typeof computeEventEligibility>[0],
      'm1', precios as never,
    )
    expect(res.map(r => r.event_id)).toEqual(['pub', 'int'])
    expect(res.find(r => r.event_id === 'int')!.is_public).toBe(false)
    expect(res.find(r => r.event_id === 'pub')!.is_public).toBe(true)
  })

  it('sin la columna (eventos viejos) se asume público', () => {
    const sinCampo = { ...evento('pub', true) } as Record<string, unknown>
    delete sinCampo.is_public
    const [r] = computeEventEligibility(
      [sinCampo] as unknown as Parameters<typeof computeEventEligibility>[0],
      'm1', precios as never,
    )
    expect(r.is_public).toBe(true)
  })
})

describe('quién filtra y quién no', () => {
  it('la CARTELERA pública filtra por is_public', () => {
    const ruta = readFileSync('src/app/api/public/events/route.ts', 'utf8')
    expect(ruta).toContain('e.is_public !== false')
  })

  it('el DETALLE público NO filtra: el link de un interno tiene que abrir', () => {
    const ruta = readFileSync('src/app/api/public/events/[id]/route.ts', 'utf8')
    // Se permite leer la columna (viaja en la respuesta), pero no descartar por ella.
    expect(ruta).not.toMatch(/\.eq\(\s*['"]is_public['"]/)
    expect(ruta).not.toMatch(/is_public\s*(!==|===)\s*(false|true)[^)]*\)\s*(return|\?)/)
  })

  it('la lista del calendario de miembros esconde los internos', () => {
    const pagina = readFileSync('src/app/(admin)/eventos/page.tsx', 'utf8')
    expect(pagina).toContain('canManage || e.is_public')
  })
})
