import { describe, it, expect } from 'vitest'
import { parsearLinea, parsearLista, capacitacionAPlan, nombreDerecho } from './ccb-form-parse'

describe('parsearLinea — formatos reales del formulario', () => {
  it('nota pegada con espacio', () => {
    expect(parsearLinea('Carlos Rojas 85')).toMatchObject({ nombre: 'Carlos Rojas', nota: 85 })
  })
  it('nota con guion y espacios', () => {
    expect(parsearLinea('Alba Arguedas Sibaja - 100')).toMatchObject({ nombre: 'Alba Arguedas Sibaja', nota: 100 })
  })
  it('nota sin espacios', () => {
    expect(parsearLinea('Tatiana Sancho-100')).toMatchObject({ nombre: 'Tatiana Sancho', nota: 100 })
  })
  it('nota con guion pegado al nombre y espacio después', () => {
    expect(parsearLinea('Slaudy March- 100')).toMatchObject({ nombre: 'Slaudy March', nota: 100 })
  })
  it('enumerado sin nota', () => {
    expect(parsearLinea('4.Maria José Barrientos Vargas')).toMatchObject({ nombre: 'Maria José Barrientos Vargas', nota: null })
    expect(parsearLinea('5 Adriana Chavarría Escalante')).toMatchObject({ nombre: 'Adriana Chavarría Escalante', nota: null })
  })
  it('el paréntesis es observación, no nota', () => {
    expect(parsearLinea('5. Luisa Quesada Vargas (Necesita pasantia para mejorar)')).toMatchObject({
      nombre: 'Luisa Quesada Vargas', nota: null, observacion: 'Necesita pasantia para mejorar',
    })
  })
  it('conserva tildes en el nombre', () => {
    expect(parsearLinea('Priscilla Cisneros Garcés - 100')?.nombre).toBe('Priscilla Cisneros Garcés')
  })
  it('acepta partículas de apellido', () => {
    expect(parsearLinea('Maria del Pilar Rivas - 100')?.nombre).toBe('Maria del Pilar Rivas')
  })
})

describe('parsearLinea — lo que NO es una persona', () => {
  it.each(['NA', 'None', '-', 'Si todos vieron la charla', 'Ninguno', 'no aplica'])(
    'descarta %s', linea => expect(parsearLinea(linea)).toBeNull(),
  )
  it('descarta un nombre de una sola palabra (no se puede matchear)', () => {
    expect(parsearLinea('Carlos')).toBeNull()
  })
})

describe('parsearLinea — la nota no se inventa', () => {
  it('sin número, nota null', () => {
    expect(parsearLinea('David Cordero')).toMatchObject({ nombre: 'David Cordero', nota: null })
  })
  it('decimal en escala 0-100 sí es nota', () => {
    expect(parsearLinea('Isaac León 78.54')).toMatchObject({ nombre: 'Isaac León', nota: 78.54 })
    expect(parsearLinea('Milena Vargas 92,5')).toMatchObject({ nombre: 'Milena Vargas', nota: 92.5 })
    expect(parsearLinea('Karla Pineda -90,75')).toMatchObject({ nombre: 'Karla Pineda', nota: 90.75 })
  })
  it('decimal en escala 0-10 NO se convierte: queda ambigua', () => {
    // "9.0" puede ser un 9 o un 90. Se guarda el crudo y la nota va en null.
    expect(parsearLinea('Alejandro Egea - 9.0')).toMatchObject({
      nombre: 'Alejandro Egea', nota: null, notaAmbigua: '9.0',
    })
    expect(parsearLinea('Fiorela Montealegre - 8.5')?.nota).toBeNull()
    // También el entero suelto: un "8" no dice si es 8/10 u 8/100.
    expect(parsearLinea('Ariana Bonilla - 9')).toMatchObject({ nota: null, notaAmbigua: '9' })
  })
  it('un valor fuera de rango no es nota, pero el nombre se conserva', () => {
    expect(parsearLinea('Ana Mora - 150')).toMatchObject({ nombre: 'Ana Mora', nota: null, notaAmbigua: '150' })
  })
  it('acepta por encima de 100 (la base tiene hasta 105,20)', () => {
    expect(parsearLinea('Meysi Arias Ledezma - 100.5')?.nota).toBe(100.5)
  })
  it('nota pegada sin espacio', () => {
    expect(parsearLinea('Acon Chaves, Melissa97')).toMatchObject({ nota: 97 })
  })
})

describe('parsearLinea — nombre invertido de CCB', () => {
  it('ofrece las dos lecturas y no elige', () => {
    const p = parsearLinea('Vargas Rodriguez, Maria Emilia - 100')!
    expect(p.nota).toBe(100)
    expect(p.variantes).toEqual(['Maria Emilia Vargas Rodriguez', 'Vargas Rodriguez Maria Emilia'])
  })
  it('nombreDerecho invierte por la coma', () => {
    expect(nombreDerecho('De la O Ríos, Eithel')).toBe('Eithel De la O Ríos')
    expect(nombreDerecho('Sin Coma')).toBe('Sin Coma')
  })
  it('dos o más comas es una línea con varias personas: se descarta y se reporta', () => {
    expect(parsearLinea('Aniri Herrera, Marcia Solano, Federico Ortega')).toBeNull()
  })
})

