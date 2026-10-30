import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  codificarFiltros, decodificarFiltros, leerFiltros, parametrosParaLaUrl, siguienteId,
  MAX_LARGO_EN_URL, PREFIJO_SESION, type FiltrosAvanzados,
} from './filtros-en-url'

const F: FiltrosAvanzados = {
  conditions: [
    { id: 3, group: 'study', type: 'study', study: 'N1', status: 'completed', from: null, to: null },
    { id: 5, group: 'study', type: 'study', study: 'N2', status: 'in_progress', from: null, to: null },
  ] as FiltrosAvanzados['conditions'],
  groups: [{ id: 7, members: [3, 5], op: 'OR' }],
  topLevelOps: { g7: 'AND' },
}

describe('PAR-8 · filtros avanzados en la URL', () => {
  it('ida y vuelta exacta, con tildes', () => {
    const conTilde = { ...F, conditions: [{ ...F.conditions[0], study: 'Prematrimonial (sesión)' }] } as FiltrosAvanzados
    expect(decodificarFiltros(codificarFiltros(F))).toEqual(F)
    expect(decodificarFiltros(codificarFiltros(conTilde))).toEqual(conTilde)
  })
  it('sin condiciones la URL queda limpia', () => {
    expect(codificarFiltros({ conditions: [], groups: [], topLevelOps: {} })).toBe('')
  })
  it('una URL rota o tocada a mano no rompe: devuelve null', () => {
    for (const raw of ['', 'xx', 'bm8tanNvbg', btoa('{"c":"no"}'), btoa('{"c":[{"x":1}]}')]) {
      expect(decodificarFiltros(raw)).toBeNull()
    }
  })
  it('descarta operadores que no son AND/OR', () => {
    const raw = btoa(JSON.stringify({ c: F.conditions, g: [], o: { c3: 'XOR', c5: 'OR' } }))
    expect(decodificarFiltros(raw)?.topLevelOps).toEqual({ c5: 'OR' })
  })
  it('los ids nuevos no chocan con los que vinieron de la URL', () => {
    expect(siguienteId(F)).toBe(8)
    expect(siguienteId(null)).toBe(1)
  })
  it('si es muy largo, va a la sesión con una clave corta (y se lee de ahí)', () => {
    const largo = 'x'.repeat(MAX_LARGO_EN_URL + 1)
    const p = parametrosParaLaUrl(largo)
    expect(p.f).toBe('')
    expect(p.fk).toMatch(/^[0-9a-z]+$/)
    expect(p.guardarEnSesion).toBe(largo)
    const cod = codificarFiltros(F)
    const almacen: Record<string, string> = { [PREFIJO_SESION + 'k1']: cod }
    expect(leerFiltros({ f: '', fk: 'k1' }, k => almacen[k] ?? null)).toEqual(F)
    expect(leerFiltros({ f: '', fk: 'otra' }, () => null)).toBeNull()
  })
})

describe('PAR-8 · cableado', () => {
  const page = readFileSync('src/app/(admin)/miembros/page.tsx', 'utf8')
  it('la pantalla hidrata los filtros desde la URL y los escribe de vuelta', () => {
    expect(page).toContain("useUrlFilter('f')")
    expect(page).toContain("useUrlFilter('fk')")
    expect(page).toContain('useMemberFilters([], filtrosIniciales)')
    expect(page).toContain('parametrosParaLaUrl(codificarFiltros(')
  })
  it('«Limpiar filtros (N)» con el conteo', () => {
    expect(page).toContain('Limpiar filtros ({activeFilterCount})')
  })
  it('el perfil ofrece volver a los resultados con los mismos parámetros', () => {
    const perfil = readFileSync('src/app/(admin)/miembros/[id]/page.tsx', 'utf8')
    expect(perfil).toContain('CLAVE_ULTIMA_BUSQUEDA')
    expect(perfil).toContain('Volver a los resultados')
  })
})
