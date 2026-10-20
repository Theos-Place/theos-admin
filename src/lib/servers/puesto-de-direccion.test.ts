import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esPuestoDeDireccion } from './puesto-de-direccion'
import { puedeVerReporte, ACCESO_POR_REPORTE, type SlugDeReporte } from '@/lib/reports/acceso-por-reporte'
import type { PositionContext } from './position-roles'

const p = (title: string, areaName: string, areaType: 'area' | 'committee'): PositionContext =>
  ({ title, areaName, areaType, parentAreaName: null })

describe('REP-18 · los puestos de dirección ven todos los reportes (2026-10-20)', () => {
  it('Director de Área y cualquier puesto del comité Directores', () => {
    expect(esPuestoDeDireccion(p('Director de Área', 'Area Finanzas', 'area'))).toBe(true)
    expect(esPuestoDeDireccion(p('Director Ejecutivo', 'Directores', 'committee'))).toBe(true)
    expect(esPuestoDeDireccion(p('Director General', 'Directores', 'committee'))).toBe(true)
  })

  it('el Consejo Dirección no (aclaración 2026-10-20), ni otros puestos', () => {
    expect(esPuestoDeDireccion(p('Miembro Consejo Dirección', 'Consejo Dirección', 'committee'))).toBe(false)
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

  it('también los reportes de Finanzas (solo lectura, con montos) y el contacto de Personas nuevas', () => {
    expect(readFileSync('src/app/api/finance/donations/route.ts', 'utf8')).toContain("!veMontosDeDonacion(auth.ctx.roles) && !auth.direccionPorPuesto")
    expect(readFileSync('src/app/api/finance/payments/route.ts', 'utf8')).toContain("requireVistaFinanciera(['finanzas', 'revision_pagos'])")
    expect(readFileSync('src/app/api/finance/donaciones/reporte/route.ts', 'utf8')).toContain('requireVistaFinanciera(null)')
    expect(readFileSync('src/app/api/reports/personas-nuevas/route.ts', 'utf8')).toContain('await tienePuestoDeDireccion(auth.ctx.memberId)')
    for (const p of ['src/app/(admin)/finanzas/reportes/page.tsx', 'src/app/(admin)/finanzas/donaciones/reporte/page.tsx']) {
      expect(readFileSync(p, 'utf8'), p).toContain('<FinanceGuard reportes>')
    }
    // Entra a mirar: las escrituras siguen por rol, y el panel esconde la gestión.
    expect(readFileSync('src/app/api/finance/donations/route.ts', 'utf8')).toContain("requireRoles('finanzas', 'direccion')")
    expect(readFileSync('src/components/finance/DonacionesPanel.tsx', 'utf8')).toContain("const gestiona = can('finanzas', 'edit')")
  })
})