describe('parsearLinea — comentario del dirigente después del nombre', () => {
  it('el texto tras un guion con espacio es observación', () => {
    expect(parsearLinea('Karla Ávila- dejó el curso por temas de salud')).toMatchObject({
      nombre: 'Karla Ávila', observacion: 'dejó el curso por temas de salud',
    })
  })
  it('no parte un apellido con guion', () => {
    expect(parsearLinea('Ana Vargas-Mora')?.nombre).toBe('Ana Vargas-Mora')
  })
  it('separa nombre y apellido pegados', () => {
    expect(parsearLinea('1. NataliaBlanco - 70')).toMatchObject({ nombre: 'Natalia Blanco', nota: 70 })
  })
  it('ignora el asterisco de marca', () => {
    expect(parsearLinea('Adriana vargas *')?.nombre).toBe('Adriana vargas')
  })
})

describe('parsearLinea — modo laxo (contra la lista de UN grupo)', () => {
  it('estricto rechaza el nombre de pila solo; laxo lo acepta', () => {
    expect(parsearLinea('Fernando101')).toBeNull()
    // 101 es una nota válida: la base tiene notas hasta 105,20 (puntos extra).
    expect(parsearLinea('Fernando101', true)).toMatchObject({ nombre: 'Fernando', nota: 101 })
  })
  it('lee el nombre de pila con nota pegada y coma decimal', () => {
    expect(parsearLinea('Laura78,32', true)).toMatchObject({ nombre: 'Laura', nota: 78.32 })
  })
  it('quita la inicial suelta del apellido', () => {
    expect(parsearLinea('Marielena H. 95,64', true)).toMatchObject({ nombre: 'Marielena', nota: 95.64 })
  })
  it('el modo laxo NO relaja lo que no es una persona', () => {
    expect(parsearLinea('Ninguno', true)).toBeNull()
    expect(parsearLinea('NA', true)).toBeNull()
  })
})

describe('parsearLista', () => {
  it('separa personas de líneas descartadas y guarda el crudo', () => {
    const r = parsearLista('Carlos Rojas 85\nSi todos vieron la charla\n\nAndrea Vega 85')
    expect(r.personas.map(p => p.nombre)).toEqual(['Carlos Rojas', 'Andrea Vega'])
    expect(r.descartadas).toEqual(['Si todos vieron la charla'])
    expect(r.personas[0].crudo).toBe('Carlos Rojas 85')
  })
  it('texto vacío no revienta', () => {
    expect(parsearLista('')).toEqual({ personas: [], descartadas: [] })
    expect(parsearLista(null)).toEqual({ personas: [], descartadas: [] })
  })
})

describe('capacitacionAPlan — las 38 grafías del campo libre', () => {
  it.each([
    ['Sirviendo como Jesús', 'SCJ'], ['Sirviendo como Jesus', 'SCJ'], ['Sirviendo Como Jesus', 'SCJ'],
    ['Discípulos 3', 'DIS3'], ['Discipulos 1', 'DIS1'],
    ['Panorama', 'PAN'],
    ['Prematrimonial', 'PREMAT'], ['Pre-Matrimonial', 'PREMAT'], ['Curso prematrimonial', 'PREMAT'],
    ['Pre matrimonial', 'PREMAT'], ['Curso PreMatrimonial', 'PREMAT'], ['Pre Matrimonial', 'PREMAT'],
    ['Hermenéutica (Cómo interpretar la Biblia)', 'HER'], ['HErmenéutica', 'HER'],
    ['Religiones del Mundo', 'RDM'], ['Religiones del mundo (virtual)', 'RDM'],
    ['Administrando el Dinero', 'AED'], ['Cómo Administrar el Dinero', 'AED'],
    ['Administración del dinero', 'AED'], ['Admin del Dinero', 'AED'], ['Administrar el Dinero', 'AED'],
    ['CDEB', 'CDEB'], ['Cómo dar estudios', 'CDEB'], ['Como Dar Estudio de Biblia', 'CDEB'],
    ['Cómo tomar buenas decisiones', 'CTBD'],
    ['Amor Sin Fronteras', 'ASF'], ['Amor Sin Fronteras / X-Plore', 'ASF'],
    ['Evangelismo', 'EVM'], ['Evagelismo', 'EVM'],
    ['Hechos', 'HCH'], ['Hebreos', 'HEB'], ['Romanos', 'ROM'], ['Evangelios', 'EVA'],
  ])('%s → %s', (texto, code) => expect(capacitacionAPlan(texto)).toBe(code))

  it('lo que no calza devuelve null, no el plan más parecido', () => {
    expect(capacitacionAPlan('')).toBeNull()
    expect(capacitacionAPlan('Retiro de mujeres')).toBeNull()
  })
})
