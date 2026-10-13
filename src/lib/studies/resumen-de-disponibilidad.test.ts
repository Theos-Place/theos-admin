import { describe, it, expect } from 'vitest'
import {
  enumerar, resumenDeHorarios, resumenDeEstudios, resumenDeZonas, resumenDeExtras,
} from './resumen-de-disponibilidad'

describe('enumerar', () => {
  it('une con «y», que es como se lee en voz alta', () => {
    expect(enumerar(['lunes'])).toBe('lunes')
    expect(enumerar(['lunes', 'martes'])).toBe('lunes y martes')
    expect(enumerar(['lunes', 'martes', 'viernes'])).toBe('lunes, martes y viernes')
  })
})

describe('horarios', () => {
  /**
   * Son 21 casillas. Listarlas sueltas da una frase que no se termina de
   * leer; por eso se agrupan por día.
   */
  it('agrupa por día en vez de listar casilla por casilla', () => {
    expect(resumenDeHorarios(['L-mañana', 'L-tarde', 'M-noche']).texto)
      .toBe('lunes por la mañana y por la tarde; martes por la noche')
  })

  it('los tres turnos de un día se dicen «todo el día»', () => {
    expect(resumenDeHorarios(['L-mañana', 'L-tarde', 'L-noche']).texto)
      .toBe('lunes todo el día')
  })

  it('respeta el orden de la semana aunque los slots vengan revueltos', () => {
    expect(resumenDeHorarios(['V-noche', 'L-mañana']).texto)
      .toBe('lunes por la mañana; viernes por la noche')
  })

  it('sin nada contestado lo dice con palabras, no con un guion', () => {
    // «Días: —» se lee como un error de la pantalla.
    const r = resumenDeHorarios([])
    expect(r.vacio).toBe(true)
    expect(r.texto).toBe('Todavía no lo dijiste: cuándo podés')
  })

  it('un slot inventado no rompe ni se cuela en la frase', () => {
    expect(resumenDeHorarios(['XX-siempre', 'L-tarde']).texto).toBe('lunes por la tarde')
  })
})

describe('estudios y zonas', () => {
  const etiqueta = (c: string) => ({ N1: 'Nivel 1', SCJ: 'Sirviendo como Jesús' }[c] ?? c)

  it('usa los nombres y no los códigos, ordenados', () => {
    expect(resumenDeEstudios(['SCJ', 'N1'], etiqueta, 'qué querés dar').texto)
      .toBe('Nivel 1 y Sirviendo como Jesús')
  })

  it('un código repetido aparece una vez', () => {
    expect(resumenDeEstudios(['N1', 'N1'], etiqueta, 'x').texto).toBe('Nivel 1')
  })

  it('vacío dice qué falta contestar', () => {
    expect(resumenDeEstudios([], etiqueta, 'qué querés dar'))
      .toEqual({ texto: 'Todavía no lo dijiste: qué querés dar', vacio: true })
  })

  it('las zonas salen por nombre', () => {
    expect(resumenDeZonas(['este'], c => ({ este: 'Este de San José' }[c] ?? c)).texto)
      .toBe('Este de San José')
  })
})

describe('casa y suplencia', () => {
  it('un «no» es una respuesta, no un dato faltante', () => {
    // Si contara como vacío, la pantalla le pediría para siempre que
    // conteste algo que ya contestó.
    const r = resumenDeExtras({ offers_home: false, available_as_substitute: false })
    expect(r.vacio).toBe(false)
    expect(r.texto).toBe('No ofrecés casa ni suplencia')
  })

  it('los dos sí se unen en una frase', () => {
    expect(resumenDeExtras({ offers_home: true, available_as_substitute: true }).texto)
      .toBe('Ofrecés tu casa y podés ser suplente')
  })

  it('uno solo arranca en mayúscula', () => {
    expect(resumenDeExtras({ offers_home: true, available_as_substitute: false }).texto)
      .toBe('Ofrecés tu casa')
  })
})
