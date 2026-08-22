import { describe, it, expect } from 'vitest'
import {
  excelCellKind, excelNumFmt, isDataField, columnWidthFor, answerToText, answerToCell,
  xlsxFileName, COL_WIDTH_MIN, COL_WIDTH_MAX,
} from './xlsx-export'

describe('excelCellKind', () => {
  it('solo number y scale son números', () => {
    expect(excelCellKind('number')).toBe('number')
    expect(excelCellKind('scale')).toBe('number')
  })

  it('date es fecha', () => {
    expect(excelCellKind('date')).toBe('date')
  })

  // Un select con opciones "1".."5" es una etiqueta, no una cantidad.
  it('todo lo demás es texto', () => {
    for (const t of ['text', 'textarea', 'select', 'radio', 'checkbox', 'yes_no', 'personal_data']) {
      expect(excelCellKind(t)).toBe('text')
    }
  })
})

describe('excelNumFmt', () => {
  // Esto es lo que evita que Excel se coma el cero de una cédula.
  it('texto se declara como texto', () => {
    expect(excelNumFmt('text')).toBe('@')
  })

  it('la fecha lleva formato de fecha', () => {
    expect(excelNumFmt('date')).toBe('dd/mm/yyyy')
  })

  it('el número va sin formato (el general de Excel)', () => {
    expect(excelNumFmt('number')).toBeUndefined()
  })
})

describe('isDataField', () => {
  it('las secciones y bloques de texto no son columnas', () => {
    for (const t of ['section', 'info', 'page_break']) expect(isDataField(t)).toBe(false)
  })

  it('los campos con respuesta sí', () => {
    for (const t of ['text', 'date', 'number', 'checkbox']) expect(isDataField(t)).toBe(true)
  })
})

describe('columnWidthFor', () => {
  it('respeta el piso y el techo', () => {
    expect(columnWidthFor('Edad')).toBe(COL_WIDTH_MIN)
    expect(columnWidthFor('x'.repeat(200))).toBe(COL_WIDTH_MAX)
  })

  it('en el medio, se ajusta al encabezado', () => {
    expect(columnWidthFor('x'.repeat(20))).toBe(22)
  })
})

describe('answerToText', () => {
  it('las múltiples se unen con coma, igual que el CSV', () => {
    expect(answerToText(['Lunes', 'Martes'])).toBe('Lunes, Martes')
  })

  it('vacío es cadena vacía, no "null"', () => {
    expect(answerToText(null)).toBe('')
    expect(answerToText(undefined)).toBe('')
  })

  it('un número se vuelve su texto', () => {
    expect(answerToText(5)).toBe('5')
  })
})

describe('answerToCell', () => {
  // El caso que da nombre a todo el módulo.
  it('una cédula con cero inicial se mantiene entera como texto', () => {
    expect(answerToCell('01234567', 'text')).toBe('01234567')
  })

  it('un teléfono largo no se vuelve número', () => {
    expect(answerToCell('50688887777', 'text')).toBe('50688887777')
  })

  it('un número de verdad va como número', () => {
    expect(answerToCell('42', 'number')).toBe(42)
    expect(answerToCell('3.5', 'number')).toBe(3.5)
  })

  it('un "número" que no lo es cae a texto en vez de NaN', () => {
    expect(answerToCell('no aplica', 'number')).toBe('no aplica')
  })

  it('una fecha ISO va como Date, anclada a mediodía para no correrse de día', () => {
    const d = answerToCell('2026-08-21', 'date') as Date
    expect(d).toBeInstanceOf(Date)
    expect(d.toISOString()).toBe('2026-08-21T12:00:00.000Z')
  })

  it('una fecha ilegible cae a texto', () => {
    expect(answerToCell('cuando pueda', 'date')).toBe('cuando pueda')
  })

  it('vacío es celda vacía, no 0 ni 1970', () => {
    for (const k of ['text', 'number', 'date'] as const) {
      expect(answerToCell('', k)).toBeNull()
      expect(answerToCell('   ', k)).toBeNull()
      expect(answerToCell(null, k)).toBeNull()
    }
  })
})

describe('xlsxFileName', () => {
  it('quita acentos y espacios', () => {
    expect(xlsxFileName('Encuesta de satisfacción — Estudio bíblico'))
      .toBe('Encuesta-de-satisfaccion-Estudio-biblico-respuestas.xlsx')
  })

  it('un nombre vacío no genera un archivo sin nombre', () => {
    expect(xlsxFileName('')).toBe('formulario-respuestas.xlsx')
    expect(xlsxFileName('¡¿!')).toBe('formulario-respuestas.xlsx')
  })
})

// Verificado en la base: 3 campos personal_data y 0 valores guardados. Parece un
// campo pero es un bloque que actualiza el perfil, no una pregunta.
describe('personal_data no es una columna', () => {
  it('no genera columna', () => {
    expect(isDataField('personal_data')).toBe(false)
  })
})
