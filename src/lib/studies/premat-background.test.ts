import { describe, it, expect } from 'vitest'
import {
  parsePrematBackground, redactSensitiveBackground,
  DATING_TIME_OPTIONS, LIVING_OPTIONS,
} from './premat-background'

const full = {
  dating_time: '1_2',
  first_marriage: true,
  has_children: false,
  living_arrangement: 'separadas',
}

describe('parsePrematBackground (PRE-9)', () => {
  it('antecedentes completos → ok', () => {
    const r = parsePrematBackground(full)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.dating_time).toBe('1_2')
      expect(r.value.living_arrangement).toBe('separadas')
      expect(r.value.diagnostic_notes).toBeNull() // opcional
    }
  })

  it('preguntas cerradas obligatorias y del catálogo', () => {
    expect(parsePrematBackground({ ...full, dating_time: '' })).toMatchObject({ ok: false })
    expect(parsePrematBackground({ ...full, dating_time: '10_años' })).toMatchObject({ ok: false })
    expect(parsePrematBackground({ ...full, living_arrangement: 'otra' })).toMatchObject({ ok: false })
    expect(parsePrematBackground({ ...full, first_marriage: null })).toMatchObject({ ok: false })
    expect(parsePrematBackground({ ...full, has_children: undefined })).toMatchObject({ ok: false })
  })

  it('condicional: primer matrimonio "No" exige el detalle', () => {
    expect(parsePrematBackground({ ...full, first_marriage: false })).toMatchObject({ ok: false })
    const r = parsePrematBackground({ ...full, first_marriage: false, previous_marriage_notes: 'Divorcio en 2019' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.previous_marriage_notes).toBe('Divorcio en 2019')
  })

  it('condicional: hijos "Sí" exige las edades', () => {
    expect(parsePrematBackground({ ...full, has_children: true })).toMatchObject({ ok: false })
    const r = parsePrematBackground({ ...full, has_children: true, children_ages: '4 y 7' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.children_ages).toBe('4 y 7')
  })

  it('el detalle no se arrastra si la respuesta cambia (no se guarda texto huérfano)', () => {
    const r = parsePrematBackground({ ...full, first_marriage: true, previous_marriage_notes: 'texto viejo', has_children: false, children_ages: '5' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.previous_marriage_notes).toBeNull()
      expect(r.value.children_ages).toBeNull()
    }
  })

  it('diagnóstico es opcional y se recorta', () => {
    const r = parsePrematBackground({ ...full, diagnostic_notes: '  hablar de finanzas  ' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.diagnostic_notes).toBe('hablar de finanzas')
  })

  it('catálogos con las opciones exactas de la spec', () => {
    expect(DATING_TIME_OPTIONS.map(o => o.label)).toEqual(['Menos de 1 año', '1 a 2 años', '3 a 4 años', 'Más de 4 años'])
    expect(LIVING_OPTIONS.map(o => o.label)).toEqual(['Casas separadas', 'Ya convivimos'])
  })
})

describe('redactSensitiveBackground (PRE-9)', () => {
  it('borra los campos pastorales y deja el resto', () => {
    const row = {
      id: 'r1', dating_time: '1_2', previous_marriage_notes: 'divorcio',
      diagnostic_notes: 'tema difícil', has_children: true,
    }
    expect(redactSensitiveBackground(row)).toEqual({
      id: 'r1', dating_time: '1_2', previous_marriage_notes: null,
      diagnostic_notes: null, has_children: true,
    })
  })

  it('no agrega campos que no estaban (solicitudes viejas)', () => {
    expect(redactSensitiveBackground({ id: 'r1' })).toEqual({ id: 'r1' })
  })
})
