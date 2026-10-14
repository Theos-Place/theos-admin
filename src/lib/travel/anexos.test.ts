import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  armarAnexo, anexoTieneContenido, anexosDelExpediente, nombreDeLaHoja,
  plata, fechaCorta, ORDEN_DE_ANEXOS, CODIGO_DEL_ANEXO,
  type ExpedienteParaImprimir,
} from './anexos'

const exp = (over: Partial<ExpedienteParaImprimir> = {}): ExpedienteParaImprimir => ({
  destino: 'Bogotá', tipo: 'capacitacion', alcance: 'internacional',
  sale_at: '2026-11-10T08:00:00Z', vuelve_at: '2026-11-14T20:00:00Z',
  acompanantes: null, objetivo: 'Congreso', agenda: null, beneficio: null,
  resultado_esperado: null, financiamiento: null, centro_costo: null,
  anticipo_monto: null, anticipo_moneda: null,
  anticipo_recibido_monto: null, anticipo_recibido_moneda: null,
  monto_maximo_politica: null, notas_finanzas: null, notas_liquidacion: null,
  lineas: [], gastos: [], saldos: [], tramos: [],
  km_totales: 0, km_tarifa: 0, km_moneda: 'CRC',
  aprobacion_jefe_path: null,
  informe: { actividades: null, resultados: null, lecciones: null, recomendaciones: null },
  informe_archivos: [],
  ...over,
})

describe('FIN-11 · la plata del papel', () => {
  it('colones con puntos de miles y sin decimales', () => {
    expect(plata(180000, 'CRC')).toBe('₡180.000')
  })

  it('dólares con dos decimales', () => {
    expect(plata(340.5, 'USD')).toBe('$340,50')
  })

  it('NO depende del idioma de la computadora', () => {
    // Una hoja que se archiva no puede cambiar de separador de miles según
    // desde dónde se imprimió, así que no usa Intl.
    const src = readFileSync('src/lib/travel/anexos.ts', 'utf8')
    expect(src).not.toContain('Intl.')
    expect(src).not.toContain('toLocaleString')
  })

  it('el cero se imprime, no se esconde', () => {
    expect(plata(0, 'CRC')).toBe('₡0')
  })
})

describe('FIN-11 · la fecha del papel', () => {
  it('sale del string, sin zona horaria', () => {
    // `new Date('2026-11-10')` es medianoche UTC y en Costa Rica sería el 9.
    expect(fechaCorta('2026-11-10T08:00:00Z')).toBe('10 nov 2026')
    expect(fechaCorta('2026-01-05')).toBe('5 ene 2026')
  })

  it('sin fecha, raya', () => {
    expect(fechaCorta(null)).toBe('—')
    expect(fechaCorta('cuando sea')).toBe('—')
  })
})

describe('FIN-11 · qué anexo se imprime', () => {
  it('la solicitud siempre', () => {
    expect(anexoTieneContenido(exp(), 'solicitud')).toBe(true)
  })

  it('los demás solo si tienen algo', () => {
    const vacio = exp()
    for (const c of ['presupuesto', 'liquidacion', 'bitacora', 'informe'] as const) {
      expect(anexoTieneContenido(vacio, c), c).toBe(false)
    }
  })

  it('un expediente vacío imprime UNA hoja, no cinco en blanco', () => {
    expect(anexosDelExpediente(exp()).map(a => a.clave)).toEqual(['solicitud'])
  })

  it('el orden es el del reglamento, no el de las fases', () => {
    // La bitácora (ANX-05) va antes que el informe (ANX-04) porque sigue a
    // la liquidación, que es a lo que pertenece.
    expect([...ORDEN_DE_ANEXOS]).toEqual(['solicitud', 'presupuesto', 'liquidacion', 'bitacora', 'informe'])
  })

  it('se puede pedir UNO solo, aunque esté vacío', () => {
    // Para el archivo físico: a veces hace falta el anexo en blanco.
    expect(anexosDelExpediente(exp(), 'bitacora').map(a => a.codigo)).toEqual(['ANX-05'])
  })
})

