import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { puedeAplicarBeca, cobroAdmiteBeca } from './quien-aplica-beca'

describe('quién aplica una beca a un cobro', () => {
  it('los roles de becas y de revisión de pagos', () => {
    expect(puedeAplicarBeca(['becas'])).toBe(true)
    expect(puedeAplicarBeca(['revision_pagos'])).toBe(true)
    expect(puedeAplicarBeca(['finanzas'])).toBe(true)
  })

  it('un miembro cualquiera NO: es su propio perfil, no su decisión', () => {
    /**
     * Este botón aparece en el perfil del miembro, que la persona también
     * abre. Sin este corte, cualquiera se aplicaría una beca a sí mismo.
     */
    expect(puedeAplicarBeca(['miembro'])).toBe(false)
    expect(puedeAplicarBeca(['dirigente'])).toBe(false)
    expect(puedeAplicarBeca([])).toBe(false)
    expect(puedeAplicarBeca(null)).toBe(false)
  })

  it('ni quien solo MIRA el módulo', () => {
    expect(puedeAplicarBeca(['solo_lectura'])).toBe(false)
  })

  it('es el espejo del guard del endpoint, que sigue siendo el permiso', () => {
    const ruta = readFileSync('src/app/api/payments/[id]/apply-scholarship/route.ts', 'utf8')
    expect(ruta).toContain("requireModuleView(['becas', 'revision_pagos'], { action: 'edit' })")
  })
})

describe('qué cobro admite una beca', () => {
  it('solo mientras esté pendiente', () => {
    expect(cobroAdmiteBeca({ queue_status: 'pendiente' })).toBe(true)
    expect(cobroAdmiteBeca({ status: 'pending' })).toBe(true)
  })

  it('sobre uno ya pagado NO: eso es una devolución, no una beca', () => {
    /**
     * Aplicar una beca a un pago que ya entró no le devuelve la plata a
     * nadie: deja el monto cambiado debajo de un cobro cobrado.
     */
    expect(cobroAdmiteBeca({ queue_status: 'cerrado' })).toBe(false)
    expect(cobroAdmiteBeca({ status: 'paid' })).toBe(false)
  })

  it('manda `queue_status` cuando viene: es el estado de la cola', () => {
    expect(cobroAdmiteBeca({ queue_status: 'cerrado', status: 'pending' })).toBe(false)
  })
})

describe('el cableado: la misma regla en las dos pantallas', () => {
  const sinComentarios = (r: string) =>
    readFileSync(r, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')

  const PERFIL = sinComentarios('src/components/members/MemberPaymentsList.tsx')
  const BOTON = sinComentarios('src/components/finance/AplicarBecaEnCobro.tsx')

  it('va DENTRO del modal de pago, que es lo que se abre desde los dos lados', () => {
    /**
     * Mi primer intento lo puso al lado del botón en la lista de pagos, y
     * desde ahí NO se veía: la fila del HISTORIAL DE ESTUDIOS —que es desde
     * donde Floriana lo abrió— no pasa por `MemberPaymentsList`, llama a
     * `PayMatriculaButton` directo con el enrollmentId.
     *
     * En el modal lo alcanzan los dos caminos, y es el único lugar donde el
     * cobro ya está cargado con su id.
     */
    const i = PERFIL.indexOf('export function PayMatriculaButton')
    expect(i).toBeGreaterThan(-1)
    expect(PERFIL.slice(i)).toContain('<AplicarBecaEnCobro')
    expect(PERFIL.slice(i)).toContain('pagoId={detalle.id}')
  })

  it('y la fila de estudios abre ESE modal, no uno propio', () => {
    const tab = sinComentarios('src/app/(admin)/miembros/[id]/_components/MemberParticipationTab.tsx')
    expect(tab).toContain('<PayMatriculaButton')
    expect(tab).not.toContain('AplicarBecaEnCobro')
  })

  it('el perfil usa el helper, no escribe el permiso a mano', () => {
    /**
     * La línea `can('becas','edit') || canReview` vivía suelta en la pantalla
     * de finanzas. Copiarla acá habría dejado dos permisos que se separan: uno
     * se aprieta, el otro no, y queda un botón que contesta 403 — o peor, uno
     * que no aparece aunque el endpoint sí dejaría pasar.
     */
    expect(PERFIL).toContain('puedeAplicarBeca(user?.roles)')
    expect(PERFIL).not.toMatch(/can\('becas'/)
  })

  it('y solo sobre cobros que admiten beca', () => {
    // Sobre uno ya pagado no se ofrece: eso sería una devolución.
    expect(PERFIL).toContain('cobroAdmiteBeca(detalle)')
  })

  it('el botón pega contra EL MISMO endpoint que la cola de finanzas', () => {
    // Un endpoint propio sería una segunda forma de aplicar becas, con su
    // propia idea de qué pasa cuando la beca cubre todo.
    expect(BOTON).toContain('/apply-scholarship')
    expect(BOTON).toContain('/scholarship-options')
    const cola = sinComentarios('src/components/finance/PaymentReviewQueue.tsx')
    expect(cola).toContain('/apply-scholarship')
  })

  it('distingue beca completa de parcial, que para la persona es muy distinto', () => {
    // Con la completa ya no tiene que pagar nada ni subir comprobante.
    expect(BOTON).toContain('d.covered')
    expect(BOTON).toContain('no hace falta comprobante')
  })

  it('usa el Modal compartido', () => {
    expect(BOTON).toContain("from '@/components/shared/Modal'")
  })
})
