import { describe, it, expect } from 'vitest'
import { moverElemento, moverCampo, puedeSubir, puedeBajar } from './reordenar'

const LISTA = ['a', 'b', 'c', 'd']

describe('moverElemento', () => {
  it('sube una opción un lugar', () => {
    expect(moverElemento(LISTA, 2, 1)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('baja una opción un lugar', () => {
    expect(moverElemento(LISTA, 1, 2)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('mueve del final al principio (arrastre largo)', () => {
    expect(moverElemento(LISTA, 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('mueve del principio al final', () => {
    expect(moverElemento(LISTA, 0, 3)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('no toca nada si el origen y el destino son el mismo', () => {
    expect(moverElemento(LISTA, 2, 2)).toEqual(LISTA)
  })

  it('ignora índices fuera de la lista en vez de romper', () => {
    expect(moverElemento(LISTA, -1, 2)).toEqual(LISTA)
    expect(moverElemento(LISTA, 1, 9)).toEqual(LISTA)
    expect(moverElemento(LISTA, 9, 1)).toEqual(LISTA)
  })

  it('nunca muta la lista original', () => {
    const original = [...LISTA]
    moverElemento(original, 0, 3)
    expect(original).toEqual(LISTA)
  })

  it('con una sola opción no hay nada que mover', () => {
    expect(moverElemento(['sola'], 0, 0)).toEqual(['sola'])
  })
})

describe('puedeSubir / puedeBajar', () => {
  it('la primera no sube y la última no baja', () => {
    expect(puedeSubir(0)).toBe(false)
    expect(puedeBajar(3, 4)).toBe(false)
  })

  it('las del medio se mueven en las dos direcciones', () => {
    expect(puedeSubir(1)).toBe(true)
    expect(puedeBajar(1, 4)).toBe(true)
  })

  it('una sola opción no se mueve para ningún lado', () => {
    expect(puedeSubir(0)).toBe(false)
    expect(puedeBajar(0, 1)).toBe(false)
  })
})

describe('moverCampo', () => {
  const CAMPOS = [
    { id: 'a', sort_order: 0 },
    { id: 'b', sort_order: 1 },
    { id: 'c', sort_order: 2 },
  ]

  it('renumera sort_order según la posición nueva', () => {
    expect(moverCampo(CAMPOS, 2, 0)).toEqual([
      { id: 'c', sort_order: 0 },
      { id: 'a', sort_order: 1 },
      { id: 'b', sort_order: 2 },
    ])
  })

  it('renumera aunque el sort_order de entrada venga desordenado o repetido', () => {
    const sucios = [{ id: 'a', sort_order: 7 }, { id: 'b', sort_order: 7 }]
    expect(moverCampo(sucios, 0, 1)).toEqual([
      { id: 'b', sort_order: 0 },
      { id: 'a', sort_order: 1 },
    ])
  })

  it('con índices inválidos deja el orden pero igual renumera', () => {
    expect(moverCampo(CAMPOS, 0, 9)).toEqual(CAMPOS)
  })

  it('no muta los campos originales', () => {
    const originales = CAMPOS.map(c => ({ ...c }))
    moverCampo(originales, 0, 2)
    expect(originales).toEqual(CAMPOS)
  })
})
