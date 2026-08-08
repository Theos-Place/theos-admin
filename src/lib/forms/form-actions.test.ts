// Acciones de un formulario según su estado.
import { describe, it, expect } from 'vitest'
import {
  canDeleteForm, canPublishForm, deleteWarning, matchesEstado, ESTADO_FILTERS,
  canUserDeleteForms, deleteBlockedReason,
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

  it('CON RESPUESTAS no se puede: lo que la gente contestó no se tira', () => {
    expect(canDeleteForm({ is_active: false, responses_count: 1 })).toBe(false)
    expect(deleteBlockedReason({ is_active: false, responses_count: 12 })).toBe('form_con_respuestas')
  })

  it('el motivo distingue los dos casos, para poder explicarlo', () => {
    expect(deleteBlockedReason({ is_active: true, responses_count: 0 })).toBe('form_activo')
    expect(deleteBlockedReason(inactivo)).toBeNull()
  })

  it('el aviso dice qué se pierde de verdad: nada más que el formulario', () => {
    expect(deleteWarning(inactivo)).toContain('no se pierde nada más')
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

  it('comunicaciones, dirección, encargado de staff y admin sí', () => {
    expect(canUserDeleteForms(['comunicaciones'])).toBe(true)
    expect(canUserDeleteForms(['direccion'])).toBe(true)
    expect(canUserDeleteForms(['forms', 'encargado_staff'])).toBe(true)
    // En este sistema ser admin NO da permisos por defecto: cada guard lista
    // sus roles. Sin esto, TI no veía el botón de eliminar.
    expect(canUserDeleteForms(['admin'])).toBe(true)
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
