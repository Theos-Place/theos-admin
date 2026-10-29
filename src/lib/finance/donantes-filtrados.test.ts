import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { argumentosDeDonantes, etiquetaDeTotalDonado } from './donantes-filtrados'

describe('DON-5 · las tarjetas de Donaciones siguen a los filtros', () => {
  it('sin filtros, los argumentos van vacíos', () => {
    expect(argumentosDeDonantes({})).toEqual({ p_from: null, p_to: null, p_status: null, p_search_tokens: null })
    expect(argumentosDeDonantes({ status: 'all', search: '  ' })).toEqual({ p_from: null, p_to: null, p_status: null, p_search_tokens: null })
  })

  it('el rango va como fecha pelada (donation_date es DATE) y solo si es YYYY-MM-DD', () => {
    expect(argumentosDeDonantes({ from: '2026-10-01', to: '2026-10-31' })).toMatchObject({ p_from: '2026-10-01', p_to: '2026-10-31' })
    expect(argumentosDeDonantes({ from: '01/10/2026' }).p_from).toBeNull()
  })

  it('estado y búsqueda pasan como en la lista', () => {
    expect(argumentosDeDonantes({ status: 'unidentified', search: 'Mónica Pérez' }))
      .toMatchObject({ p_status: 'unidentified', p_search_tokens: ['monica', 'perez'] })
  })

  describe('el rótulo del total', () => {
    it('sin rango dice «este mes», que es lo que suma donation_stats()', () => {
      expect(etiquetaDeTotalDonado(undefined, undefined)).toBe('Total donado este mes')
      expect(etiquetaDeTotalDonado('', '')).toBe('Total donado este mes')
    })
    it('con rango dice el rango, en dd/mm/aaaa', () => {
      expect(etiquetaDeTotalDonado('2026-10-01', '2026-10-31')).toBe('Total donado del 01/10/2026 al 31/10/2026')
      expect(etiquetaDeTotalDonado('2026-10-01', '')).toBe('Total donado desde el 01/10/2026')
      expect(etiquetaDeTotalDonado('', '2026-10-31')).toBe('Total donado hasta el 31/10/2026')
    })
    it('con búsqueda o estado pero sin rango, no inventa un período', () => {
      expect(etiquetaDeTotalDonado('', '', true)).toBe('Total donado (lo filtrado)')
    })
  })

  describe('el cableado', () => {
    it('la migración cierra la función a service_role', () => {
      const sql = readFileSync('supabase/migrations/20261028130000_don5_donantes_filtrados.sql', 'utf8')
      expect(sql).toMatch(/revoke execute on function public\.donation_stats_filtrados\(.*\) from public, anon, authenticated/)
      expect(sql).toMatch(/grant\s+execute on function public\.donation_stats_filtrados\(.*\) to service_role/)
      expect(sql).toContain("set search_path to 'public'")
    })
    it('la query usa el RPC con los argumentos de este módulo, y ya no suma paginando en Node', () => {
      const q = readFileSync('src/lib/supabase/queries/finance.ts', 'utf8')
      expect(q).toContain("rpc('donation_stats_filtrados', argumentosDeDonantes(filters))")
      expect(q).not.toContain('getDonationsFilteredSum')
    })
    it('la ruta devuelve también los donantes del filtro', () => {
      const r = readFileSync('src/app/api/finance/donations/route.ts', 'utf8')
      expect(r).toContain('filtered_donors')
      expect(r).toContain('filtered_sum')
    })
    it('el panel muestra los donantes y el total filtrados, con el rótulo del rango', () => {
      const p = readFileSync('src/components/finance/DonacionesPanel.tsx', 'utf8')
      expect(p).toContain('etiquetaDeTotalDonado(dateFrom, dateTo')
      expect(p).toContain('filteredDonors')
      expect(p).toContain('INFO_DONANTES_IDENTIFICADOS')
      expect(p).not.toContain("label: 'Total donado este mes'")
      // Donantes activos NO cambia con el filtro: es la ventana de FIN-10.
      expect(p).toContain("label: 'Donantes activos', value: activeDonors")
    })
  })
})
