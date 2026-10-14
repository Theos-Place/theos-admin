import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { veMontosDeDonacion, ROLES_QUE_VEN_MONTOS_DE_DONACION } from './quien-ve-montos'

const sin = (r: string) => readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('quién ve montos de donación', () => {
  it('finanzas, dirección y admin; nadie más', () => {
    expect(veMontosDeDonacion(['admin'])).toBe(true)      // el caso del bug
    expect(veMontosDeDonacion(['direccion'])).toBe(true)
    expect(veMontosDeDonacion(['finanzas'])).toBe(true)
    expect(veMontosDeDonacion(['revision_pagos'])).toBe(false)
    expect(veMontosDeDonacion(['miembro'])).toBe(false)
  })

  it('el listado y el reporte usan LA MISMA regla', () => {
    expect(sin('src/app/api/finance/donations/route.ts')).toContain('!veMontosDeDonacion(auth.ctx.roles)')
    expect(sin('src/app/api/finance/donations/route.ts')).not.toContain("roles.includes('finanzas')")
    expect(sin('src/app/api/finance/donaciones/reporte/route.ts')).toContain('const ROLES = ROLES_QUE_VEN_MONTOS_DE_DONACION')
    expect(ROLES_QUE_VEN_MONTOS_DE_DONACION).toEqual(['finanzas', 'direccion', 'admin'])
  })

  it('las tarjetas de donantes explican su definición', () => {
    const p = sin('src/components/finance/DonacionesPanel.tsx')
    expect(p).toContain('info: explicacionDeDonantes(new Date())')
    expect(p).toContain('<InfoDelEncabezado texto={info} />')
  })
})
