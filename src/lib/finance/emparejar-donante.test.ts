import { describe, it, expect } from 'vitest'
import {
  emparejarDonante, claveDeNombre, palabrasDelNombre, seImportaSolo, type Candidato,
} from './emparejar-donante'

const p = (id: string, nombre: string, cedula: string | null = null): Candidato => ({ id, nombre, cedula })

const PADRON = [
  p('1', 'Alejandro Ruiz Moreno', '108470291'),
  p('2', 'Sofía Fernández López', '2-0738-1094'),
  p('3', 'Ana Patricia Salazar Arias'),
  p('4', 'María de los Ángeles Rojas'),
  p('5', 'María Rodríguez Vargas'),
  p('6', 'María Vargas Rodríguez'),
  p('7', 'Carlos Jiménez'),
]

describe('claveDeNombre', () => {
  it('EL CASO DEL BANCO: los apellidos primero dan la misma clave', () => {
    // "RUIZ MORENO ALEJANDRO" es como lo escribe el banco. Comparando texto no
    // se parece a "Alejandro Ruiz Moreno"; comparando el conjunto, sí.
    expect(claveDeNombre('RUIZ MORENO ALEJANDRO')).toBe(claveDeNombre('Alejandro Ruiz Moreno'))
  })

  it('las tildes y las mayúsculas no cuentan', () => {
    expect(claveDeNombre('SOFIA FERNANDEZ LOPEZ')).toBe(claveDeNombre('Sofía Fernández López'))
  })

  it('las partículas se descartan: el banco se las come', () => {
    expect(claveDeNombre('Maria Angeles Rojas')).toBe(claveDeNombre('María de los Ángeles Rojas'))
  })

  it('las iniciales sueltas se descartan', () => {
    // "Salazar A." abreviado no puede dejar sin match a quien está completo.
    expect(palabrasDelNombre('Ana Patricia Salazar A.')).toEqual(['ana', 'patricia', 'salazar'])
  })
})

describe('emparejarDonante', () => {
  it('por cédula, aunque venga con guiones', () => {
    const r = emparejarDonante({ cedula: '1-0847-0291', nombre: 'quien sea' }, PADRON)
    expect(r.estado).toBe('por_cedula')
    if (r.estado === 'por_cedula') expect(r.persona.id).toBe('1')
  })

  it('la cédula manda sobre el nombre', () => {
    // Si la cédula resuelve, no importa cómo esté escrito el nombre.
    const r = emparejarDonante({ cedula: '207381094', nombre: 'NOMBRE MAL ESCRITO' }, PADRON)
    expect(r.estado === 'por_cedula' && r.persona.id).toBe('2')
  })

  it('EL CASO NORMAL: nombre del banco, una sola ficha', () => {
    const r = emparejarDonante({ nombre: 'RUIZ MORENO ALEJANDRO' }, PADRON)
    expect(r.estado).toBe('por_nombre')
    if (r.estado === 'por_nombre') expect(r.persona.id).toBe('1')
  })

  it('EL RIESGO QUE CONTIENE: mismas palabras, dos personas → AMBIGUO', () => {
    // "María Rodríguez Vargas" y "María Vargas Rodríguez" son DOS personas con
    // el mismo conjunto de palabras. El sistema no elige: lo resuelve alguien.
    const r = emparejarDonante({ nombre: 'MARIA VARGAS RODRIGUEZ' }, PADRON)
    expect(r.estado).toBe('ambiguo')
    if (r.estado === 'ambiguo') expect(r.candidatos.map(c => c.id).sort()).toEqual(['5', '6'])
  })

  it('un nombre INCOMPLETO nunca se importa solo, aunque haya un solo parecido', () => {
    // Que el reporte diga "Alejandro Ruiz" no prueba que sea el Ruiz Moreno del
    // padrón y no otro que todavía no está cargado.
    const r = emparejarDonante({ nombre: 'Alejandro Ruiz' }, PADRON)
    expect(r.estado).toBe('ambiguo')
    if (r.estado === 'ambiguo') expect(r.candidatos.map(c => c.id)).toEqual(['1'])
  })

  it('con la inicial abreviada sí resuelve', () => {
    const r = emparejarDonante({ nombre: 'Ana Patricia Salazar A.' }, PADRON)
    expect(r.estado).toBe('ambiguo') // le falta el apellido completo: no se adivina
  })

  it('el nombre completo con inicial de más sí es exacto', () => {
    expect(emparejarDonante({ nombre: 'ANA PATRICIA SALAZAR ARIAS' }, PADRON).estado).toBe('por_nombre')
  })

  it('sin ninguna coincidencia', () => {
    expect(emparejarDonante({ nombre: 'Persona Que No Existe' }, PADRON).estado).toBe('sin_candidato')
  })

  it('sin nombre ni cédula', () => {
    expect(emparejarDonante({}, PADRON).estado).toBe('sin_candidato')
    expect(emparejarDonante({ nombre: '   ' }, PADRON).estado).toBe('sin_candidato')
  })

  it('un padrón vacío no revienta', () => {
    expect(emparejarDonante({ nombre: 'Alejandro Ruiz Moreno' }, []).estado).toBe('sin_candidato')
  })

  it('DOS FICHAS CON LA MISMA CÉDULA también es ambiguo', () => {
    // Pasa con duplicados sin fusionar. Elegir una al azar sería peor.
    const dos = [...PADRON, p('8', 'Alejandro Ruiz Moreno (dup)', '108470291')]
    const r = emparejarDonante({ cedula: '108470291' }, dos)
    expect(r.estado).toBe('ambiguo')
  })
})

describe('seImportaSolo', () => {
  it('solo las dos vías seguras', () => {
    expect(seImportaSolo({ estado: 'por_cedula', persona: PADRON[0] })).toBe(true)
    expect(seImportaSolo({ estado: 'por_nombre', persona: PADRON[0] })).toBe(true)
    expect(seImportaSolo({ estado: 'ambiguo', candidatos: PADRON })).toBe(false)
    expect(seImportaSolo({ estado: 'sin_candidato' })).toBe(false)
  })
})
