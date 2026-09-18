import { describe, it, expect } from 'vitest'
import { selloDeCarga, estadoDeCarga, mensajeDeError } from './estado-de-carga'

describe('selloDeCarga', () => {
  it('distingue peticiones con parámetros distintos', () => {
    expect(selloDeCarga('page=1', 0)).not.toBe(selloDeCarga('page=2', 0))
  })

  it('RECARGAR con los mismos parámetros tiene que dar OTRO sello', () => {
    // Sin el intento, pedir "recargar" no cambiaría nada y el efecto no volvería
    // a correr: el botón de refrescar quedaría muerto.
    expect(selloDeCarga('page=1', 0)).not.toBe(selloDeCarga('page=1', 1))
  })
})

describe('estadoDeCarga', () => {
  const sello = selloDeCarga('page=1', 0)

  it('sin nada guardado, está cargando', () => {
    expect(estadoDeCarga(sello, null)).toEqual({ datos: null, cargando: true, error: null })
  })

  it('con lo del mismo sello, ya no', () => {
    expect(estadoDeCarga(sello, { sello, datos: [1, 2], error: null }))
      .toEqual({ datos: [1, 2], cargando: false, error: null })
  })

  it('EL PUNTO DE TODO: cargando se DERIVA, no hay que acordarse de apagarlo', () => {
    // Con el booleano a mano, una rama del try sin finally dejaba `loading` en
    // true para siempre. Acá eso no se puede escribir.
    const viejo = { sello: selloDeCarga('page=1', 0), datos: ['a'], error: null }
    const nuevo = selloDeCarga('page=2', 0)
    expect(estadoDeCarga(nuevo, viejo).cargando).toBe(true)
  })

  it('mientras recarga, SE SIGUEN VIENDO los datos viejos', () => {
    // Parpadear a vacío en cada recarga es peor que enseñar un dato de hace un
    // segundo.
    const viejo = { sello: selloDeCarga('page=1', 0), datos: ['a'], error: null }
    expect(estadoDeCarga(selloDeCarga('page=2', 0), viejo).datos).toEqual(['a'])
  })

  it('el error viaja con su carga', () => {
    expect(estadoDeCarga(sello, { sello, datos: null, error: 'no se pudo' }))
      .toEqual({ datos: null, cargando: false, error: 'no se pudo' })
  })
})

describe('mensajeDeError', () => {
  it('un Error muestra su mensaje', () => {
    expect(mensajeDeError(new Error('sin permiso'), 'genérico')).toBe('sin permiso')
  })

  it('cualquier otra cosa NO termina en "[object Object]"', () => {
    for (const e of [{ raro: 1 }, 'texto suelto', null, undefined, new Error('')]) {
      expect(mensajeDeError(e, 'No se pudo cargar.')).toBe('No se pudo cargar.')
    }
  })
})
