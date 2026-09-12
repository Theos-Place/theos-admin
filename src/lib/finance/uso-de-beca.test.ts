import { describe, it, expect } from 'vitest'
import {
  usoDeLaBeca, coincideUso, filtrarPorUso, conteosPorUso, ETIQUETA_USO, BADGE_USO, FILTROS_USO,
  type BecaConUso,
} from './uso-de-beca'

const b = (status: BecaConUso['status'], used_count = 0): BecaConUso => ({ status, used_count })

describe('usoDeLaBeca', () => {
  it('activa y sin redenciones: sigue prometida', () => {
    expect(usoDeLaBeca(b('active'))).toBe('sin_usar')
  })
  it('status used: usada', () => {
    expect(usoDeLaBeca(b('used'))).toBe('usada')
  })
  it('activa pero con una redención registrada: usada', () => {
    // El status puede quedar atrás; la redención es el hecho.
    expect(usoDeLaBeca(b('active', 1))).toBe('usada')
  })
  it('revocada gana sobre todo lo demás', () => {
    expect(usoDeLaBeca(b('revoked', 3))).toBe('revocada')
  })
})

describe('filtros', () => {
  const lista = [b('active'), b('active'), b('used'), b('revoked'), b('active', 2)]

  it('"todas" no filtra nada', () => {
    expect(filtrarPorUso(lista, 'todas')).toHaveLength(5)
  })
  it('"sin usar" deja solo las prometidas', () => {
    expect(filtrarPorUso(lista, 'sin_usar')).toHaveLength(2)
  })
  it('"usadas" incluye la que tiene redención', () => {
    expect(filtrarPorUso(lista, 'usada')).toHaveLength(2)
  })
  it('coincideUso es la misma regla, de a una', () => {
    expect(coincideUso(b('used'), 'usada')).toBe(true)
    expect(coincideUso(b('used'), 'sin_usar')).toBe(false)
  })

  it('los conteos salen de la lista completa', () => {
    expect(conteosPorUso(lista)).toEqual({ sin_usar: 2, usada: 2, revocada: 1, todas: 5 })
  })
  it('lista vacía cuenta cero en todo', () => {
    expect(conteosPorUso([])).toEqual({ sin_usar: 0, usada: 0, revocada: 0, todas: 0 })
  })
})

describe('presentación', () => {
  it('cada uso tiene etiqueta y badge', () => {
    for (const u of ['sin_usar', 'usada', 'revocada'] as const) {
      expect(ETIQUETA_USO[u]).toBeTruthy()
      expect(BADGE_USO[u]).toBeTruthy()
    }
  })
  it('"Sin usar" va de primero: es la única que pide acción', () => {
    expect(FILTROS_USO[0].id).toBe('sin_usar')
  })
})
