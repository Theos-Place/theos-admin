import { describe, it, expect } from 'vitest'
import {
  detalleDeSemana, claveDeSemana, leerClaveDeSemana, semanaISO, type FilaConCalidad,
} from './semana-detalle'

const f = (
  title: string, wk: number, checkins: number,
  calidad: string | null = 'asistente', yr = 2026,
): FilaConCalidad => ({ yr, title, wk, mo: 9, checkins, calidad })

const SEMANA_37 = [
  f('Charla Meridiano Martes', 37, 189),
  f('Charla Meridiano Martes', 37, 4, 'servidor'),
  f('Charla Cartago Miércoles', 37, 77),
  f('Charla Liberia Miércoles', 37, 58),
]
const CONTEXTO = [
  ...SEMANA_37,
  f('Charla Meridiano Martes', 36, 200),
  f('Charla Cartago Miércoles', 36, 70),
  f('Charla Meridiano Martes', 37, 150, 'asistente', 2025),
]
const HOY = new Date('2026-10-01T12:00:00Z') // semana 40: la 37 ya cerró

describe('detalleDeSemana', () => {
  it('da SOLO esa semana, no el acumulado', () => {
    const d = detalleDeSemana(CONTEXTO, 2026, 37, { hoy: HOY })!
    expect(d.total).toBe(189 + 4 + 77 + 58)
    expect(d.clave).toBe('2026-W37')
  })

  it('el desglose por sede SUMA el total', () => {
    const d = detalleDeSemana(CONTEXTO, 2026, 37, { hoy: HOY })!
    expect(d.porSede.reduce((n, s) => n + s.total, 0)).toBe(d.total)
  })

  it('las sedes van de mayor a menor', () => {
    const d = detalleDeSemana(CONTEXTO, 2026, 37, { hoy: HOY })!
    expect(d.porSede.map(s => s.sede)).toEqual(['Meridiano Martes', 'Cartago Miércoles', 'Liberia Miércoles'])
  })

  it('separa asistentes de servidores, por sede y en el total', () => {
    const d = detalleDeSemana(CONTEXTO, 2026, 37, { hoy: HOY })!
    const meri = d.porSede.find(s => s.sede === 'Meridiano Martes')!
    expect(meri).toMatchObject({ asistentes: 189, servidores: 4, total: 193 })
    expect(d.servidores).toBe(4)
  })

  it('los históricos SIN el dato cuentan como asistentes', () => {
    const d = detalleDeSemana([f('Charla X', 37, 10, null)], 2026, 37, { hoy: HOY })!
    expect(d.asistentes).toBe(10)
    expect(d.servidores).toBe(0)
  })

  it('compara contra la semana anterior', () => {
    const d = detalleDeSemana(CONTEXTO, 2026, 37, { hoy: HOY })!
    expect(d.vsSemanaAnterior).toMatchObject({ total: 270, delta: 58 })
    expect(d.vsSemanaAnterior.pct).toBeCloseTo(21.5, 1)
  })

  it('y contra la misma semana del año pasado', () => {
    const d = detalleDeSemana(CONTEXTO, 2026, 37, { hoy: HOY })!
    expect(d.vsAnoPasado).toMatchObject({ total: 150, delta: 178 })
  })

  it('sin base para comparar no inventa un 0%', () => {
    const d = detalleDeSemana(SEMANA_37, 2026, 37, { hoy: HOY })!
    expect(d.vsSemanaAnterior).toEqual({ total: null, delta: null, pct: null })
    expect(d.vsAnoPasado).toEqual({ total: null, delta: null, pct: null })
  })

  it('la semana 1 no compara contra la 52 del año pasado: es otra cosa', () => {
    const d = detalleDeSemana([f('Charla X', 1, 10), f('Charla X', 52, 99, 'asistente', 2025)], 2026, 1, { hoy: HOY })!
    expect(d.vsSemanaAnterior.total).toBeNull()
  })

  it('marca la semana EN CURSO', () => {
    const enCurso = detalleDeSemana([f('Charla X', 37, 10)], 2026, 37, {
      hoy: new Date('2026-09-10T12:00:00Z'), // jueves de la semana 37
    })!
    expect(enCurso.enCurso).toBe(true)
    expect(detalleDeSemana([f('Charla X', 37, 10)], 2026, 37, { hoy: HOY })!.enCurso).toBe(false)
  })

  it('filtra por sede, y las comparaciones también', () => {
    const d = detalleDeSemana(CONTEXTO, 2026, 37, { sede: 'Cartago Miércoles', hoy: HOY })!
    expect(d.total).toBe(77)
    expect(d.porSede).toHaveLength(1)
    expect(d.vsSemanaAnterior.total).toBe(70)
  })

  it('una semana que no existe da null, no una pantalla de ceros', () => {
    expect(detalleDeSemana(CONTEXTO, 2026, 5, { hoy: HOY })).toBeNull()
  })
})

describe('la clave de la URL', () => {
  it('se escribe con el cero adelante', () => {
    expect(claveDeSemana(2026, 7)).toBe('2026-W07')
    expect(claveDeSemana(2026, 37)).toBe('2026-W37')
  })

  it('se lee de vuelta', () => {
    expect(leerClaveDeSemana('2026-W37')).toEqual({ year: 2026, week: 37 })
    expect(leerClaveDeSemana('2026-W7')).toEqual({ year: 2026, week: 7 })
  })

  it('una URL escrita a mano no rompe la pantalla', () => {
    for (const basura of [null, '', 'esta semana', '2026-W00', '2026-W54', '2026W37']) {
      expect(leerClaveDeSemana(basura)).toBeNull()
    }
  })
})

describe('semanaISO', () => {
  it('el 10 de setiembre de 2026 es la semana 37', () => {
    expect(semanaISO(new Date('2026-09-10T12:00:00Z'))).toEqual({ year: 2026, week: 37 })
  })
  it('el 1 de enero puede caer en la última semana del año anterior', () => {
    // 2027-01-01 es viernes → semana 53 de 2026.
    expect(semanaISO(new Date('2027-01-01T12:00:00Z'))).toEqual({ year: 2026, week: 53 })
  })
})
