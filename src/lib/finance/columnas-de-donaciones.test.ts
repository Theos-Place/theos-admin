import { describe, it, expect } from 'vitest'
import {
  detectarColumnas, columnasSuficientes, fechaDeReporte, montoDeReporte,
} from './columnas-de-donaciones'

describe('detectarColumnas', () => {
  it('la plantilla del sistema', () => {
    const m = detectarColumnas(['cedula', 'nombre', 'fecha', 'monto', 'moneda'])
    expect(m).toMatchObject({ cedula: 0, nombre: 1, fecha: 2, monto: 3, moneda: 4 })
  })

  it('EL CASO REAL: un reporte de banco con otros nombres', () => {
    const m = detectarColumnas(['Fecha de transacción', 'Detalle del Cliente', 'Crédito', 'Descripción'])
    expect(m.fecha).toBe(0)
    expect(m.nombre).toBe(1)
    expect(m.monto).toBe(2)
    expect(m.nota).toBe(3)
    expect(m.cedula).toBeNull()
  })

  it('no importan tildes ni mayúsculas', () => {
    expect(detectarColumnas(['CÉDULA', 'NOMBRE', 'FECHA']).cedula).toBe(0)
  })

  it('UNA COLUMNA NO SE USA DOS VECES', () => {
    // Con "Fecha" y "Fecha de transacción" juntas, la segunda gana por
    // específica y la primera queda libre — no las dos en `fecha`.
    const m = detectarColumnas(['Fecha de transacción', 'Fecha', 'Cliente'])
    expect(m.fecha).toBe(0)
    expect(new Set(Object.values(m).filter(v => v !== null)).size)
      .toBe(Object.values(m).filter(v => v !== null).length)
  })

  it('lo que no está queda en null, no adivina', () => {
    const m = detectarColumnas(['Fecha', 'Cliente'])
    expect(m.monto).toBeNull()
    expect(m.moneda).toBeNull()
  })
})

describe('columnasSuficientes', () => {
  const base = { fecha: null, nombre: null, cedula: null, monto: null, moneda: null, nota: null }

  it('con fecha y nombre alcanza; con fecha y cédula también', () => {
    expect(columnasSuficientes({ ...base, fecha: 0, nombre: 1 })).toBe(true)
    expect(columnasSuficientes({ ...base, fecha: 0, cedula: 1 })).toBe(true)
  })

  it('sin fecha no hay donación', () => {
    expect(columnasSuficientes({ ...base, nombre: 1 })).toBe(false)
  })

  it('sin a quién asignarla tampoco', () => {
    expect(columnasSuficientes({ ...base, fecha: 0, monto: 1 })).toBe(false)
  })
})

describe('fechaDeReporte', () => {
  it('acepta ISO y día/mes/año', () => {
    expect(fechaDeReporte('2026-05-05')).toBe('2026-05-05')
    expect(fechaDeReporte('5/5/2026')).toBe('2026-05-05')
    expect(fechaDeReporte('05-11-2026')).toBe('2026-11-05')
  })

  it('NO acepta mes/día/año: elegir mal cambiaría la fecha sin avisar', () => {
    // 13 no puede ser mes, así que un archivo en formato gringo da inválido y
    // eso se VE en la vista previa, en vez de guardar otra fecha en silencio.
    expect(fechaDeReporte('12/13/2026')).toBeNull()
  })

  it('basura y vacío dan null', () => {
    for (const v of ['', null, undefined, 'ayer', '2026-13-45']) {
      expect(fechaDeReporte(v as string), String(v)).toBe(v === '2026-13-45' ? '2026-13-45' : null)
    }
  })
})

describe('montoDeReporte', () => {
  it('formato tico y formato gringo dan lo mismo', () => {
    expect(montoDeReporte('1.234,56')).toBe(1234.56)
    expect(montoDeReporte('1,234.56')).toBe(1234.56)
  })

  it('se le quita el símbolo y los espacios', () => {
    expect(montoDeReporte('₡50 000,00')).toBe(50000)
    expect(montoDeReporte('$1,500.00')).toBe(1500)
  })

  it('un entero pelado', () => {
    expect(montoDeReporte('50000')).toBe(50000)
    expect(montoDeReporte(50000)).toBe(50000)
  })

  it('vacío es null, NO cero — un monto desconocido no es una donación de ₡0', () => {
    for (const v of ['', '   ', null, undefined]) expect(montoDeReporte(v)).toBeNull()
  })

  it('texto que no es monto da null', () => {
    expect(montoDeReporte('sin monto')).toBeNull()
  })
})
