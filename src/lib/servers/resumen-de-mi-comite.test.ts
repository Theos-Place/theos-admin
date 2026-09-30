import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  cumplimiento, porcentajes, type ServidorDelReporte,
} from '@/lib/reports/servidores-compromisos'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const s = (over: Partial<ServidorDelReporte> & { member_id: string }): ServidorDelReporte => ({
  nombre: over.member_id, comites: ['c1'],
  asistencia: true, llevandoEstudio: true, dandoEstudio: false, donante: true,
  ultimoCheckin: null, ...over,
})

/**
 * SRV-16 parte 2 · El resumen de arriba de "Mi comité".
 *
 * LO QUE HAY QUE CUIDAR no es que los cinco números salgan: es que sean LOS
 * MISMOS que da el reporte de dirección (REP-7) para ese comité. Las dos
 * pantallas ya se separaron una vez —el truncado de PostgREST a 1.000 filas,
 * 2026-09-21— y se descubrió justamente porque daban distinto.
 */
describe('el resumen y REP-7 son literalmente el mismo componente', () => {
  const COMPONENTE = 'src/components/servers/ResumenDeCompromisos.tsx'

  it('las dos pantallas lo importan', () => {
    for (const p of [
      'src/app/(admin)/servidores/mi-comite/page.tsx',
      'src/app/(admin)/reportes/servidores/page.tsx',
    ]) {
      expect(sinComentarios(p), p).toContain('<ResumenDeCompromisos')
    }
  })

  it('y ninguna de las dos recalcula los porcentajes por su cuenta', () => {
    // El cebo: si alguien copia el bloque de KPIs a una pantalla, esto se cae.
    for (const p of [
      'src/app/(admin)/servidores/mi-comite/page.tsx',
      'src/app/(admin)/reportes/servidores/page.tsx',
    ]) {
      expect(sinComentarios(p), p).not.toContain('porcentajes(')
    }
  })

  it('el componente tampoco define las reglas: las pide', () => {
    const c = sinComentarios(COMPONENTE)
    expect(c).toContain("from '@/lib/reports/servidores-compromisos'")
    expect(c).toContain('cumplimiento(servidores)')
    expect(c).toContain('porcentajes(total)')
  })
})

describe('los números del comité, con las reglas de REP-7', () => {
  const gente: ServidorDelReporte[] = [
    s({ member_id: 'a' }),                                            // cumple todo
    s({ member_id: 'b', asistencia: false }),
    s({ member_id: 'c', llevandoEstudio: false, dandoEstudio: false }),
    s({ member_id: 'd', donante: false }),
  ]

  it('cuenta cada compromiso y el «cumplen todo»', () => {
    const r = cumplimiento(gente)
    expect(r).toMatchObject({ total: 4, asistencia: 3, estudio: 3, donante: 3, todo: 1, conPendientes: 3 })
    expect(porcentajes(r)).toEqual({ asistencia: 75, estudio: 75, donante: 75, todo: 25 })
  })

  it('dar un estudio cuenta igual que llevarlo', () => {
    const r = cumplimiento([s({ member_id: 'x', llevandoEstudio: false, dandoEstudio: true })])
    expect(r.estudio).toBe(1)
    expect(r.todo).toBe(1)
  })

  it('quien sirve en dos comités cuenta UNA vez', () => {
    // Es la razón de que el resumen junte los comités en uno solo cuando la
    // persona encarga varios: sumar las filas inflaría a la gente que más
    // sirve, que es justamente la que aparece dos veces.
    const r = cumplimiento([
      s({ member_id: 'a', comites: ['c1'] }),
      s({ member_id: 'a', comites: ['c2'] }),
    ])
    expect(r.total).toBe(1)
  })

  it('sin gente, los porcentajes son null y no 0%', () => {
    // 0% dice «nadie cumple»; null dice «no hay a quién medir».
    expect(porcentajes(cumplimiento([]))).toEqual({ asistencia: null, estudio: null, donante: null, todo: null })
  })
})

describe('el resumen NO se recalcula con el filtro de pendientes', () => {
  it('se arma con `comites`, no con `visibles`', () => {
    /**
     * `visibles` es la lista ya filtrada por "solo los que tienen algo
     * pendiente". Si el resumen saliera de ahí, activar ese filtro pondría los
     * cinco porcentajes en 0% — justo cuando la persona está mirando a quién
     * ayudar, que es cuando el resumen más se necesita.
     */
    const p = sinComentarios('src/app/(admin)/servidores/mi-comite/page.tsx')
    expect(p).toContain('comites.flatMap(c => c.filas)')
    expect(p).not.toContain('visibles.flatMap')
  })
})
