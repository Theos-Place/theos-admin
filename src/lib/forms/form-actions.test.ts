// Acciones de un formulario según su estado.
import { describe, it, expect } from 'vitest'
import {
  canDeleteForm, canPublishForm, deleteWarning, matchesEstado, ESTADO_FILTERS,
  canUserDeleteForms,
} from './form-actions'

const activo = { is_active: true, responses_count: 0 }
const inactivo = { is_active: false, responses_count: 0 }

describe('eliminar', () => {
  it('NO se puede eliminar un formulario activo: puede estar llenándose ahora', () => {
    expect(canDeleteForm(activo)).toBe(false)
  })

  it('desactivado sí', () => {
    expect(canDeleteForm(inactivo)).toBe(true)
  })

  it('con respuestas se avisa CUÁNTAS se pierden, no un texto genérico', () => {
    expect(deleteWarning({ ...inactivo, responses_count: 12 }))
      .toContain('las 12 respuestas')
    expect(deleteWarning({ ...inactivo, responses_count: 1 }))
      .toContain('la respuesta que ya recibió')
  })

  it('sin respuestas no se advierte nada: no hay nada que perder', () => {
    expect(deleteWarning(inactivo)).toBeNull()
  })
})

describe('publicar', () => {
  it('solo tiene sentido en uno desactivado', () => {
    expect(canPublishForm(inactivo)).toBe(true)
    expect(canPublishForm(activo)).toBe(false)
  })
})

describe('quién puede borrar', () => {
  it('el rol de formularios NO alcanza: borrar se lleva las respuestas', () => {
    expect(canUserDeleteForms(['forms'])).toBe(false)
    expect(canUserDeleteForms([])).toBe(false)
    expect(canUserDeleteForms(undefined)).toBe(false)
  })

  it('comunicaciones, dirección y encargado de staff sí', () => {
    expect(canUserDeleteForms(['comunicaciones'])).toBe(true)
    expect(canUserDeleteForms(['direccion'])).toBe(true)
    expect(canUserDeleteForms(['forms', 'encargado_staff'])).toBe(true)
  })
})

describe('filtro por estado', () => {
  it('los tres estados del chip', () => {
    expect(ESTADO_FILTERS.map(f => f.key)).toEqual(['all', 'active', 'inactive'])
  })

  it('filtra lo que dice', () => {
    expect(matchesEstado(activo, 'active')).toBe(true)
    expect(matchesEstado(activo, 'inactive')).toBe(false)
    expect(matchesEstado(inactivo, 'inactive')).toBe(true)
    expect(matchesEstado(activo, 'all')).toBe(true)
    expect(matchesEstado(inactivo, 'all')).toBe(true)
  })
})
