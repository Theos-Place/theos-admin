// Retroalimentación al dirigente: validación, quién puede responder y el
// resumen que se le muestra.
import { describe, it, expect } from 'vitest'
import {
  feedbackError, canEvaluate, summarize, visibleForLeader,
  SCORE_LABELS, COMMENT_MAX, MIN_RESPUESTAS_PARA_MOSTRAR,
} from './leader-feedback'

describe('validación de la respuesta', () => {
  it('una nota del 1 al 5 pasa', () => {
    for (const score of [1, 2, 3, 4, 5]) expect(feedbackError({ score })).toBeNull()
  })

  it('fuera de rango, no', () => {
    expect(feedbackError({ score: 0 })).toMatch(/del 1 al 5/)
    expect(feedbackError({ score: 6 })).toMatch(/del 1 al 5/)
  })

  it('una nota a medias tampoco (la escala es de enteros)', () => {
    expect(feedbackError({ score: 4.5 })).toMatch(/del 1 al 5/)
  })

  it('el comentario tiene tope', () => {
    expect(feedbackError({ score: 5, comments: 'x'.repeat(COMMENT_MAX) })).toBeNull()
    expect(feedbackError({ score: 5, comments: 'x'.repeat(COMMENT_MAX + 1) })).toMatch(/caracteres/)
  })

  it('cada nota tiene su etiqueta: un número pelado no dice lo mismo para todos', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(SCORE_LABELS[n]).toBeTruthy()
  })
})

describe('quién puede evaluar', () => {
  const base = { enrollmentStatus: 'completed', groupClosed: true, alreadyAnswered: false, isLeader: false }

  it('quien llevó el estudio y el grupo ya cerró', () => {
    expect(canEvaluate(base).allowed).toBe(true)
    expect(canEvaluate({ ...base, enrollmentStatus: 'enrolled' }).allowed).toBe(true)
  })

  it('el propio dirigente NO se evalúa a sí mismo', () => {
    const r = canEvaluate({ ...base, isLeader: true })
    expect(r.allowed).toBe(false)
    expect(r.allowed === false && r.reason).toMatch(/vos mismo/i)
  })

  it('antes del cierre, no', () => {
    const r = canEvaluate({ ...base, groupClosed: false })
    expect(r.allowed === false && r.reason).toMatch(/cuando el grupo cierra/i)
  })

  it('quien se retiró temprano, no: no vio el estudio', () => {
    for (const st of ['dropped', 'transferred', 'expirada', null]) {
      expect(canEvaluate({ ...base, enrollmentStatus: st }).allowed).toBe(false)
    }
  })

  it('dos veces, no', () => {
    const r = canEvaluate({ ...base, alreadyAnswered: true })
    expect(r.allowed === false && r.reason).toMatch(/ya enviaste/i)
  })
})

describe('resumen', () => {
  const rows = [
    { score: 5, comments: 'Excelente dirigente' },
    { score: 4, comments: '  ' },
    { score: 4, comments: 'Muy claro explicando' },
    { score: 3, comments: null },
  ]

  it('promedia con un decimal', () => {
    expect(summarize(rows).average).toBe(4)
    expect(summarize([{ score: 5 }, { score: 4 }, { score: 4 }]).average).toBe(4.3)
  })

  it('cuenta por nota', () => {
    const s = summarize(rows)
    expect(s.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 2, 5: 1 })
    expect(s.count).toBe(4)
  })

  it('los comentarios van SIN autor y sin los vacíos', () => {
    expect(summarize(rows).comments).toEqual(['Excelente dirigente', 'Muy claro explicando'])
  })

  it('sin respuestas no inventa un promedio', () => {
    const s = summarize([])
    expect(s.average).toBeNull()
    expect(s.count).toBe(0)
  })
})

describe('lo que ve el dirigente', () => {
  it('con pocas respuestas solo ve el conteo: un comentario lo delataría', () => {
    const pocas = summarize([{ score: 5, comments: 'Fue Ana la que escribió esto' }])
    const v = visibleForLeader(pocas)
    expect(v).toEqual({ count: 1, pending: true })
    expect('comments' in v).toBe(false)
  })

  it('con suficientes, ve todo', () => {
    const filas = Array.from({ length: MIN_RESPUESTAS_PARA_MOSTRAR }, () => ({ score: 4, comments: 'ok' }))
    const v = visibleForLeader(summarize(filas))
    expect('comments' in v && v.comments).toHaveLength(MIN_RESPUESTAS_PARA_MOSTRAR)
  })
})
