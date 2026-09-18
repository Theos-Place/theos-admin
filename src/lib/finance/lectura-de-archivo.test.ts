import { describe, it, expect } from 'vitest'
import { partirCSV, filaDelEncabezado, aFilas } from './lectura-de-archivo'
import { detectarColumnas } from './columnas-de-donaciones'

describe('partirCSV', () => {
  it('respeta las comas dentro de comillas', () => {
    expect(partirCSV('a,b\n"Ruiz, Alejandro",500')).toEqual([['a', 'b'], ['Ruiz, Alejandro', '500']])
  })

  it('y las comillas escapadas', () => {
    expect(partirCSV('x\n"dijo ""hola"""')).toEqual([['x'], ['dijo "hola"']])
  })

  it('las filas vacías se van', () => {
    expect(partirCSV('a,b\n\n,\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('filaDelEncabezado', () => {
  it('EL CASO REAL: el export traía título y filas en blanco arriba', () => {
    // El del campa tenía el encabezado en la quinta fila. Leer la primera a
    // ciegas dejaba TODAS las columnas sin reconocer.
    const m = [['Reporte de donaciones'], [], [], ['Fecha', 'Cliente', 'Monto'], ['2026-05-05', 'X', '1']]
    expect(filaDelEncabezado(m)).toBe(3)
  })

  it('si el encabezado está de primero, es 0', () => {
    expect(filaDelEncabezado([['Fecha', 'Cliente'], ['2026-05-05', 'X']])).toBe(0)
  })

  it('un archivo raro no revienta', () => {
    expect(filaDelEncabezado([])).toBe(0)
    expect(filaDelEncabezado([['solo una']])).toBe(0)
  })
})

describe('aFilas', () => {
  const matriz = [
    ['Fecha de transacción', 'Detalle del Cliente', 'Crédito', 'Descripción'],
    ['05/05/2026', 'RUIZ MORENO ALEJANDRO', '₡50 000,00', 'Edificio'],
    ['', '', '', ''],
  ]
  const mapa = detectarColumnas(matriz[0])

  it('arma las filas con el mapeo detectado y descarta las vacías', () => {
    expect(aFilas(matriz, mapa, 0)).toEqual([{
      cedula: '', nombre: 'RUIZ MORENO ALEJANDRO', fecha: '05/05/2026',
      monto: '₡50 000,00', moneda: '', nota: 'Edificio',
    }])
  })

  it('una columna que no existe queda vacía, no rompe', () => {
    expect(aFilas(matriz, mapa, 0)[0].cedula).toBe('')
  })
})

describe('la plantilla que ofrece la pantalla se puede volver a importar', () => {
  /**
   * Es el punto de tenerla: si la plantilla y el lector se separan, alguien
   * descarga el archivo, lo llena y descubre al subirlo que no se entiende.
   * Estas son las columnas y las filas que genera `descargarPlantilla()`.
   */
  const csv = '\ufeff' + [
    'cedula,nombre,fecha,monto,moneda,nota',
    '1-0847-0291,RUIZ MORENO ALEJANDRO,2026-05-05,50000,CRC,Edificio',
    ',FERNANDEZ LOPEZ SOFIA,2026-05-10,35000,CRC,',
    ',MORA VARGAS ANA,2026-05-12,,CRC,Monto por confirmar',
  ].join('\n')

  const matriz = partirCSV(csv)
  const encabezado = filaDelEncabezado(matriz)
  const mapa = detectarColumnas(matriz[encabezado])

  it('las seis columnas se reconocen', () => {
    expect(Object.values(mapa).every(v => v !== null)).toBe(true)
  })

  it('las tres filas se leen', () => {
    expect(aFilas(matriz, mapa, encabezado)).toHaveLength(3)
  })

  it('la fila SIN MONTO se lee igual: el monto es opcional', () => {
    // Va en la plantilla a propósito; sin verlo en el ejemplo nadie sabría que
    // se puede dejar vacío.
    const f = aFilas(matriz, mapa, encabezado)[2]
    expect(f.nombre).toBe('MORA VARGAS ANA')
    expect(f.monto).toBe('')
    expect(f.nota).toBe('Monto por confirmar')
  })

  it('la cédula vacía no estorba: se cruza por nombre', () => {
    expect(aFilas(matriz, mapa, encabezado)[1].cedula).toBe('')
  })
})
