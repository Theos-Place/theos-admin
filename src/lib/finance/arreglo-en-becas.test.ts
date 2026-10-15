import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { rolPuedeOfrecerArreglo, ROLES_QUE_OFRECEN_ARREGLO } from './solicitud-de-beca'

// 2026-10-15 · «Ofrecer arreglo» (BEC-5 punto 6) se quedó sin pantalla al
// eliminar Solicitudes financieras el 14-oct. Vuelve en Becas, para el mismo
// rol que deja pasar el endpoint.
describe('ofrecer arreglo desde Becas', () => {
  it('lo ven finanzas y admin; quien solo administra becas, no', () => {
    expect(rolPuedeOfrecerArreglo(['finanzas'])).toBe(true)
    expect(rolPuedeOfrecerArreglo(['admin'])).toBe(true)
    expect(rolPuedeOfrecerArreglo(['becas'])).toBe(false)
    expect(rolPuedeOfrecerArreglo([])).toBe(false)
    expect(rolPuedeOfrecerArreglo(undefined)).toBe(false)
  })
  it('el endpoint usa la MISMA lista de roles', () => {
    const ep = readFileSync('src/app/api/finance/requests/[id]/route.ts', 'utf8')
    expect(ep).toContain('requireRoles(...ROLES_QUE_OFRECEN_ARREGLO)')
    expect(ROLES_QUE_OFRECEN_ARREGLO).toEqual(['finanzas'])
  })
  it('Becas muestra el botón en cada solicitud, para ese rol', () => {
    const becas = readFileSync('src/app/(admin)/finanzas/becas/page.tsx', 'utf8')
    expect(becas).toMatch(/const ofreceArreglo = rolPuedeOfrecerArreglo\(user\?\.roles\)/)
    expect(becas).toMatch(/\{ofreceArreglo && <OfrecerArregloButton req=\{r\} onDone=/)
  })
})
