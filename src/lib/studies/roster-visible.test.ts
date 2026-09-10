import { describe, it, expect } from 'vitest'
import {
  participantesActivos, participantesRetirados, participantesVisibles, textoBotonRetirados,
} from './roster-visible'

const LISTA = [
  { member_name: 'Adriana', status: 'enrolled' },
  { member_name: 'Mariela', status: 'withdrawn' },
  { member_name: 'Laura', status: 'enrolled' },
  { member_name: 'Pablo', status: 'pending' },
  { member_name: 'Sofía', status: 'en_revision' },
]

describe('participantesActivos', () => {
  it('el caso real: la tabla mostraba 8 y el encabezado decía 7', () => {
    // Mariela se había pasado a otro grupo pero seguía apareciendo en la lista.
    expect(participantesActivos(LISTA).map(p => p.member_name)).toEqual(['Adriana', 'Laura', 'Pablo', 'Sofía'])
  })

  it('pendiente de pago y en revisión SÍ se ven: son gente del grupo', () => {
    const nombres = participantesActivos(LISTA).map(p => p.member_name)
    expect(nombres).toContain('Pablo')
    expect(nombres).toContain('Sofía')
  })
})

describe('participantesVisibles', () => {
  it('por defecto no muestra a los retirados', () => {
    expect(participantesVisibles(LISTA, false)).toHaveLength(4)
  })

  it('cuando se piden, aparecen todos y en el mismo orden', () => {
    expect(participantesVisibles(LISTA, true).map(p => p.member_name))
      .toEqual(['Adriana', 'Mariela', 'Laura', 'Pablo', 'Sofía'])
  })

  it('no muta la lista original', () => {
    const copia = [...LISTA]
    participantesVisibles(LISTA, true).reverse()
    expect(LISTA).toEqual(copia)
  })
})

describe('textoBotonRetirados', () => {
  it('dice cuántos son, en singular y en plural', () => {
    expect(textoBotonRetirados(1, false)).toBe('Ver 1 retirado')
    expect(textoBotonRetirados(3, false)).toBe('Ver 3 retirados')
  })

  it('cambia cuando ya se están mostrando', () => {
    expect(textoBotonRetirados(3, true)).toBe('Ocultar retirados')
  })

  it('sin retirados no se ofrece el botón', () => {
    expect(textoBotonRetirados(0, false)).toBeNull()
  })
})

describe('participantesRetirados', () => {
  it('son los que se fueron', () => {
    expect(participantesRetirados(LISTA).map(p => p.member_name)).toEqual(['Mariela'])
  })
})
