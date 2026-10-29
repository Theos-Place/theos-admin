import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { argumentosDeTotales, tokensDeBusqueda } from './totales-filtrados'

describe('PAG-7 · los totales de pagos siguen a los filtros', () => {
  it('sin filtros, todos los argumentos van vacíos: suma la tabla entera', () => {
    expect(argumentosDeTotales({})).toEqual({
      p_search_tokens: null, p_entity_type: null, p_method: null, p_status: null,
      p_currency: null, p_in_plan: false, p_paid_from: null, p_paid_to: null,
    })
  })

  it('el rango de fecha va en hora de Costa Rica, como en la lista', () => {
    const a = argumentosDeTotales({ paidFrom: '2026-10-01', paidTo: '2026-10-31' })
    expect(a.p_paid_from).toBe('2026-10-01T00:00:00.000-06:00')
    expect(a.p_paid_to).toBe('2026-10-31T23:59:59.999-06:00')
  })

  it('la búsqueda se tokeniza como applyMemberSearch: sin tildes, minúsculas, sin %,()', () => {
    expect(tokensDeBusqueda('  Pérez (Mónica) 50%  ')).toEqual(['perez', 'monica', '50'])
    expect(argumentosDeTotales({ search: 'Ana' }).p_search_tokens).toEqual(['ana'])
    expect(argumentosDeTotales({ search: '   ' }).p_search_tokens).toBeNull()
  })

  it('los demás filtros pasan tal cual; vacío es «sin filtro»', () => {
    const a = argumentosDeTotales({ entity_type: 'event', method: 'sinpe', status: 'paid', currency: 'USD', inPaymentPlan: true })
    expect(a).toMatchObject({ p_entity_type: 'event', p_method: 'sinpe', p_status: 'paid', p_currency: 'USD', p_in_plan: true })
    expect(argumentosDeTotales({ method: '', status: '' })).toMatchObject({ p_method: null, p_status: null })
  })

  describe('el cableado', () => {
    it('la migración cierra la función a service_role (regla de AGENTS.md)', () => {
      const sql = readFileSync('supabase/migrations/20261028120000_pag7_totales_filtrados.sql', 'utf8')
      expect(sql).toMatch(/revoke execute on function public\.payment_stats_filtrados\(.*\) from public, anon, authenticated/)
      expect(sql).toMatch(/grant\s+execute on function public\.payment_stats_filtrados\(.*\) to service_role/)
      expect(sql).toContain("set search_path to 'public'")
      // Mismo criterio de moneda que la lista: los históricos sin moneda son CRC.
      expect(sql).toContain("p_currency = 'CRC' and (p.currency = 'CRC' or p.currency is null)")
    })

    it('la ruta lee los MISMOS filtros para la lista y para los totales, incluido el rango de fecha', () => {
      const r = readFileSync('src/app/api/finance/payments/route.ts', 'utf8')
      expect(r).toContain('filtrosDeLaConsulta(searchParams)')
      expect(r).toContain("searchParams.get('paid_from')")
      expect(r).toContain("searchParams.get('paid_to')")
      expect(r).toContain('getPaymentStats(filtros)')
      expect(r).toContain('getPaymentsPage({')
    })

    it('la query llama al RPC filtrado con los argumentos de este módulo', () => {
      const q = readFileSync('src/lib/supabase/queries/finance.ts', 'utf8')
      expect(q).toContain("rpc('payment_stats_filtrados', argumentosDeTotales(filters))")
    })

    it('la pantalla pide los totales con los filtros vigentes y los vuelve a pedir cuando cambian', () => {
      const p = readFileSync('src/app/(admin)/finanzas/pagos/page.tsx', 'utf8')
      expect(p).toContain("u.set('stats', '1')")
      expect(p).toContain('const claveDeFiltros = filtrosActuales().toString()')
      expect(p).toContain('}, [claveDeFiltros])')
    })

    it('en Saldos a favor, «Total a favor» y «Personas con saldo» cuentan solo las filas filtradas', () => {
      const p = readFileSync('src/app/(admin)/finanzas/saldos/page.tsx', 'utf8')
      expect(p).toContain('totalVigentePorMoneda(filtrados)')
      expect(p).toContain('personasConSaldo(filtrados)')
      expect(p).not.toContain('totalVigentePorMoneda(filas)')
    })
  })
})
