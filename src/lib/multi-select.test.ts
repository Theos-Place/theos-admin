import { describe, it, expect } from 'vitest'
import { filtrarOpciones, etiquetaSeleccion, alternar, claveBusqueda } from './multi-select'

const TIPOS = [
  { value: 'N1', label: 'N1 — Nivel 1' },
  { value: 'N2', label: 'N2 — Nivel 2' },
  { value: 'HER', label: 'HER — Hermenéutica' },
  { value: 'AED', label: 'AED — Administrando el Dinero' },
  { value: 'DIS1', label: 'DIS1 — Discípulos 1' },
]

describe('filtrarOpciones', () => {
  it('sin texto devuelve todo', () => {
    expect(filtrarOpciones(TIPOS, '')).toHaveLength(5)
    expect(filtrarOpciones(TIPOS, '   ')).toHaveLength(5)
  })

  it('encuentra sin tildes: "hermeneutica" trae "Hermenéutica"', () => {
    expect(filtrarOpciones(TIPOS, 'hermeneutica').map(o => o.value)).toEqual(['HER'])
  })

  it('busca por código', () => {
    expect(filtrarOpciones(TIPOS, 'dis1').map(o => o.value)).toEqual(['DIS1'])
  })

  it('cada palabra cuenta, en cualquier orden', () => {
    expect(filtrarOpciones(TIPOS, 'dinero admin').map(o => o.value)).toEqual(['AED'])
  })

  it('"nivel" trae los dos niveles', () => {
    expect(filtrarOpciones(TIPOS, 'nivel').map(o => o.value)).toEqual(['N1', 'N2'])
  })

  it('lo que no existe da lista vacía, no todo', () => {
    expect(filtrarOpciones(TIPOS, 'apocalipsis')).toEqual([])
  })

  it('no muta la lista original', () => {
    const copia = [...TIPOS]
    filtrarOpciones(TIPOS, 'nivel')
    expect(TIPOS).toEqual(copia)
  })
})

describe('etiquetaSeleccion', () => {
  const base = { opciones: TIPOS, vacio: 'Todos', sustantivo: 'tipos' }

  it('sin nada escogido dice el texto de vacío', () => {
    expect(etiquetaSeleccion({ ...base, seleccionados: [] })).toBe('Todos')
  })

  it('con uno solo dice CUÁL es, no "1 tipo"', () => {
    expect(etiquetaSeleccion({ ...base, seleccionados: ['HER'] })).toBe('HER — Hermenéutica')
  })

  it('con varios cuenta', () => {
    expect(etiquetaSeleccion({ ...base, seleccionados: ['N1', 'N2', 'HER'] })).toBe('3 tipos')
  })

  it('un código que ya no está en el catálogo no rompe la etiqueta', () => {
    expect(etiquetaSeleccion({ ...base, seleccionados: ['BORRADO'] })).toBe('1 tipos')
  })
})

describe('alternar', () => {
  it('agrega al final: el orden de escogencia se conserva', () => {
    expect(alternar(['N1'], 'HER')).toEqual(['N1', 'HER'])
  })

  it('quita lo que ya estaba', () => {
    expect(alternar(['N1', 'HER'], 'N1')).toEqual(['HER'])
  })

  it('no duplica', () => {
    expect(alternar(alternar([], 'N1'), 'N1')).toEqual([])
  })

  it('no muta el arreglo que recibe', () => {
    const sel = ['N1']
    alternar(sel, 'N2')
    expect(sel).toEqual(['N1'])
  })
})

describe('claveBusqueda', () => {
  it('quita tildes y baja a minúscula', () => {
    expect(claveBusqueda('Hermenéutica')).toBe('hermeneutica')
    expect(claveBusqueda('  Discípulos 1 ')).toBe('discipulos 1')
  })
})
