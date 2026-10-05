import { describe, it, expect } from 'vitest'
import {
  construirReporteDeDonantes, totalesEnTexto, SIN_SEDE,
  type DonacionParaReporte,
} from '@/lib/finance/reporte-de-donantes'

const d = (p: Partial<DonacionParaReporte> = {}): DonacionParaReporte => ({
  member_id: 'p1', donation_date: '2026-03-10', amount: 1000, currency: 'CRC',
  sede: 'Pedregal Domingo', ...p,
})

describe('DON-3B · un donante es una PERSONA, no una donación', () => {
  it('quien donó treinta veces cuenta UNA', () => {
    // Es la diferencia entre «768 personas sostienen esto» y «1 980
    // depósitos entraron», y la primera es la que se usa para decidir.
    const filas = Array.from({ length: 30 }, (_, i) =>
      d({ member_id: 'p1', donation_date: `2026-03-${String(i % 28 + 1).padStart(2, '0')}` }))
    const r = construirReporteDeDonantes(filas)
    expect(r.total.donantes).toBe(1)
    expect(r.total.donaciones).toBe(30)
  })

  it('y cuenta una vez DENTRO de cada grupo', () => {
    const r = construirReporteDeDonantes([
      d({ member_id: 'p1', donation_date: '2026-03-01' }),
      d({ member_id: 'p1', donation_date: '2026-03-20' }),
      d({ member_id: 'p2', donation_date: '2026-03-05' }),
    ])
    expect(r.porMes.find(m => m.periodo === '2026-03')?.donantes).toBe(2)
  })

  it('la misma persona en dos meses cuenta en los dos, y una vez en el total', () => {
    // Los donantes de los grupos NO suman el total. Es correcto, pero invita
    // a restar y encontrar un descuadre que no existe.
    const r = construirReporteDeDonantes([
      d({ member_id: 'p1', donation_date: '2026-03-01' }),
      d({ member_id: 'p1', donation_date: '2026-08-01' }),
    ])
    expect(r.total.donantes).toBe(1)
    expect(r.porMes.reduce((a, m) => a + m.donantes, 0)).toBe(2)
  })
})

describe('DON-3B · INT-3 · las monedas no se mezclan', () => {
  it('cada moneda lleva su total', () => {
    const r = construirReporteDeDonantes([
      d({ amount: 1000, currency: 'CRC' }),
      d({ amount: 2000, currency: 'CRC' }),
      d({ amount: 50, currency: 'EUR' }),
    ])
    expect(r.total.totales).toEqual({ CRC: 3000, EUR: 50 })
  })

  it('la moneda en blanco cuenta como colones', () => {
    expect(construirReporteDeDonantes([d({ currency: null, amount: 500 })]).total.totales)
      .toEqual({ CRC: 500 })
  })

  it('el texto los une con «+», nunca los suma', () => {
    const txt = totalesEnTexto({ CRC: 3000, EUR: 50 }, (m, c) => `${c} ${m}`)
    expect(txt).toBe('CRC 3000 + EUR 50')
    expect(txt).not.toContain('3050')
  })
})

