import { describe, it, expect } from 'vitest'
import {
  pareceDocumento, minimoParaBuscar, sePuedeBuscar, candidatosVisibles,
  seleccionAutomatica, textoSinResultados, consultaParaElServidor,
} from './busqueda-de-integrante'

const p = (id: string, first_name: string, last_name: string, cedula: string | null = null) =>
  ({ id, first_name, last_name, cedula })

describe('pareceDocumento', () => {
  it('reconoce la cédula escrita con y sin guiones', () => {
    expect(pareceDocumento('112720074')).toBe(true)
    expect(pareceDocumento('1-1272-0074')).toBe(true)
    expect(pareceDocumento('1 1272 0074')).toBe(true)
  })
  it('un nombre no es un documento, aunque lleve números', () => {
    expect(pareceDocumento('Karen')).toBe(false)
    expect(pareceDocumento('Karen Solís')).toBe(false)
    expect(pareceDocumento('')).toBe(false)
  })
})

describe('cuándo se sale a buscar', () => {
  it('un apellido corto tiene que funcionar', () => {
    // "Mora" es un apellido real y frecuente: exigirle 4 dígitos como a una
    // cédula lo dejaría fuera.
    expect(minimoParaBuscar('Mora')).toBe(3)
    expect(sePuedeBuscar('Mora')).toBe(true)
    expect(sePuedeBuscar('Mo')).toBe(false)
  })
  it('una cédula parcial de 2 dígitos no: traería cientos', () => {
    expect(minimoParaBuscar('11')).toBe(4)
    expect(sePuedeBuscar('11')).toBe(false)
    expect(sePuedeBuscar('1127')).toBe(true)
  })
})

describe('candidatosVisibles', () => {
  it('saca a quien ya está en la familia que se arma', () => {
    const r = [p('a', 'Ana', 'Mora'), p('b', 'Beto', 'Mora')]
    expect(candidatosVisibles(r, ['a']).map(x => x.id)).toEqual(['b'])
  })
  it('sin exclusiones devuelve todo', () => {
    expect(candidatosVisibles([p('a', 'Ana', 'Mora')])).toHaveLength(1)
  })
})

describe('seleccionAutomatica', () => {
  const karen = p('k', 'Karen', 'Solís', '1-1272-0074')

  it('una cédula completa con un solo dueño se elige sola', () => {
    // El flujo rápido de siempre: quien teclea la cédula entera no debería
    // tener que hacer un clic más.
    expect(seleccionAutomatica([karen], '112720074')?.id).toBe('k')
    expect(seleccionAutomatica([karen], '1-1272-0074')?.id).toBe('k')
  })

  it('un NOMBRE nunca se autoselecciona, ni con un solo resultado', () => {
    // Dos personas pueden llamarse igual, y elegir por el usuario es el error
    // que no se puede cometer armando una familia.
    expect(seleccionAutomatica([karen], 'Karen')).toBeNull()
  })

  it('una cédula a medias tampoco', () => {
    expect(seleccionAutomatica([karen], '1127')).toBeNull()
  })

  it('si dos fichas tienen la misma cédula, que elija la persona', () => {
    const otra = p('x', 'Karen', 'Solis', '112720074')
    expect(seleccionAutomatica([karen, otra], '112720074')).toBeNull()
  })

  it('ignora a quien no tiene cédula', () => {
    expect(seleccionAutomatica([p('n', 'Sin', 'Cédula', null)], '112720074')).toBeNull()
  })
})

describe('textoSinResultados', () => {
  it('dice cédula o nombre según lo que buscaron', () => {
    expect(textoSinResultados('112720074')).toMatch(/cédula/)
    expect(textoSinResultados('Karen')).toMatch(/nombre/)
  })
})


describe('consultaParaElServidor', () => {
  it('le quita los guiones a la cédula', () => {
    // search_text la guarda sin separadores: "1-1272-0074" —como la escribe la
    // gente y como sale en el documento— devolvía CERO resultados.
    expect(consultaParaElServidor('1-1272-0074')).toBe('112720074')
    expect(consultaParaElServidor('1 1272 0074')).toBe('112720074')
  })

  it('el nombre se manda tal cual: los espacios son los que tokenizan', () => {
    expect(consultaParaElServidor('Karen Solís')).toBe('Karen Solís')
    expect(consultaParaElServidor('  Mora  ')).toBe('Mora')
  })
})