describe('FIN-11 · el presupuesto impreso', () => {
  const e = exp({
    lineas: [
      { rubro: 'pasajes', cantidad: 1, tarifa: 340, moneda: 'USD' },
      { rubro: 'hospedaje', cantidad: 3, tarifa: 60000, moneda: 'CRC' },
    ],
  })

  it('UN TOTAL POR MONEDA, nunca uno solo', () => {
    const tabla = armarAnexo(e, 'presupuesto').bloques[0]
    expect(tabla.tipo).toBe('tabla')
    if (tabla.tipo !== 'tabla') return
    const totales = tabla.filas.filter(f => f.esTotal).map(f => f.celdas.slice(-2))
    expect(totales).toEqual([['Total CRC', '₡180.000'], ['Total USD', '$340,00']])
  })

  it('las líneas van con su subtotal', () => {
    const tabla = armarAnexo(e, 'presupuesto').bloques[0]
    if (tabla.tipo !== 'tabla') return
    expect(tabla.filas[0].celdas).toContain('$340,00')
  })
})

describe('FIN-11 · la liquidación impresa', () => {
  it('dice si cada gasto tiene comprobante, y si no, por qué', () => {
    const e = exp({
      gastos: [{ fecha: '2026-11-11', rubro: 'alimentacion', monto: 9000, moneda: 'CRC', receipt_path: null, sin_comprobante_motivo: 'soda sin factura' }],
      saldos: [{ moneda: 'CRC', gastado: 9000, anticipo: 0, diferencia: -9000, resultado: 'reembolsar' }],
    })
    const tabla = armarAnexo(e, 'liquidacion').bloques[0]
    if (tabla.tipo !== 'tabla') return
    expect(tabla.filas[0].celdas).toContain('No — soda sin factura')
  })

  it('cada moneda dice quién le debe a quién, por separado', () => {
    const e = exp({
      gastos: [{ fecha: '2026-11-11', rubro: 'otros', monto: 1, moneda: 'CRC', receipt_path: 'x', sin_comprobante_motivo: null }],
      saldos: [
        { moneda: 'CRC', gastado: 150000, anticipo: 0, diferencia: -150000, resultado: 'reembolsar' },
        { moneda: 'USD', gastado: 0, anticipo: 200, diferencia: 200, resultado: 'reintegrar' },
      ],
    })
    const datos = armarAnexo(e, 'liquidacion').bloques[1]
    if (datos.tipo !== 'datos') return
    const texto = datos.filas.map(f => f.join(': ')).join(' | ')
    expect(texto).toContain('La Asociación le reembolsa ₡150.000')
    expect(texto).toContain('Reintegra a la Asociación $200,00')
  })
})

describe('FIN-11 · la bitácora impresa', () => {
  it('lleva el odómetro de cada tramo y el total', () => {
    const e = exp({
      tramos: [{ fecha: '2026-11-03', origen: 'A', destino: 'B', km_inicial: 10000, km_final: 10150 }],
      km_totales: 150,
    })
    const tabla = armarAnexo(e, 'bitacora').bloques[0]
    if (tabla.tipo !== 'tabla') return
    expect(tabla.filas[0].celdas).toEqual(['3 nov 2026', 'A', 'B', '—', '—', '10000', '10150', '150 km'])
    expect(tabla.filas.at(-1)!.esTotal).toBe(true)
  })

  it('DICE EN MAYÚSCULAS si falta la aprobación del jefe', () => {
    // Es requisito del reglamento: en el papel archivado tiene que saltar a
    // la vista que no está.
    const e = exp({ tramos: [{ fecha: '2026-11-03', origen: 'A', destino: 'B', km_inicial: 1, km_final: 2 }] })
    const datos = armarAnexo(e, 'bitacora').bloques[1]
    if (datos.tipo !== 'datos') return
    expect(datos.filas.map(f => f[1])).toContain('NO ADJUNTA')
  })
})

describe('FIN-11 · el nombre del archivo', () => {
  it('el expediente completo', () => {
    expect(nombreDeLaHoja('Bogotá', 'Ana Mora')).toBe('Expediente de viaje - Bogotá - Ana Mora')
  })

  it('un anexo suelto lleva su código', () => {
    expect(nombreDeLaHoja('Bogotá', 'Ana Mora', 'bitacora'))
      .toBe('ANX-05 Bitácora de kilometraje - Bogotá - Ana Mora')
  })

  it('limpia lo que el sistema de archivos no acepta', () => {
    expect(nombreDeLaHoja('San José/Alajuela', 'Ana  Mora')).toContain('San José-Alajuela - Ana Mora')
  })

  it('los cinco códigos del reglamento están', () => {
    expect(Object.values(CODIGO_DEL_ANEXO).sort())
      .toEqual(['ANX-01', 'ANX-02', 'ANX-03', 'ANX-04', 'ANX-05'])
  })
})
