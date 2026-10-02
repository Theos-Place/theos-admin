import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const PANTALLA = 'src/app/(admin)/finanzas/pagos/page.tsx'
const EXPORT = 'src/app/api/finance/payments/export/route.ts'
const QUERY = 'src/lib/supabase/queries/finance.ts'

describe('PAG-6 · el rango de fechas en la pantalla', () => {
  it('manda desde/hasta al SERVIDOR, no recorta en pantalla', () => {
    // La lista pagina de 25 en 25: filtrar en el cliente mostraría tres filas
    // con el total diciendo otra cosa.
    const src = sinComentarios(PANTALLA)
    expect(src).toContain("u.set('paid_from', desde)")
    expect(src).toContain("u.set('paid_to', hasta)")
  })

  it('los dos campos tienen label: un input de fecha sin rótulo no se entiende', () => {
    const src = readFileSync(PANTALLA, 'utf8')
    expect(src).toContain('htmlFor="pago-desde"')
    expect(src).toContain('htmlFor="pago-hasta"')
    expect(src).toContain('id="pago-desde"')
    expect(src).toContain('id="pago-hasta"')
  })

  it('la columna muestra la FECHA DE PAGO, no la de creación', () => {
    // Decía «Fecha» y mostraba created_at: cuándo se creó el cobro. Con el
    // filtro por fecha de pago al lado eso es una trampa — filtrar el 28 y
    // ver filas del 20 hace dudar del filtro, no de la columna.
    const src = sinComentarios(PANTALLA)
    expect(src).toContain("'Fecha de pago', 'Acciones'")
    expect(src).toMatch(/p\.paid_at \? \(?\s*(<p|formatDate\(p\.paid_at\))/)
  })

  it('y un cobro sin pagar lo dice, en vez de dejar la celda vacía', () => {
    expect(sinComentarios(PANTALLA)).toContain('Sin pagar')
  })

  it('el rango se puede limpiar sin recargar', () => {
    expect(sinComentarios(PANTALLA)).toMatch(/setDesde\(''\);\s*setHasta\(''\)/)
  })
})

describe('PAG-6 · el export', () => {
  it('usa EXACTAMENTE los mismos filtros que la lista', () => {
    // El riesgo real: que un filtro nuevo quede en la lista y no en el export,
    // y la hoja diga «los pagos de setiembre» trayendo otra cosa.
    const src = sinComentarios(PANTALLA)
    expect(src).toContain('const filtrosActuales = ()')
    expect(src).toMatch(/const buildUrl = \(page: number\) => \{\s*const u = filtrosActuales\(\)/)
    expect(src).toMatch(/urlDelExport = \(\) => `\/api\/finance\/payments\/export\?\$\{filtrosActuales\(\)/)
  })

  it('baja el RESULTADO del filtro, no la página abierta', () => {
    // Bajar 25 filas rotuladas «los pagos de setiembre» sería peor que no
    // tener export.
    expect(sinComentarios(EXPORT)).toMatch(/all: true/)
  })

  it('queda registrado: salen nombres y montos del sistema', () => {
    // Mismo criterio que el export del padrón y la hoja del aplicante.
    const src = sinComentarios(EXPORT)
    expect(src).toContain('logAudit')
    expect(src).toMatch(/action: 'EXPORT'/)
    expect(src).toMatch(/entityType: 'payments'/)
  })

  it('y no lo baja cualquiera con sesión', () => {
    expect(sinComentarios(EXPORT))
      .toMatch(/requireModuleView\(\['finanzas', 'revision_pagos'\]\)/)
  })

  it('la fecha va como TEXTO en la hoja, ya resuelta en día de Costa Rica', () => {
    // Si se escribe como fecha de Excel, el programa la reinterpreta en la
    // zona de la máquina de quien abre el archivo — deshaciendo justo la
    // conversión que evita el descuadre.
    const src = sinComentarios(EXPORT)
    expect(src).toMatch(/getColumn\(6\)\.numFmt = '@'/)
  })
})

describe('PAG-6 · la query', () => {
  it('filtra por paid_at y no por created_at', () => {
    // created_at es cuándo se CREÓ el cobro; la línea del banco tiene la
    // fecha en que entró la plata. No son el mismo día.
    const src = sinComentarios(QUERY)
    expect(src).toContain("q.gte('paid_at', desdeIso)")
    expect(src).toContain("q.lte('paid_at', hastaIso)")
  })

  it('convierte el rango a hora de Costa Rica antes de comparar', () => {
    expect(sinComentarios(QUERY))
      .toContain('rangoDePago(filters.paidFrom, filters.paidTo)')
  })

  it('`all` salta la paginación, que es lo que hace posible el export', () => {
    expect(sinComentarios(QUERY)).toMatch(/if \(!filters\.all\) q = q\.range\(/)
  })
})
