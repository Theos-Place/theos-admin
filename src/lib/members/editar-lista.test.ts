import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  enlaceParaEditarFiltros, tieneFiltroEditable, puedeEditarLista, avisoDeImpacto, aplicarCambioDePersonas,
} from './editar-lista'
import { decodificarFiltros, PREFIJO_SESION } from './filtros-en-url'
import type { FilterState, FilterCondition } from '@/types/filters'

const cond: FilterCondition = { id: 1, group: 'donor', type: 'donor', value: 'yes' }
const completo: FilterState = { v: 2, conditions: [cond], groups: [], is_server: true, active_attendance: 'estudios', search: 'ana' }

describe('PAR-9 · qué lista tiene un filtro que editar', () => {
  it('con filtro completo (v: 2): sí', () => {
    expect(tieneFiltroEditable(completo)).toBe(true)
  })
  it('fija (sin filtro, como las importadas de Excel): no', () => {
    expect(tieneFiltroEditable(null)).toBe(false)
    expect(tieneFiltroEditable({ conditions: [], groups: [] })).toBe(false)
  })
  it('filtro viejo e incompleto: no, reabrirlo daría otra búsqueda más ancha', () => {
    expect(tieneFiltroEditable({ conditions: [cond], groups: [] })).toBe(false)
  })
})

describe('PAR-9 · «Editar filtros» abre Miembros con la búsqueda EXACTA', () => {
  it('condiciones, chips, búsqueda y la lista que se edita', () => {
    const { href, sesion } = enlaceParaEditarFiltros('L1', completo)
    const u = new URL(href, 'http://x')
    expect(u.pathname).toBe('/miembros')
    expect(decodificarFiltros(u.searchParams.get('f'))?.conditions).toEqual([cond])
    expect(u.searchParams.get('servidores')).toBe('1')
    expect(u.searchParams.get('asistencia_estudios')).toBe('1')
    expect(u.searchParams.get('activos')).toBeNull()
    expect(u.searchParams.get('donantes')).toBeNull()
    expect(u.searchParams.get('q')).toBe('ana')
    expect(u.searchParams.get('lista')).toBe('L1')
    expect(sesion).toBeNull()
  })
  it('asistencia general es el chip «activos»', () => {
    const u = new URL(enlaceParaEditarFiltros('L1', { ...completo, active_attendance: true }).href, 'http://x')
    expect(u.searchParams.get('activos')).toBe('1')
    expect(u.searchParams.get('asistencia_estudios')).toBeNull()
  })
  it('un filtro enorme va a la sesión con clave corta (como PAR-8)', () => {
    const muchas = Array.from({ length: 80 }, (_, i) => ({ ...cond, id: i + 1 }))
    const { href, sesion } = enlaceParaEditarFiltros('L1', { ...completo, conditions: muchas })
    const u = new URL(href, 'http://x')
    expect(u.searchParams.get('f')).toBeNull()
    expect(sesion?.clave).toBe(PREFIJO_SESION + u.searchParams.get('fk'))
    expect(decodificarFiltros(sesion!.valor)?.conditions).toHaveLength(80)
  })
})

describe('PAR-9 · quién puede editar', () => {
  const vieja = { created_by: null }
  it('los roles que gestionan listas', () => {
    expect(puedeEditarLista({ roles: ['comunicaciones'], memberId: 'x' }, vieja)).toBe(true)
    expect(puedeEditarLista({ roles: ['admin'], memberId: null }, vieja)).toBe(true)
  })
  it('quien la creó, aunque no tenga esos roles', () => {
    expect(puedeEditarLista({ roles: ['lider_comite'], memberId: 'm1' }, { created_by: 'm1' })).toBe(true)
  })
  it('nadie más, ni con una lista sin creador', () => {
    expect(puedeEditarLista({ roles: ['lider_comite'], memberId: 'm1' }, { created_by: 'm2' })).toBe(false)
    expect(puedeEditarLista({ roles: ['lider_comite'], memberId: null }, vieja)).toBe(false)
  })
})

describe('PAR-9 · aviso de impacto con un envío programado', () => {
  const f = (iso: string) => `F(${iso})`
  it('nada programado: sin aviso', () => {
    expect(avisoDeImpacto([], f)).toBeNull()
  })
  it('nombra el comunicado y cuándo sale', () => {
    const a = avisoDeImpacto([{ id: 'b', subject: 'Boletín', channel: 'email', scheduled_at: '2026-11-01T15:00:00Z' }], f)
    expect(a).toContain('«Boletín»')
    expect(a).toContain('F(2026-11-01T15:00:00Z)')
    expect(a).toContain('afecta a quién le llega')
  })
  it('varios: los cuenta', () => {
    const e = { id: 'b', subject: null, channel: 'email', scheduled_at: '2026-11-01T15:00:00Z' }
    expect(avisoDeImpacto([e, { ...e, id: 'c' }], f)).toMatch(/^Esta lista se usa en 2 comunicados/)
  })
})

describe('PAR-9 · listas fijas: agregar o quitar personas', () => {
  it('agregar no duplica y conserva el orden', () => {
    expect(aplicarCambioDePersonas(['a', 'b'], 'agregar_personas', ['b', 'c', 'c'])).toEqual({
      member_ids: ['a', 'b', 'c'], agregados: ['c'], quitados: [],
    })
  })
  it('quitar a alguien que no estaba no es error', () => {
    expect(aplicarCambioDePersonas(['a', 'b'], 'quitar_personas', ['b', 'z'])).toEqual({
      member_ids: ['a'], agregados: [], quitados: ['b'],
    })
  })
})

describe('PAR-9 · cableado', () => {
  const ruta = readFileSync('src/app/api/member-lists/[id]/route.ts', 'utf8')
  const miembros = readFileSync('src/app/(admin)/miembros/page.tsx', 'utf8')

  it('actualizar el filtro es un PATCH al MISMO id: la lista sigue sirviendo en comunicaciones', () => {
    expect(miembros).toMatch(/fetch\(`\/api\/member-lists\/\$\{listaEnEdicion\.id\}`[\s\S]{0,120}method: 'PATCH'[\s\S]{0,120}action: 'actualizar_filtros'/)
  })
  it('«Guardar como nueva» es un POST y no toca la original', () => {
    const i = miembros.indexOf("modoGuardado === 'actualizar'")
    const post = miembros.indexOf("fetch('/api/member-lists', {", i)
    expect(i).toBeGreaterThan(-1)
    expect(post).toBeGreaterThan(i)
    expect(miembros.slice(post, post + 200)).toContain("method: 'POST'")
  })
  it('la membresía la recalcula el servidor con el filtro nuevo', () => {
    expect(ruta).toMatch(/action === 'actualizar_filtros'[\s\S]*recomputeMemberList\(id\)/)
  })
  it('agregar/quitar personas se rechaza en listas con filtro (el recálculo lo borraría)', () => {
    expect(ruta).toContain("code: 'lista_con_filtro'")
  })
  it('cada cambio queda en la bitácora', () => {
    expect((ruta.match(/logAudit\(/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })
  it('el cuerpo se valida con zod', () => {
    expect(ruta).toContain('cuerpoPatch.safeParse')
  })
})
