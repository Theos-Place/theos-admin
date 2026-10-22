import { describe, it, expect } from 'vitest'
import { posicionDelPopover } from './DatePicker'

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
