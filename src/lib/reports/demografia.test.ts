import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  demografiaPorSede, totalDeLaDemografia, clasificarGenero, type FilaCruda,
} from './demografia'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-21T12:00:00Z')) })
afterEach(() => { vi.useRealTimers() })

const f = (x: Partial<FilaCruda> & { member_id: string }): FilaCruda => ({
  sede: 'Cartago', birth_date: null, gender: null, ...x,
})

describe('clasificarGenero', () => {
  it('solo F y M; todo lo demás es "sin dato"', () => {
    // El padrón tiene 385 sin género y 3 en "otro": adivinar en 385 casos es
    // equivocarse en unos cuantos.
    expect(clasificarGenero('F')).toBe('F')
    expect(clasificarGenero('m')).toBe('M')
    expect(clasificarGenero('otro')).toBe('sin')
    expect(clasificarGenero(null)).toBe('sin')
    expect(clasificarGenero('')).toBe('sin')
  })
})

describe('demografiaPorSede', () => {
  it('cuenta PERSONAS, no check-ins', () => {
    const d = demografiaPorSede([f({ member_id: 'a' }), f({ member_id: 'a' }), f({ member_id: 'b' })])
    expect(d[0].personas).toBe(2)
  })

  it('quien fue a dos sedes cuenta en las dos', () => {
    const d = demografiaPorSede([
      f({ member_id: 'a', sede: 'Cartago' }),
      f({ member_id: 'a', sede: 'Madrid' }),
    ])
    expect(d.map(x => x.personas)).toEqual([1, 1])
  })

  it('sin fecha de nacimiento NO entra al promedio, y se reporta aparte', () => {
    const d = demografiaPorSede([
      f({ member_id: 'a', birth_date: '1996-09-21' }), // 30
      f({ member_id: 'b', birth_date: '2006-09-21' }), // 20
      f({ member_id: 'c' }),
    ])
    expect(d[0].edadPromedio).toBe(25)
    expect(d[0].sinEdad).toBe(1)
    expect(d[0].personas).toBe(3)
  })

  it('si nadie tiene fecha, la edad es null y no 0', () => {
    const d = demografiaPorSede([f({ member_id: 'a' })])
    expect(d[0].edadPromedio).toBeNull()
    expect(d[0].edadMediana).toBeNull()
  })

  it('el género se reparte en tres y los tres suman las personas', () => {
    const d = demografiaPorSede([
      f({ member_id: 'a', gender: 'F' }),
      f({ member_id: 'b', gender: 'M' }),
      f({ member_id: 'c', gender: 'otro' }),
      f({ member_id: 'd' }),
    ])[0]
    expect([d.mujeres, d.hombres, d.sinGenero]).toEqual([1, 1, 2])
    expect(d.mujeres + d.hombres + d.sinGenero).toBe(d.personas)
  })

  it('ordena por tamaño, de la sede más grande a la más chica', () => {
    const d = demografiaPorSede([
      f({ member_id: 'a', sede: 'Chica' }),
      f({ member_id: 'b', sede: 'Grande' }),
      f({ member_id: 'c', sede: 'Grande' }),
    ])
    expect(d.map(x => x.sede)).toEqual(['Grande', 'Chica'])
  })

  it('sin filas devuelve vacío', () => {
    expect(demografiaPorSede([])).toEqual([])
  })
})

describe('totalDeLaDemografia', () => {
  it('no repite a quien fue a dos sedes', () => {
    // Por eso las columnas del desglose suman más que este número.
    const filas = [f({ member_id: 'a', sede: 'Cartago' }), f({ member_id: 'a', sede: 'Madrid' })]
    expect(demografiaPorSede(filas).reduce((n, x) => n + x.personas, 0)).toBe(2)
    expect(totalDeLaDemografia(filas).personas).toBe(1)
  })

  it('sin filas no revienta', () => {
    expect(totalDeLaDemografia([]).personas).toBe(0)
  })
})
