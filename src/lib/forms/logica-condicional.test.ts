import { describe, it, expect } from 'vitest'
import { cumpleCondicion, evaluarRegla, campoVisible } from './logica-condicional'
import type { LogicRule } from '@/types/forms'

const SOCIALES = 'Actividades Sociales'
const CORTOS = 'Estudios Bíblicos cortos (aprox. 10-12 semanas)'
const LARGOS = 'Estudios Bíblicos largos (aprox. 10 meses- 1 año)'

const regla = (p: Partial<LogicRule> = {}): LogicRule => ({
  id: 'r1', action: 'show', condition_operator: 'AND',
  conditions: [{ id: 'c1', field_id: 'actividades', operator: 'eq', value: SOCIALES }],
  ...p,
})

describe('EL BUG DE "Lugares para Estudios o Actividades" (2026-09-18)', () => {
  /**
   * La condición "es igual a" se evaluaba con `String(respuesta) === valor`.
   * Con casillas la respuesta es una lista, y String() la pega con comas: con
   * UNA marcada funcionaba de casualidad, con dos se rompía y desaparecían dos
   * preguntas OBLIGATORIAS.
   */
  const campo = { logic_rules: [regla()] }

  it('una sola marcada: se muestra (esto ya funcionaba)', () => {
    expect(campoVisible(campo, { actividades: [SOCIALES] })).toBe(true)
  })

  it('LA MISMA Y ADEMÁS OTRA: también se muestra', () => {
    expect(campoVisible(campo, { actividades: [CORTOS, SOCIALES] })).toBe(true)
    expect(campoVisible(campo, { actividades: [SOCIALES, CORTOS] })).toBe(true)
    expect(campoVisible(campo, { actividades: [CORTOS, LARGOS, SOCIALES] })).toBe(true)
  })

  it('sin esa opción marcada: se esconde', () => {
    expect(campoVisible(campo, { actividades: [CORTOS, LARGOS] })).toBe(false)
    expect(campoVisible(campo, { actividades: [] })).toBe(false)
    expect(campoVisible(campo, {})).toBe(false)
  })

  it('el orden de lo marcado no cambia nada', () => {
    // Con String(lista) sí cambiaba: dependía de cuál quedara primero.
    expect(campoVisible(campo, { actividades: [SOCIALES, CORTOS] }))
      .toBe(campoVisible(campo, { actividades: [CORTOS, SOCIALES] }))
  })
})

describe('cumpleCondicion', () => {
  it('eq sobre texto sigue siendo igualdad exacta', () => {
    expect(cumpleCondicion('eq', 'Otro', 'Otro')).toBe(true)
    expect(cumpleCondicion('eq', 'Otros', 'Otro')).toBe(false)
    expect(cumpleCondicion('eq', null, 'Otro')).toBe(false)
  })

  it('neq sobre una lista es "NO está marcado"', () => {
    expect(cumpleCondicion('neq', [CORTOS], SOCIALES)).toBe(true)
    expect(cumpleCondicion('neq', [CORTOS, SOCIALES], SOCIALES)).toBe(false)
  })

  it('contains sobre texto no distingue mayúsculas; sobre lista es exacto', () => {
    expect(cumpleCondicion('contains', 'Casa de Playa', 'casa')).toBe(true)
    expect(cumpleCondicion('contains', ['Piscina'], 'Piscina')).toBe(true)
    expect(cumpleCondicion('contains', ['Piscina'], 'piscina')).toBe(false)
  })

  it('vacío y no vacío entienden la lista', () => {
    expect(cumpleCondicion('is_empty', [], '')).toBe(true)
    expect(cumpleCondicion('is_empty', [SOCIALES], '')).toBe(false)
    expect(cumpleCondicion('is_not_empty', [SOCIALES], '')).toBe(true)
    expect(cumpleCondicion('is_not_empty', '', '')).toBe(false)
  })

  it('mayor y menor comparan números', () => {
    expect(cumpleCondicion('gt', 20, '14')).toBe(true)
    expect(cumpleCondicion('lt', '9', '14')).toBe(true)
  })

  it('un operador desconocido no muestra nada, no revienta', () => {
    expect(cumpleCondicion('acertijo', 'x', 'x')).toBe(false)
  })
})

describe('evaluarRegla', () => {
  const dos = (op: 'AND' | 'OR'): LogicRule => regla({
    condition_operator: op,
    conditions: [
      { id: 'a', field_id: 'actividades', operator: 'eq', value: SOCIALES },
      { id: 'b', field_id: 'zona', operator: 'eq', value: 'San José' },
    ],
  })

  it('AND exige las dos; OR con una alcanza', () => {
    const media = { actividades: [SOCIALES, CORTOS], zona: 'Cartago' }
    expect(evaluarRegla(dos('AND'), media)).toBe(false)
    expect(evaluarRegla(dos('OR'), media)).toBe(true)
  })
})

describe('campoVisible', () => {
  it('sin reglas, siempre visible', () => {
    expect(campoVisible({ logic_rules: [] }, {})).toBe(true)
    expect(campoVisible({ logic_rules: undefined }, {})).toBe(true)
  })

  it('GANA LA PRIMERA REGLA QUE SE CUMPLE, no "ocultar le gana a mostrar"', () => {
    // Es la semántica que ya tenía la pantalla y se conserva: este cambio vino
    // a arreglar `eq`, no a mover formularios que hoy funcionan.
    const mostrar = regla({ id: 'm', action: 'show' })
    const ocultar = regla({ id: 'o', action: 'hide' })
    const resp = { actividades: [SOCIALES] }
    expect(campoVisible({ logic_rules: [mostrar, ocultar] }, resp)).toBe(true)
    expect(campoVisible({ logic_rules: [ocultar, mostrar] }, resp)).toBe(false)
  })

  it('con reglas de mostrar y ninguna cumplida, se esconde', () => {
    expect(campoVisible({ logic_rules: [regla()] }, { actividades: [CORTOS] })).toBe(false)
  })

  it('con SOLO reglas de ocultar y ninguna cumplida, se muestra', () => {
    expect(campoVisible({ logic_rules: [regla({ action: 'hide' })] }, { actividades: [CORTOS] })).toBe(true)
  })
})