describe('DON-3B · las donaciones sin monto', () => {
  it('se cuentan aparte y NO como cero', () => {
    // Cero afirmaría que entró una donación de nada; lo que pasa es que no
    // se sabe cuánto.
    const r = construirReporteDeDonantes([d({ amount: 1000 }), d({ amount: null })])
    expect(r.total.totales).toEqual({ CRC: 1000 })
    expect(r.total.sinMonto).toBe(1)
    expect(r.total.donaciones).toBe(2)
  })

  it('sin NINGÚN monto, el reporte lo dice en vez de mostrar ₡0', () => {
    // Es el estado real de producción hoy: los montos no se han importado.
    // Un «₡0» se leería como «nadie donó», que es falso.
    const r = construirReporteDeDonantes([d({ amount: null }), d({ amount: null })])
    expect(r.hayMontos).toBe(false)
    expect(r.total.totales).toEqual({})
    expect(totalesEnTexto(r.total.totales, (m, c) => `${c} ${m}`)).toBe('')
  })

  it('con al menos uno, sí hay montos', () => {
    expect(construirReporteDeDonantes([d({ amount: 1 })]).hayMontos).toBe(true)
  })

  it('un monto de CERO cuenta como sin monto, no como cero colones', () => {
    /**
     * Esto lo agarró la prueba contra PRODUCCIÓN, no los tests: las 15 276
     * donaciones tienen `amount = 0.00`, no `null`. Con el chequeo obvio
     * —«¿es un número?»— el reporte daba `hayMontos: true` y un total de
     * «₡0», que es justo la mentira que este módulo evita. Mis fixtures
     * escribían `null` para «sin monto»; la base escribe `0`.
     */
    const r = construirReporteDeDonantes([d({ amount: 0 }), d({ amount: 0 })])
    expect(r.hayMontos).toBe(false)
    expect(r.total.totales).toEqual({})
    expect(r.total.sinMonto).toBe(2)
  })

  it('y un cero no se come a los que sí tienen monto', () => {
    const r = construirReporteDeDonantes([d({ amount: 0 }), d({ amount: 500 })])
    expect(r.hayMontos).toBe(true)
    expect(r.total.totales).toEqual({ CRC: 500 })
    expect(r.total.sinMonto).toBe(1)
  })
})

describe('DON-3B · el desglose por sede', () => {
  it('los donantes SIN sede son una categoría visible', () => {
    // Son 250 de 1 882 en producción, y a Meli le interesa identificarlos
    // justamente porque no aparecen por ninguna charla.
    const r = construirReporteDeDonantes([
      d({ member_id: 'p1', sede: 'Pedregal Domingo' }),
      d({ member_id: 'p2', sede: null }),
      d({ member_id: 'p3', sede: '  ' }),
    ])
    const sinSede = r.porSede.find(s => s.sede === SIN_SEDE)
    expect(sinSede?.donantes).toBe(2)
  })

  it('«Sin sede» va al final aunque sea el grupo más grande', () => {
    // Es una categoría de otro tipo, no una sede más: mezclarla en el orden
    // la haría parecer una.
    const r = construirReporteDeDonantes([
      ...Array.from({ length: 5 }, (_, i) => d({ member_id: `x${i}`, sede: null })),
      d({ member_id: 'y1', sede: 'Madrid Domingo' }),
    ])
    expect(r.porSede.at(-1)?.sede).toBe(SIN_SEDE)
    expect(r.porSede[0].sede).toBe('Madrid Domingo')
  })

  it('las sedes van de mayor a menor por donantes', () => {
    const r = construirReporteDeDonantes([
      d({ member_id: 'a', sede: 'Chica' }),
      d({ member_id: 'b', sede: 'Grande' }),
      d({ member_id: 'c', sede: 'Grande' }),
    ])
    expect(r.porSede.map(s => s.sede)).toEqual(['Grande', 'Chica'])
  })
})

describe('DON-3B · los períodos', () => {
  it('año y mes salen de la fecha, del más nuevo al más viejo', () => {
    const r = construirReporteDeDonantes([
      d({ donation_date: '2024-05-01' }),
      d({ donation_date: '2026-03-01' }),
      d({ donation_date: '2026-11-01' }),
    ])
    expect(r.porAnio.map(a => a.periodo)).toEqual(['2026', '2024'])
    expect(r.porMes.map(m => m.periodo)).toEqual(['2026-11', '2026-03', '2024-05'])
  })

  it('los MONTOS de los años sí suman el total', () => {
    const r = construirReporteDeDonantes([
      d({ donation_date: '2025-01-01', amount: 100 }),
      d({ donation_date: '2026-01-01', amount: 250 }),
    ])
    const suma = r.porAnio.reduce((a, x) => a + (x.totales.CRC ?? 0), 0)
    expect(suma).toBe(r.total.totales.CRC)
  })

  it('sin donaciones no revienta', () => {
    const r = construirReporteDeDonantes([])
    expect(r).toMatchObject({ porAnio: [], porMes: [], porSede: [], hayMontos: false })
    expect(r.total.donantes).toBe(0)
  })
})
