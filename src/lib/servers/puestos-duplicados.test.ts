import { describe, it, expect } from 'vitest'
import {
  normalizarTitulo, tieneArticulo, sinArticulos, planDeConsolidacion,
} from './puestos-duplicados'

describe('normalizarTitulo', () => {
  it('el "de" y la tilde no hacen a dos puestos distintos', () => {
    expect(normalizarTitulo('Colaborador de Informacion'))
      .toBe(normalizarTitulo('Colaborador Información'))
  })

  it('no junta puestos que de verdad son distintos', () => {
    expect(normalizarTitulo('Coordinador Comida')).not.toBe(normalizarTitulo('Colaborador Comida'))
  })

  it('no se come un "de" que es parte de una palabra', () => {
    expect(normalizarTitulo('Colaborador Deportes')).toBe('colaborador deportes')
  })
})

describe('sinArticulos', () => {
  it('quita el artículo y conserva tildes y mayúsculas', () => {
    expect(sinArticulos('Colaborador de Información')).toBe('Colaborador Información')
  })
  it('deja intacto el que no lo lleva', () => {
    expect(sinArticulos('Colaborador Montaje')).toBe('Colaborador Montaje')
  })
  it('no toca "Deportes"', () => {
    expect(sinArticulos('Colaborador Deportes')).toBe('Colaborador Deportes')
  })
})

describe('tieneArticulo', () => {
  it('lo detecta con y sin tilde alrededor', () => {
    expect(tieneArticulo('Colaborador de Informacion')).toBe(true)
    expect(tieneArticulo('Colaborador Información')).toBe(false)
  })
})

describe('planDeConsolidacion', () => {
  it('gana el que NO lleva "de", aunque tenga menos gente', () => {
    const plan = planDeConsolidacion([
      { id: 'a', title: 'Colaborador de Informacion', activos: 2 },
      { id: 'b', title: 'Colaborador Información', activos: 1 },
    ])!
    expect(plan.sobreviviente.id).toBe('b')
    expect(plan.tituloFinal).toBe('Colaborador Información')
    expect(plan.aBorrar.map(p => p.id)).toEqual(['a'])
    expect(plan.personasAMover).toBe(2)
  })

  it('si los dos llevan "de", se lo quita al que se queda', () => {
    const plan = planDeConsolidacion([
      { id: 'a', title: 'Colaborador de Comida', activos: 1 },
      { id: 'b', title: 'Colaborador de la Comida', activos: 5 },
    ])!
    expect(plan.sobreviviente.id).toBe('b')
    expect(plan.tituloFinal).toBe('Colaborador Comida')
  })

  it('si ninguno lleva "de", gana el que ya tiene gente', () => {
    const plan = planDeConsolidacion([
      { id: 'a', title: 'Colaborador Montaje', activos: 0 },
      { id: 'b', title: 'Colaborador  Montaje', activos: 4 },
    ])!
    expect(plan.sobreviviente.id).toBe('b')
    expect(plan.personasAMover).toBe(0)
  })

  it('con todo igual, gana el título con tildes', () => {
    const plan = planDeConsolidacion([
      { id: 'a', title: 'Colaborador Informacion', activos: 0 },
      { id: 'b', title: 'Colaborador Información', activos: 0 },
    ])!
    expect(plan.sobreviviente.id).toBe('b')
  })

  it('un puesto solo no es un duplicado', () => {
    expect(planDeConsolidacion([{ id: 'a', title: 'Anfitrión', activos: 3 }])).toBeNull()
  })

  it('con tres formas del mismo puesto, sobrevive uno y se borran dos', () => {
    const plan = planDeConsolidacion([
      { id: 'a', title: 'Colaborador de Anuncios', activos: 1 },
      { id: 'b', title: 'Colaborador Anuncios', activos: 3 },
      { id: 'c', title: 'Colaborador de los Anuncios', activos: 2 },
    ])!
    expect(plan.sobreviviente.id).toBe('b')
    expect(plan.aBorrar).toHaveLength(2)
    expect(plan.personasAMover).toBe(3)
  })
})
