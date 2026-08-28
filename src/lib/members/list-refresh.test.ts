import { describe, it, expect } from 'vitest'
import { sePuedeRecalcular, mensajeRecalculo, motivoNoRecalculable } from './list-refresh'
import type { FilterState } from '@/types/filters'

const cond = [{ id: 1, group: 'study', type: 'study', study: 'N4', status: 'completed', from: null, to: null }] as FilterState['conditions']

describe('sePuedeRecalcular', () => {
  it('con el filtro completo (v:2) y condiciones, sí', () => {
    expect(sePuedeRecalcular({ v: 2, conditions: cond, groups: [] })).toBe(true)
  })
  it('solo con un chip, también', () => {
    expect(sePuedeRecalcular({ v: 2, conditions: [], groups: [], is_donor: true })).toBe(true)
    expect(sePuedeRecalcular({ v: 2, conditions: [], groups: [], is_server: true })).toBe(true)
    expect(sePuedeRecalcular({ v: 2, conditions: [], groups: [], active_attendance: 'estudios' })).toBe(true)
  })
  it('sin filtros NO: recalcularla la dejaría vacía', () => {
    expect(sePuedeRecalcular({ v: 2, conditions: [], groups: [] })).toBe(false)
    expect(sePuedeRecalcular(null)).toBe(false)
    expect(sePuedeRecalcular(undefined)).toBe(false)
  })
  it('un chip en false no cuenta como filtro', () => {
    expect(sePuedeRecalcular({ v: 2, conditions: [], groups: [], is_donor: false, is_server: false })).toBe(false)
  })
})

describe('filtro incompleto (listas guardadas antes de la corrección)', () => {
  it('sin v:2 NO se recalcula, aunque tenga condiciones', () => {
    // El caso medido: "Invitación N1" tiene 260 personas guardadas y,
    // recalculada sin el chip de asistencia que no se guardó, da 14.848.
    expect(sePuedeRecalcular({ conditions: cond, groups: [] })).toBe(false)
    expect(motivoNoRecalculable({ conditions: cond, groups: [] }))
      .toContain('antes de que se guardara el filtro completo')
  })
  it('el motivo dice cómo arreglarlo, no solo que no se puede', () => {
    expect(motivoNoRecalculable({ conditions: cond, groups: [] })).toContain('guardala de nuevo')
  })
  it('con v:2 y filtros, no hay motivo', () => {
    expect(motivoNoRecalculable({ v: 2, conditions: cond, groups: [] })).toBeNull()
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
