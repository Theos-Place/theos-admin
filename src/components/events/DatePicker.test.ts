import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { posicionDelPopover, rangoDeMeses } from './DatePicker'

const vp = { width: 1280, height: 800 }

describe('el calendario del DatePicker se abre donde se vea (2026-10-22)', () => {
  it('debajo del botón cuando cabe', () => {
    expect(posicionDelPopover({ top: 100, bottom: 136, left: 200 }, 340, vp)).toEqual({ top: 140, left: 200 })
  })

  it('ENCIMA del botón cuando abajo no cabe: el caso de «Termina el» al pie del paso 2', () => {
    // Botón a 40px del borde inferior: abajo sobresaldría 300px del viewport.
    const r = posicionDelPopover({ top: 724, bottom: 760, left: 200 }, 340, vp)
    expect(r.top).toBe(724 - 4 - 340)
    expect(r.top + 340).toBeLessThanOrEqual(724)
  })

  it('si no cabe ni arriba ni abajo, se queda abajo (al menos se ve el inicio)', () => {
    expect(posicionDelPopover({ top: 300, bottom: 336, left: 0 }, 340, { width: 400, height: 500 }).top).toBe(340)
  })

  it('usa la altura típica mientras no se ha medido, y no se sale por la derecha', () => {
    const r = posicionDelPopover({ top: 700, bottom: 736, left: 1200 }, undefined, vp)
    expect(r.top).toBeLessThan(700)
    expect(r.left).toBe(1280 - 300 - 8)
  })
})

describe('los menús de mes y año (Meridiano, 2026-10-27)', () => {
  it('sin min/max el rango va de 1900 a diez años adelante: una fecha de nacimiento se alcanza', () => {
    const { startMonth, endMonth } = rangoDeMeses(undefined, undefined, new Date(2026, 9, 28))
    expect(startMonth.getFullYear()).toBe(1900)
    expect(endMonth.getFullYear()).toBe(2036)
  })

  it('con min/max el rango es ese', () => {
    const r = rangoDeMeses(new Date(2026, 0, 1), new Date(2027, 5, 30))
    expect(r.startMonth.getFullYear()).toBe(2026)
    expect(r.endMonth.getFullYear()).toBe(2027)
  })

  it('el calendario los muestra', () => {
    const src = readFileSync('src/components/events/DatePicker.tsx', 'utf8')
    expect(src).toContain('captionLayout="dropdown"')
    expect(src).toContain('startMonth={startMonth}')
  })
})

describe('el calendario se ve dentro de un modal (2026-10-29)', () => {
  it('va por encima del Modal compartido (z-[1000], o z-[1100] encima de otro modal)', () => {
    const picker = readFileSync('src/components/events/DatePicker.tsx', 'utf8')
    const modal = readFileSync('src/components/shared/Modal.tsx', 'utf8')
    expect(modal).toContain('z-[1000]')
    expect(modal).toContain('z-[1100]')
    expect(picker).toContain('theos-daypicker fixed z-[1200]')
    expect(picker).not.toContain('theos-daypicker fixed z-[100] ')
  })
})

describe('una fecha puesta se puede quitar (30-oct-2026)', () => {
  // El <input type="date"> nativo se vaciaba con borrar; el selector propio no.
  it('el calendario ofrece «Borrar fecha», que manda vacío', () => {
    const src = readFileSync('src/components/events/DatePicker.tsx', 'utf8')
    expect(src).toContain('Borrar fecha')
    expect(src).toMatch(/onChange\(''\)/)
  })
})
