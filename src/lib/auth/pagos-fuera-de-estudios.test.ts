import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { hasModulePermission } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const puedeRevisarPagos = (roles: string[]) =>
  hasModulePermission(roles as RoleId[], 'revision_pagos', 'view')

/**
 * FIN-14 · La coordinación de estudios y de dirigentes ya NO ve los pagos.
 *
 * Decisión de Floriana, 2026-09-30. Se descubrió haciendo DEV-2: ese ítem se
 * pidió con la premisa «no se le da acceso a pagos» y pedía un test de 403 a
 * `/finanzas/pagos` — un test que habría estado rojo desde el primer día,
 * porque los dos roles declaraban `revision_pagos`. Ahora la premisa es
 * cierta y el test se puede escribir.
 */
describe('FIN-14 · quién llega a la revisión de pagos', () => {
  it('coordinación de estudios y de dirigentes, NO', () => {
    expect(puedeRevisarPagos(['coordinador_estudios', 'miembro'])).toBe(false)
    expect(puedeRevisarPagos(['coordinador_dirigentes', 'miembro'])).toBe(false)
  })

  it('finanzas, dirección y el rol dedicado, SÍ', () => {
    for (const r of ['finanzas', 'direccion', 'revision_pagos', 'admin']) {
      expect(puedeRevisarPagos([r, 'miembro']), r).toBe(true)
    }
  })

  it('`folletos` TODAVÍA lo tiene — no se pidió quitarlo', () => {
    /**
     * Se deja escrito para que no parezca un olvido. Son 4 personas y DOS
     * entran solo por este rol (Gisselle Lopez y Guiselle López, medido el
     * 2026-09-30): si algún día se decide quitarlo, esas dos pierden la
     * pantalla y hay que avisarles.
     */
    expect(puedeRevisarPagos(['folletos', 'miembro'])).toBe(true)
  })
})

/**
 * LO QUE HACE SEGURO EL CAMBIO, y por eso se fija con un test: registrar un
 * pago de matrícula NO pasa por `revision_pagos`.
 *
 * La única de las 13 personas con esos dos roles que había tocado un pago es
 * la cuenta `estudios@theosplace.org` —82 altas y 77 ediciones, la última el
 * mismo día del cambio—, y su flujo sigue funcionando porque el endpoint que
 * lo hace se gatea con el módulo `estudios`. Si alguien cambiara ese guard a
 * `revision_pagos`, le rompería ese trabajo sin darse cuenta.
 */
describe('FIN-14 · registrar un pago sigue siendo de estudios', () => {
  it('`/api/payments` se gatea con el módulo estudios', () => {
    const s = sinComentarios('src/app/api/payments/route.ts')
    expect(s).toContain("requireModuleView('estudios')")
    expect(s).not.toContain("requireModuleView('revision_pagos')")
  })

  it('y la coordinación de estudios conserva ese módulo', () => {
    expect(hasModulePermission(['coordinador_estudios'] as RoleId[], 'estudios', 'create')).toBe(true)
    expect(hasModulePermission(['coordinador_estudios'] as RoleId[], 'estudios', 'edit')).toBe(true)
  })

  it('la cola de revisión, en cambio, sí se les cierra', () => {
    // Son los endpoints que de verdad pierden, y conviene que estén nombrados:
    // si mañana alguien afloja uno, este test lo señala.
    for (const ruta of [
      'src/app/api/payments/queue/route.ts',
      'src/app/api/payments/bulk/route.ts',
      'src/app/api/payments/[id]/review/route.ts',
      'src/app/api/payments/[id]/remind/route.ts',
    ]) {
      expect(sinComentarios(ruta), ruta).toContain("requireModuleView('revision_pagos'")
    }
  })
})
