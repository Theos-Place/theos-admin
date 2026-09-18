import { describe, it, expect } from 'vitest'
import { mensajeDelError, camposConProblema } from './mensaje-del-error'

const GEN = 'No se pudo crear el grupo.'

describe('mensajeDelError', () => {
  it('EL CASO QUE LO PIDIÓ: el motivo del servidor se muestra tal cual', () => {
    // Antes esto salía como "Revisá los datos e intentá de nuevo", y quien lo
    // leía no tenía forma de saber que el problema era el dirigente.
    expect(mensajeDelError(
      { error: 'El dirigente o co-dirigente elegido está marcado como no recomendado para dar estudios.' },
      400, GEN,
    )).toBe('El dirigente o co-dirigente elegido está marcado como no recomendado para dar estudios.')
  })

  it('"Datos inválidos" a secas no dice cuál: se le pegan los campos', () => {
    expect(mensajeDelError(
      { error: 'Datos inválidos', detalles: { properties: { name: { errors: ['x'] }, age_min: { errors: ['y'] } } } },
      400, GEN,
    )).toBe('Datos inválidos: name, age_min.')
  })

  it('con campos pero sin mensaje, igual sirve', () => {
    expect(mensajeDelError({ detalles: { properties: { starts_at: { errors: ['x'] } } } }, 400, GEN))
      .toBe('No se pudo crear el grupo. Revisá: starts_at.')
  })

  it('401 y 403 se dicen en castellano y con qué hacer', () => {
    expect(mensajeDelError(null, 401, GEN)).toMatch(/sesión/i)
    expect(mensajeDelError(null, 403, GEN)).toMatch(/permiso/i)
  })

  it('un 5xx SIEMPRE lleva el código, aunque el servidor diga algo', () => {
    // "Error interno" solo le suena a la persona como si hubiera hecho algo
    // mal. Con el número, puede reportarlo y se distingue de un permiso.
    expect(mensajeDelError({ error: 'Error interno' }, 500, GEN)).toBe('Error interno (error 500)')
    expect(mensajeDelError(null, 502, GEN)).toBe('No se pudo crear el grupo. (error 502)')
  })

  it('SIN EXPLICACIÓN, el status va en el texto', () => {
    // "error 500" es accionable: quien lo reporta dice el número y se sabe si
    // fue permiso, dato o caída. Un mensaje pelado no deja ni por dónde empezar.
    expect(mensajeDelError(null, 500, GEN)).toBe('No se pudo crear el grupo. (error 500)')
  })

  it('una respuesta que no es JSON no revienta', () => {
    // Una caída del servidor devuelve HTML, no JSON.
    for (const c of [null, undefined, { error: null }, { error: 42 }, { error: '   ' }]) {
      expect(mensajeDelError(c, 500, GEN)).toBe('No se pudo crear el grupo. (error 500)')
    }
  })
})

describe('camposConProblema', () => {
  it('saca los nombres del árbol de zod', () => {
    expect(camposConProblema({ properties: { a: { errors: ['x'] }, b: { errors: ['y'] } } })).toEqual(['a', 'b'])
  })

  it('con basura devuelve vacío', () => {
    for (const d of [null, undefined, 'texto', 42, {}, { properties: null }]) {
      expect(camposConProblema(d)).toEqual([])
    }
  })
})
