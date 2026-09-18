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
