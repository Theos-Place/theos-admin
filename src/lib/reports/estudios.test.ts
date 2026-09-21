import { describe, it, expect } from 'vitest'
import {
  edadAlIniciar, resumirEstudios, porPlan, serieDeEstudios, aniosConEstudios,
  type FilaDeEstudios,
} from './estudios'

const f = (x: Partial<FilaDeEstudios> & { member_id: string }): FilaDeEstudios => ({
  plan_code: 'N1', plan_nombre: 'Nivel 1', grupo_id: 'g1', grupo_estado: 'finalizado',
  matricula_estado: 'completed', birth_date: null, gender: null,
  inicio_del_grupo: '2026-03-01', leader_id: 'd1', co_leader_id: null, ...x,
})

describe('edadAlIniciar', () => {
  it('es la edad al EMPEZAR el grupo, no la de hoy', () => {
    // Quien llevó Nivel 1 en 2019 lo llevó con la edad que tenía entonces.
    expect(edadAlIniciar('2000-01-01', '2019-06-01')).toBe(19)
    expect(edadAlIniciar('2000-01-01', '2026-06-01')).toBe(26)
  })

  it('respeta el cumpleaños dentro del año', () => {
    expect(edadAlIniciar('2000-07-01', '2026-06-30')).toBe(25)
    expect(edadAlIniciar('2000-07-01', '2026-07-01')).toBe(26)
  })

  it('sin fecha devuelve 0, que el resumen usa para dejarla FUERA', () => {
    expect(edadAlIniciar(null, '2026-03-01')).toBe(0)
    expect(edadAlIniciar('no es fecha', '2026-03-01')).toBe(0)
  })
})

describe('resumirEstudios', () => {
  it('cuenta personas distintas, no matrículas', () => {
    const r = resumirEstudios([
      f({ member_id: 'ana', grupo_id: 'g1' }),
      f({ member_id: 'ana', grupo_id: 'g2' }),
      f({ member_id: 'beto' }),
    ])
    expect(r.estudiantes).toBe(2)
    expect(r.matriculas).toBe(3)
    expect(r.grupos).toBe(2)
  })

  it('el % que finalizó es sobre MATRÍCULAS: reprobado no cuenta como terminar bien', () => {
    const r = resumirEstudios([
      f({ member_id: 'a', matricula_estado: 'completed' }),
      f({ member_id: 'b', matricula_estado: 'reprobado' }),
      f({ member_id: 'c', matricula_estado: 'enrolled' }),
      f({ member_id: 'd', matricula_estado: 'completed' }),
    ])
    expect(r.finalizaron).toBe(2)
    expect(r.pctFinalizo).toBe(50)
  })

  it('cuenta dirigentes y co-dirigentes distintos', () => {
    const r = resumirEstudios([
      f({ member_id: 'a', leader_id: 'd1', co_leader_id: 'd2' }),
      f({ member_id: 'b', leader_id: 'd1', co_leader_id: null }),
      f({ member_id: 'c', leader_id: 'd3' }),
    ])
    expect(r.dirigentes).toBe(3)
  })

  it('sin fecha de nacimiento queda fuera del promedio y se reporta aparte', () => {
    const r = resumirEstudios([
      f({ member_id: 'a', birth_date: '1996-03-01' }), // 30 al 2026-03-01
      f({ member_id: 'b', birth_date: '2006-03-01' }), // 20
      f({ member_id: 'c' }),
    ])
    expect(r.edadPromedio).toBe(25)
    expect(r.sinEdad).toBe(1)
  })

  it('si nadie tiene fecha, la edad es null y no 0', () => {
    expect(resumirEstudios([f({ member_id: 'a' })]).edadPromedio).toBeNull()
  })

  it('el género se reparte en tres y suman las personas', () => {
    const r = resumirEstudios([
      f({ member_id: 'a', gender: 'F' }),
      f({ member_id: 'b', gender: 'M' }),
      f({ member_id: 'c', gender: 'otro' }),
    ])
    expect([r.mujeres, r.hombres, r.sinGenero]).toEqual([1, 1, 1])
  })

  it('sin filas no revienta', () => {
    const r = resumirEstudios([])
    expect(r).toMatchObject({ estudiantes: 0, grupos: 0, pctFinalizo: null, edadPromedio: null })
  })
})

describe('porPlan', () => {
  const filas = [
    f({ member_id: 'ana', plan_code: 'N1', plan_nombre: 'Nivel 1' }),
    f({ member_id: 'ana', plan_code: 'N2', plan_nombre: 'Nivel 2', grupo_id: 'g2' }),
    f({ member_id: 'beto', plan_code: 'N1', plan_nombre: 'Nivel 1' }),
  ]

  it('una persona en dos estudios cuenta en los dos', () => {
    const p = porPlan(filas)
    expect(p.find(x => x.code === 'N1')!.estudiantes).toBe(2)
    expect(p.find(x => x.code === 'N2')!.estudiantes).toBe(1)
  })

  it('las filas suman más que el total, y está bien: es gente compartida', () => {
    expect(porPlan(filas).reduce((n, x) => n + x.estudiantes, 0)).toBe(3)
    expect(resumirEstudios(filas).estudiantes).toBe(2)
  })

  it('ordena de la más grande a la más chica', () => {
    expect(porPlan(filas).map(x => x.code)).toEqual(['N1', 'N2'])
  })
})

describe('serieDeEstudios', () => {
  const s = [
    { anio: 2025, plan_code: 'N1', estudiantes: 10 },
    { anio: 2025, plan_code: 'N2', estudiantes: 5 },
    { anio: 2026, plan_code: 'N1', estudiantes: 8 },
  ]

  it('suma todos los planes por año', () => {
    expect(serieDeEstudios(s).map(x => x.estudiantes)).toEqual([15, 8])
  })

  it('con un plan, solo ese', () => {
    expect(serieDeEstudios(s, 'N1').map(x => x.estudiantes)).toEqual([10, 8])
  })

  it('va de menor a mayor: la línea se lee de izquierda a derecha', () => {
    expect(serieDeEstudios(s).map(x => x.anio)).toEqual([2025, 2026])
  })

  it('los años del selector van al revés, el más nuevo primero', () => {
    expect(aniosConEstudios(s)).toEqual([2026, 2025])
  })
})
