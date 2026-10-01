import { describe, it, expect } from 'vitest'
import { MEMBER_COLUMNS } from '@/app/(admin)/miembros/_members-columns'
import type { Member } from '@/types/member'

/**
 * La fecha de cumpleaños como columna del padrón (pedido del 2026-09-30).
 *
 * Existía «Edad» y no alcanzaba: con la edad se filtran rangos, con la fecha
 * se sabe qué día saludar. Una no se deduce de la otra —de «47 años» no sale
 * el 26 de diciembre— y era justo la que no se podía ni mostrar ni exportar.
 */
const ficha = (birth_date: string | null) => ({ birth_date } as unknown as Member)
const col = MEMBER_COLUMNS.find(c => c.key === 'birth_date')

describe('columna Cumpleaños', () => {
  it('está en el selector y se puede escoger', () => {
    expect(col, 'no existe la columna birth_date').toBeDefined()
    expect(col!.label).toBe('Cumpleaños')
    // Apagada por defecto: la tabla ya es ancha y esto se pide cuando se
    // necesita. Poder escogerla era el pedido, no que apareciera sola.
    expect(col!.defaultVisible).toBeFalsy()
    expect(col!.alwaysVisible).toBeFalsy()
  })

  it('se muestra y se exporta como dd/mm/aaaa, no como ISO', () => {
    // La tabla usa `exportValue` también para pintar la celda, así que esto
    // gobierna las dos cosas a la vez.
    expect(col!.exportValue!(ficha('1978-12-26'))).toBe('26/12/1978')
  })

  it('sin fecha exporta vacío, no un guión', () => {
    // En pantalla el '—' lo pone la tabla; en un CSV una celda vacía se
    // ordena y se filtra, y un guión no.
    expect(col!.exportValue!(ficha(null))).toBe('')
  })

  it('no reemplaza a Edad: conviven', () => {
    const edad = MEMBER_COLUMNS.find(c => c.key === 'age')
    expect(edad).toBeDefined()
    expect(edad!.exportValue!(ficha('1978-12-26'))).toMatch(/^\d+$/)
  })

  it('ninguna clave de columna se repite', () => {
    // Dos columnas con la misma `key` se pisan en el selector y en el CSV,
    // y el síntoma es que una «no se puede escoger».
    const claves = MEMBER_COLUMNS.map(c => String(c.key))
    expect(claves.length).toBe(new Set(claves).size)
  })
})
