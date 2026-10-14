import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  subtotal, totales, revisarPresupuesto, anticipoCabe,
  RUBROS, NOMBRE_DEL_RUBRO, MONEDAS, type LineaDePresupuesto,
} from './presupuesto'

const linea = (over: Partial<LineaDePresupuesto> = {}): LineaDePresupuesto => ({
  rubro: 'hospedaje', cantidad: 2, tarifa: 30000, moneda: 'CRC', ...over,
})

describe('FIN-11 · el subtotal de una línea', () => {
  it('cantidad × tarifa', () => {
    expect(subtotal({ cantidad: 2, tarifa: 30000 })).toBe(60000)
  })

  it('no arrastra basura de flotante', () => {
    // 0.1 × 3 da 0.30000000000000004, y ese número se imprime en un anexo
    // que alguien firma.
    expect(subtotal({ cantidad: 3, tarifa: 0.1 })).toBe(0.3)
    expect(subtotal({ cantidad: 3, tarifa: 56999.99 })).toBe(170999.97)
  })

  it('aguanta vacíos sin romperse', () => {
    expect(subtotal({ cantidad: 0, tarifa: 100 })).toBe(0)
    expect(subtotal({ cantidad: NaN, tarifa: 100 })).toBe(0)
  })
})

describe('FIN-11 · los totales NUNCA son un número solo', () => {
  it('un viaje en una sola moneda da un total', () => {
    const t = totales([linea({ cantidad: 2, tarifa: 30000 }), linea({ rubro: 'peajes', cantidad: 4, tarifa: 1000 })])
    expect(t).toEqual([{ moneda: 'CRC', total: 64000, lineas: 2 }])
  })

  it('UN VIAJE MIXTO DA DOS TOTALES, no una suma (INT-3)', () => {
    // «₡180.000 + $340» no es un número: sumarlos inventa un tipo de cambio
    // que nadie autorizó.
    const t = totales([
      linea({ rubro: 'pasajes', cantidad: 1, tarifa: 340, moneda: 'USD' }),
      linea({ rubro: 'hospedaje', cantidad: 3, tarifa: 60000, moneda: 'CRC' }),
    ])
    expect(t).toEqual([
      { moneda: 'CRC', total: 180000, lineas: 1 },
      { moneda: 'USD', total: 340, lineas: 1 },
    ])
  })

  it('el orden es el de MONEDAS, no el de captura', () => {
    const t = totales([linea({ moneda: 'USD', cantidad: 1, tarifa: 1 }), linea({ moneda: 'CRC', cantidad: 1, tarifa: 1 })])
    expect(t.map(x => x.moneda)).toEqual(['CRC', 'USD'])
  })

  it('una moneda sin líneas no aparece con cero', () => {
    const t = totales([linea({ moneda: 'CRC' })])
    expect(t.map(x => x.moneda)).toEqual(['CRC'])
  })

  it('sin líneas, lista vacía', () => {
    expect(totales([])).toEqual([])
  })

  it('NO existe una función que convierta entre monedas', () => {
    // El guard de la decisión: el día que alguien agregue un tipo de cambio,
    // que sea una decisión tomada y no un `convertir()` que apareció solo.
    const src = readFileSync('src/lib/travel/presupuesto.ts', 'utf8')
    expect(src).not.toMatch(/tipoDeCambio|tipo_de_cambio|exchangeRate|convertir\(/)
  })
})

describe('FIN-11 · qué no deja enviar el presupuesto', () => {
  it('un presupuesto bien no tiene problemas', () => {
    expect(revisarPresupuesto([linea()])).toEqual([])
  })

  it('cantidad en cero o negativa', () => {
    expect(revisarPresupuesto([linea({ cantidad: 0 })])[0].mensaje).toContain('mayor que cero')
    expect(revisarPresupuesto([linea({ cantidad: -1 })])[0].mensaje).toContain('mayor que cero')
  })

  it('la tarifa SÍ puede ser cero: un pasaje donado existe', () => {
    expect(revisarPresupuesto([linea({ tarifa: 0 })])).toEqual([])
  })

  it('pero negativa no: sería restar del total por la puerta de atrás', () => {
    expect(revisarPresupuesto([linea({ tarifa: -5000 })])[0].mensaje).toContain('negativa')
  })

  it('rubro o moneda que no existen', () => {
    expect(revisarPresupuesto([linea({ rubro: 'souvenirs' as never })])[0].mensaje).toContain('Rubro')
    expect(revisarPresupuesto([linea({ moneda: 'EUR' as never })])[0].mensaje).toContain('Moneda')
  })

  it('dice EN CUÁL fila está el problema', () => {
    const p = revisarPresupuesto([linea(), linea({ cantidad: 0 })])
    expect(p).toHaveLength(1)
    expect(p[0].indice).toBe(1)
  })
})

describe('FIN-11 · el anticipo contra su propia moneda', () => {
  const presupuesto = [
    linea({ rubro: 'hospedaje', cantidad: 3, tarifa: 60000, moneda: 'CRC' }),
    linea({ rubro: 'pasajes', cantidad: 1, tarifa: 340, moneda: 'USD' }),
  ]

  it('un anticipo que cabe, pasa', () => {
    expect(anticipoCabe({ monto: 100000, moneda: 'CRC' }, presupuesto)).toEqual({ ok: true })
  })

  it('PEDIR $300 EN UN VIAJE DE ₡180.000 NO ES UN ANTICIPO CHICO', () => {
    // Sin comparar contra su propia moneda, «300 < 180000» lo daba por bueno.
    // Acá el total en USD es 340, así que 300 sí cabe; 400 no.
    expect(anticipoCabe({ monto: 400, moneda: 'USD' }, presupuesto).ok).toBe(false)
    expect(anticipoCabe({ monto: 300, moneda: 'USD' }, presupuesto).ok).toBe(true)
  })

  it('un anticipo en una moneda que el presupuesto no tiene', () => {
    const r = anticipoCabe({ monto: 50, moneda: 'USD' }, [linea({ moneda: 'CRC' })])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('no tiene nada en esa moneda')
  })

  it('sin anticipo, no hay nada que revisar', () => {
    expect(anticipoCabe(null, presupuesto)).toEqual({ ok: true })
    expect(anticipoCabe({ monto: 0, moneda: 'CRC' }, presupuesto)).toEqual({ ok: true })
  })

  it('el anticipo puede ser igual al total', () => {
    expect(anticipoCabe({ monto: 180000, moneda: 'CRC' }, presupuesto).ok).toBe(true)
  })
})

describe('FIN-11 · el catálogo de rubros', () => {
  it('están los diez del anexo y todos tienen nombre', () => {
    expect(RUBROS).toHaveLength(10)
    for (const r of RUBROS) expect(NOMBRE_DEL_RUBRO[r]).toBeTruthy()
  })

  it('«km» existe desde ya aunque la bitácora sea de la fase C', () => {
    expect(RUBROS).toContain('km')
  })

  it('las monedas son una lista cerrada', () => {
    expect([...MONEDAS]).toEqual(['CRC', 'USD'])
  })
})
