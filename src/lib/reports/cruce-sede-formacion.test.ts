import { describe, it, expect } from 'vitest'
import { cruceSedeFormacion, type DirigenteConSede } from './cruce-sede-formacion'

const ESTUDIOS = [
  { code: 'N1', name: 'Nivel 1' },
  { code: 'PAN', name: 'Panorama' },
  { code: 'SCJ', name: 'Sirviendo como Jesús' },
]

const d = (o: Partial<DirigenteConSede> & { member_id: string }): DirigenteConSede => ({
  nombre: o.member_id, sede: 'Este', activo: true, formacion: [], ...o,
})

describe('cruce sede × formación', () => {
  /** El caso que lo pidió, con sus nombres. */
  it('encuentra el hueco: en el este sobra SCJ y no hay Panorama', () => {
    const c = cruceSedeFormacion([
      d({ member_id: 'a', formacion: ['SCJ'] }),
      d({ member_id: 'b', formacion: ['SCJ'] }),
      d({ member_id: 'c', formacion: ['SCJ', 'N1'] }),
    ], ESTUDIOS)
    const este = c.filas.find(f => f.sede === 'Este')!
    expect(este.celdas.find(x => x.code === 'SCJ')?.total).toBe(3)
    expect(este.celdas.find(x => x.code === 'PAN')?.total).toBe(0)
    expect(este.huecos).toEqual(['PAN'])
  })

  it('los inactivos no cuentan: no sirven para abrir un grupo', () => {
    const c = cruceSedeFormacion([
      d({ member_id: 'a', formacion: ['PAN'], activo: false }),
      d({ member_id: 'b', formacion: ['N1'] }),
    ], ESTUDIOS)
    const este = c.filas.find(f => f.sede === 'Este')!
    expect(este.dirigentes).toBe(1)
    expect(este.celdas.find(x => x.code === 'PAN')?.total).toBe(0)
    expect(este.huecos).toContain('PAN')
  })

  it('quien no tiene sede va aparte, no se reparte en una inventada', () => {
    const c = cruceSedeFormacion([
      d({ member_id: 'a', sede: null, formacion: ['PAN'] }),
      d({ member_id: 'b', formacion: ['N1'] }),
    ], ESTUDIOS)
    expect(c.sinSede).toBe(1)
    expect(c.filas).toHaveLength(1)
    expect(c.filas[0].sede).toBe('Este')
  })

  it('un código repetido en una ficha cuenta una vez', () => {
    const c = cruceSedeFormacion(
      [d({ member_id: 'a', formacion: ['N1', 'N1', 'N1'] })], ESTUDIOS)
    expect(c.filas[0].celdas.find(x => x.code === 'N1')?.total).toBe(1)
  })

  it('las sedes grandes van primero', () => {
    const c = cruceSedeFormacion([
      d({ member_id: 'a', sede: 'Chica' }),
      d({ member_id: 'b', sede: 'Grande' }),
      d({ member_id: 'c', sede: 'Grande' }),
    ], ESTUDIOS)
    expect(c.filas.map(f => f.sede)).toEqual(['Grande', 'Chica'])
  })

  it('cada celda guarda a quiénes, para poder abrir la lista', () => {
    const c = cruceSedeFormacion(
      [d({ member_id: 'ana', formacion: ['N1'] })], ESTUDIOS)
    expect(c.filas[0].celdas.find(x => x.code === 'N1')?.miembros).toEqual(['ana'])
  })

  /**
   * Con el orden del catálogo, las primeras columnas eran las que casi
   * nadie da y la tabla abría como un muro de ceros, con los números reales
   * fuera de pantalla a la derecha.
   */
  it('las columnas van por cobertura, no alfabéticas', () => {
    const c = cruceSedeFormacion([
      d({ member_id: 'a', formacion: ['SCJ'] }),
      d({ member_id: 'b', formacion: ['SCJ'] }),
      d({ member_id: 'c', formacion: ['N1'] }),
    ], ESTUDIOS)
    // SCJ (2) → N1 (1) → PAN (0), aunque el catálogo venga N1, PAN, SCJ.
    expect(c.estudios.map(e => e.code)).toEqual(['SCJ', 'N1', 'PAN'])
  })

  it('y las celdas de cada fila siguen ese mismo orden', () => {
    // Si los encabezados se ordenan y las celdas no, cada número queda bajo
    // la columna equivocada — y la tabla miente sin fallar.
    const c = cruceSedeFormacion([
      d({ member_id: 'a', formacion: ['SCJ'] }),
      d({ member_id: 'b', formacion: ['SCJ'] }),
      d({ member_id: 'c', formacion: ['N1'] }),
    ], ESTUDIOS)
    expect(c.filas[0].celdas.map(x => x.code)).toEqual(c.estudios.map(e => e.code))
    expect(c.filas[0].celdas.map(x => x.total)).toEqual([2, 1, 0])
  })

  it('una sede sin NADIE formado es toda huecos, y se ve', () => {
    const c = cruceSedeFormacion([d({ member_id: 'a' })], ESTUDIOS)
    expect(c.filas[0].dirigentes).toBe(1)
    expect(c.filas[0].huecos).toEqual(['N1', 'PAN', 'SCJ'])
  })
})
