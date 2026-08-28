// Qué deja y qué no deja guardar un formulario.
import { describe, it, expect } from 'vitest'
import { fieldProblems, saveBlockedMessage, LABEL_OPTIONAL } from './field-validation'
import type { FieldType } from '@/types/forms'

const campo = (over: Partial<{ id: string; type: FieldType; label: string; description: string | null }> = {}) => ({
  id: 'f1', type: 'text' as FieldType, label: 'Tu nombre', description: null, ...over,
})

describe('campos normales', () => {
  it('con etiqueta, pasa', () => {
    expect(fieldProblems([campo()])).toEqual([])
    expect(saveBlockedMessage([campo()])).toBeNull()
  })

  it('sin etiqueta, no', () => {
    const p = fieldProblems([campo({ label: '   ' })])
    expect(p).toHaveLength(1)
    expect(p[0].message).toMatch(/etiqueta/i)
  })
})

describe('bloque de texto informativo', () => {
  const info = (over = {}) => campo({ type: 'info', label: '', description: null, ...over })

  it('EL BUG: sin título pero CON texto, se puede guardar', () => {
    // El inspector dice "Título (opcional)" y el guardado lo exigía igual.
    expect(fieldProblems([info({ description: 'Leé la declaración doctrinal…' })])).toEqual([])
  })

  it('con título y sin texto también (el título alcanza como contenido)', () => {
    expect(fieldProblems([info({ label: 'Importante' })])).toEqual([])
  })

  it('pero vacío del todo, no: sería un recuadro en blanco', () => {
    const p = fieldProblems([info()])
    expect(p).toHaveLength(1)
    expect(p[0].message).toMatch(/vac[íi]o/i)
  })

  it('el tipo está en la lista de etiqueta opcional', () => {
    expect(LABEL_OPTIONAL).toContain('info')
    expect(LABEL_OPTIONAL).toContain('page_break')
  })
})

describe('el corte de página nunca pide etiqueta', () => {
  it('sin nada, pasa', () => {
    expect(fieldProblems([campo({ type: 'page_break', label: '' })])).toEqual([])
  })
})

describe('el mensaje señala el primer problema', () => {
  it('uno solo: el motivo exacto', () => {
    expect(saveBlockedMessage([campo({ label: '' })])).toMatch(/etiqueta/i)
  })

  it('varios: cuántos y cuál es el primero', () => {
    const msg = saveBlockedMessage([campo({ id: 'a', label: '' }), campo({ id: 'b', label: '' })])
    expect(msg).toMatch(/2 campos/)
  })

  it('apunta al campo para poder saltar a él', () => {
    const p = fieldProblems([campo({ id: 'x', label: '' })])
    expect(p[0].fieldId).toBe('x')
  })
})

describe('el campo oculto de estudios no exige etiqueta', () => {
  it('sin etiqueta guarda igual: es oculto, nadie va a leer ese título', () => {
    expect(fieldProblems([{ id: 'f1', type: 'studies_done', label: '' }])).toEqual([])
  })
  it('un campo normal sin etiqueta sigue sin poder guardarse', () => {
    expect(fieldProblems([{ id: 'f1', type: 'text', label: '' }])).toHaveLength(1)
  })
})
