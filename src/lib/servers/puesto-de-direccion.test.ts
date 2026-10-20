import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esPuestoDeDireccion } from './puesto-de-direccion'
import { puedeVerReporte, ACCESO_POR_REPORTE, type SlugDeReporte } from '@/lib/reports/acceso-por-reporte'
import type { PositionContext } from './position-roles'

const p = (title: string, areaName: string, areaType: 'area' | 'committee'): PositionContext =>
  ({ title, areaName, areaType, parentAreaName: null })

describe('REP-13 · los puestos de dirección ven todos los reportes (2026-10-20)', () => {
  it('Director de Área, Directores y Consejo Dirección son de dirección', () => {
    expect(esPuestoDeDireccion(p('Director de Área', 'Area Finanzas', 'area'))).toBe(true)
    expect(esPuestoDeDireccion(p('Director Ejecutivo', 'Directores', 'committee'))).toBe(true)
    expect(esPuestoDeDireccion(p('Miembro Consejo Dirección', 'Consejo Dirección', 'committee'))).toBe(true)
  })

  it('otros puestos no, aunque digan «director» o estén cerca', () => {
    expect(esPuestoDeDireccion(p('Encargado Comité', 'Comité Finanzas', 'committee'))).toBe(false)
    expect(esPuestoDeDireccion(p('Colaborador', 'Comité Planificación', 'committee'))).toBe(false)
  })

  it('con el puesto se abren los NUEVE reportes, sin ningún rol', () => {
    const slugs = Object.keys(ACCESO_POR_REPORTE) as SlugDeReporte[]
    expect(slugs.length).toBeGreaterThanOrEqual(9)
    for (const s of slugs) expect(puedeVerReporte(s, { roles: [], tieneModulo: false, direccionPorPuesto: true }), s).toBe(true)
    // Sin el puesto, el rol `reportes` solo no alcanza para Estudios: el bug.
    expect(puedeVerReporte('estudios', { roles: ['reportes'], tieneModulo: true })).toBe(false)
  })

  it('el servidor, el menú y la pantalla miran la misma señal', () => {
    expect(readFileSync('src/lib/auth/guard.ts', 'utf8')).toContain('tienePuestoDeDireccion(ctx.memberId)')
    expect(readFileSync('src/app/api/auth/me/route.ts', 'utf8')).toContain('direccion_por_puesto: direccionPorPuesto')
    expect(readFileSync('src/hooks/useAccesoAReporte.ts', 'utf8')).toContain('direccionPorPuesto: user?.direccion_por_puesto === true')
    expect(readFileSync('src/app/(admin)/reportes/page.tsx', 'utf8')).toContain('direccionPorPuesto: user?.direccion_por_puesto === true')
    expect(readFileSync('src/components/layout/Sidebar.tsx', 'utf8')).toContain('user?.direccion_por_puesto === true')
  })

  it('en «Los que no volvieron» ve a TODOS, no solo a los propios', () => {
    for (const r of ['src/app/api/reports/exalumnos-perdidos/route.ts', 'src/app/api/reports/exalumnos-perdidos/contacto/route.ts']) {
      expect(readFileSync(r, 'utf8'), r).toContain('tienePuestoDeDireccion')
    }
  })
})
