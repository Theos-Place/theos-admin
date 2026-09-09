import { describe, it, expect } from 'vitest'
import { moverOpcion, puedeSubir, puedeBajar } from './reordenar-opciones'

const LISTA = ['a', 'b', 'c', 'd']

describe('moverOpcion', () => {
  it('sube una opción un lugar', () => {
    expect(moverOpcion(LISTA, 2, 1)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('baja una opción un lugar', () => {
    expect(moverOpcion(LISTA, 1, 2)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('mueve del final al principio (arrastre largo)', () => {
    expect(moverOpcion(LISTA, 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('mueve del principio al final', () => {
    expect(moverOpcion(LISTA, 0, 3)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('no toca nada si el origen y el destino son el mismo', () => {
    expect(moverOpcion(LISTA, 2, 2)).toEqual(LISTA)
  })

  it('ignora índices fuera de la lista en vez de romper', () => {
    expect(moverOpcion(LISTA, -1, 2)).toEqual(LISTA)
    expect(moverOpcion(LISTA, 1, 9)).toEqual(LISTA)
    expect(moverOpcion(LISTA, 9, 1)).toEqual(LISTA)
  })

  it('nunca muta la lista original', () => {
    const original = [...LISTA]
    moverOpcion(original, 0, 3)
    expect(original).toEqual(LISTA)
  })

  it('con una sola opción no hay nada que mover', () => {
    expect(moverOpcion(['sola'], 0, 0)).toEqual(['sola'])
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
