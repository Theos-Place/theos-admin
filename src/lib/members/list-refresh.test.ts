import { describe, it, expect } from 'vitest'
import { sePuedeRecalcular, mensajeRecalculo } from './list-refresh'
import type { FilterState } from '@/types/filters'

const cond = [{ id: 1, group: 'study', type: 'study', study: 'N4', status: 'completed', from: null, to: null }] as FilterState['conditions']

describe('sePuedeRecalcular', () => {
  it('con condiciones, sí', () => {
    expect(sePuedeRecalcular({ conditions: cond, groups: [] })).toBe(true)
  })
  it('solo con un chip (Donantes / Servidores), también', () => {
    expect(sePuedeRecalcular({ conditions: [], groups: [], is_donor: true })).toBe(true)
    expect(sePuedeRecalcular({ conditions: [], groups: [], is_server: true })).toBe(true)
  })
  it('sin filtros NO: recalcularla la dejaría vacía', () => {
    // Listas armadas a mano, y las guardadas antes de persistir los filtros.
    expect(sePuedeRecalcular({ conditions: [], groups: [] })).toBe(false)
    expect(sePuedeRecalcular(null)).toBe(false)
    expect(sePuedeRecalcular(undefined)).toBe(false)
  })
  it('un chip en false no cuenta como filtro', () => {
    expect(sePuedeRecalcular({ conditions: [], groups: [], is_donor: false, is_server: false })).toBe(false)
  })
})

describe('mensajeRecalculo', () => {
  it('dice cuántos entraron', () => {
    expect(mensajeRecalculo(10, 18)).toBe('Actualizada: 10 → 18 (+8).')
  })
  it('dice cuántos salieron', () => {
    expect(mensajeRecalculo(18, 10)).toBe('Actualizada: 18 → 10 (-8).')
  })
  it('sin cambios lo dice explícito, no finge que actualizó', () => {
    expect(mensajeRecalculo(10, 10)).toBe('Sin cambios: siguen siendo 10.')
  })
  it('agrupa los miles con el formato de es-CR', () => {
    // El separador de es-CR depende del ICU (en Node es un espacio angosto, no
    // un punto), así que se afirma que AGRUPA y no cuál carácter usa. El resto
    // de la app usa el mismo toLocaleString('es-CR').
    expect(mensajeRecalculo(3, 3338)).toMatch(/3.?338/)
    expect(mensajeRecalculo(3, 3338)).toContain('(+3335)')
  })
})
