// EST-12 · Puntaje de la encuesta de satisfacción del dirigente.
import { describe, it, expect } from 'vitest'
import {
  scoreFromOptions, isNoAplica, responseAverage, perQuestionSummary,
  surveySendAt, isSurveyDue, scoreFromScale, scoreOf, escalaDe,
  type RespuestaCerrada,
} from './study-survey'

const FRECUENCIA = ['Siempre', 'Frecuentemente', 'A veces', 'Nunca']
const CON_NA = ['Con mucha sensibilidad', 'Generalmente sensible', 'Algo sensible', 'Poco sensible', 'No aplica']

describe('de palabras a número', () => {
  it('la primera opción es 5 y la última 1', () => {
    expect(scoreFromOptions(FRECUENCIA, 'Siempre')).toBe(5)
    expect(scoreFromOptions(FRECUENCIA, 'Nunca')).toBe(1)
  })

  it('el resto se reparte parejo', () => {
    expect(scoreFromOptions(FRECUENCIA, 'Frecuentemente')).toBe(3.67)
    expect(scoreFromOptions(FRECUENCIA, 'A veces')).toBe(2.33)
  })

  it('preguntas con distinta cantidad de opciones son comparables', () => {
    // La mejor siempre 5 y la peor siempre 1, tenga 4 o 5 opciones.
    const cuatro = ['Totalmente', 'En gran parte', 'Algo', 'Muy poco']
    expect(scoreFromOptions(cuatro, 'Totalmente')).toBe(5)
    expect(scoreFromOptions(cuatro, 'Muy poco')).toBe(1)
    expect(scoreFromOptions(CON_NA, 'Con mucha sensibilidad')).toBe(5)
    expect(scoreFromOptions(CON_NA, 'Poco sensible')).toBe(1)
  })

  it('"No aplica" NO puntúa: no es una opinión mala, es una no-opinión', () => {
    expect(isNoAplica('No aplica')).toBe(true)
    expect(scoreFromOptions(CON_NA, 'No aplica')).toBeNull()
    // Y sale de la escala: quedan 4 opciones que puntúan, así que "Poco
    // sensible" sigue siendo el 1 y "Algo sensible" el tercero de cuatro.
    expect(scoreFromOptions(CON_NA, 'Poco sensible')).toBe(1)
    expect(scoreFromOptions(CON_NA, 'Algo sensible')).toBe(2.33)
  })

  it('sin respuesta o con una opción que ya no existe, no puntúa', () => {
    expect(scoreFromOptions(FRECUENCIA, null)).toBeNull()
    expect(scoreFromOptions(FRECUENCIA, '')).toBeNull()
    expect(scoreFromOptions(FRECUENCIA, 'Opción vieja')).toBeNull()
  })
})

describe('calificación 1-5 (el formato de hoy)', () => {
  it('el número ES la nota', () => {
    expect(scoreFromScale(5)).toBe(5)
    expect(scoreFromScale(1)).toBe(1)
    expect(scoreFromScale('3')).toBe(3)
  })

  it('EN BLANCO no puntúa: es el "no aplica" de una escala', () => {
    expect(scoreFromScale(null)).toBeNull()
    expect(scoreFromScale('')).toBeNull()
    expect(scoreFromScale(undefined)).toBeNull()
  })

  it('si mañana alguien pone la escala en 1-10, la nota sigue siendo comparable', () => {
    expect(scoreFromScale(10, 1, 10)).toBe(5)
    expect(scoreFromScale(1, 1, 10)).toBe(1)
    expect(scoreFromScale(5.5, 1, 10)).toBe(3)
  })

  it('un valor fuera de rango se acota en vez de romper el promedio', () => {
    expect(scoreFromScale(9, 1, 5)).toBe(5)
    expect(scoreFromScale(0, 1, 5)).toBe(1)
    expect(scoreFromScale('x')).toBeNull()
  })

  it('scoreOf usa la regla que le toca a cada pregunta', () => {
    const escala: RespuestaCerrada = { fieldId: 'a', label: 'a', options: [], answer: '4', kind: 'scale' }
    const palabras: RespuestaCerrada = { fieldId: 'b', label: 'b', options: FRECUENCIA, answer: 'Siempre' }
    expect(scoreOf(escala)).toBe(4)
    expect(scoreOf(palabras)).toBe(5)
  })

  it('las columnas van en orden ascendente: JS ordena solo las claves numéricas', () => {
    expect(escalaDe({ fieldId: 'a', label: 'a', options: [], answer: null, kind: 'scale' }))
      .toEqual(['1', '2', '3', '4', '5'])
  })
})

describe('promedio de una respuesta', () => {
  const p = (label: string, options: string[], answer: string | null): RespuestaCerrada =>
    ({ fieldId: label, label, options, answer })

  it('promedia solo lo que puntúa', () => {
    expect(responseAverage([
      p('a', FRECUENCIA, 'Siempre'),      // 5
      p('b', FRECUENCIA, 'Nunca'),        // 1
      p('c', CON_NA, 'No aplica'),        // no cuenta
    ])).toBe(3)
  })

  it('todo "No aplica" no inventa un promedio', () => {
    expect(responseAverage([p('c', CON_NA, 'No aplica')])).toBeNull()
  })

  it('mezcla de calificación y palabras: se promedian juntas', () => {
    expect(responseAverage([
      { fieldId: 'a', label: 'a', options: [], answer: '5', kind: 'scale' },
      p('b', FRECUENCIA, 'Nunca'),   // 1
    ])).toBe(3)
  })
})

describe('promedio POR PREGUNTA', () => {
  const preguntas = (a: string, b: string): RespuestaCerrada[] => [
    { fieldId: 'f1', label: 'Conocimiento', options: FRECUENCIA, answer: a },
    { fieldId: 'f2', label: 'Participación', options: FRECUENCIA, answer: b },
  ]

  it('es lo que dice DÓNDE mejorar', () => {
    // Un promedio general de 4 no distingue estas dos preguntas; el por-pregunta sí.
    const r = perQuestionSummary([preguntas('Siempre', 'A veces'), preguntas('Siempre', 'Nunca')])
    const porId = Object.fromEntries(r.map(x => [x.fieldId, x]))
    expect(porId.f1.average).toBe(5)
    expect(porId.f2.average).toBe(1.67)
  })

  it('cuenta cuántas veces se eligió cada opción', () => {
    const r = perQuestionSummary([preguntas('Siempre', 'Nunca'), preguntas('Siempre', 'Nunca')])
    expect(r[0].breakdown['Siempre']).toBe(2)
    expect(r[1].breakdown['Nunca']).toBe(2)
  })

  it('el conteo no incluye a quien puso "No aplica"', () => {
    const r = perQuestionSummary([
      [{ fieldId: 'x', label: 'Sensibles', options: CON_NA, answer: 'No aplica' }],
      [{ fieldId: 'x', label: 'Sensibles', options: CON_NA, answer: 'Con mucha sensibilidad' }],
    ])
    expect(r[0].count).toBe(1)
    expect(r[0].average).toBe(5)
  })
})

describe('conteo por pregunta con calificación', () => {
  const preg = (n: string | null): RespuestaCerrada[] =>
    [{ fieldId: 'f1', label: 'Claridad', options: [], answer: n, kind: 'scale' }]

  it('cuenta cuántos eligieron cada número', () => {
    const r = perQuestionSummary([preg('5'), preg('5'), preg('3')])
    expect(r[0].breakdown['5']).toBe(2)
    expect(r[0].breakdown['3']).toBe(1)
    expect(r[0].average).toBe(4.33)
  })

  it('quien dejó la pregunta en blanco no entra al promedio', () => {
    const r = perQuestionSummary([preg('4'), preg(null)])
    expect(r[0].count).toBe(1)
    expect(r[0].average).toBe(4)
  })
})

describe('respuestas guardadas con el formato anterior', () => {
  it('una palabra en una pregunta que HOY es calificación no ensucia la tabla', () => {
    // El formulario cambió de opciones a escala 1-5 (2026-08-07); lo respondido
    // antes no se puede reinterpretar sin inventar una nota.
    const vieja: RespuestaCerrada[] = [
      { fieldId: 'f1', label: 'Claridad', options: [], answer: 'Siempre', kind: 'scale' },
    ]
    const nueva: RespuestaCerrada[] = [
      { fieldId: 'f1', label: 'Claridad', options: [], answer: '4', kind: 'scale' },
    ]
    const r = perQuestionSummary([vieja, nueva])
    expect(Object.keys(r[0].breakdown)).toEqual(['1', '2', '3', '4', '5'])
    expect(r[0].breakdown['4']).toBe(1)
    expect(r[0].count).toBe(1)          // la vieja no puntúa
    expect(r[0].average).toBe(4)
  })
})

describe('cuándo se manda', () => {
  const CIERRE = '2026-09-10T18:00:00.000Z'

  it('por defecto al día siguiente, no en el mismo minuto del cierre', () => {
    expect(surveySendAt(CIERRE)).toBe('2026-09-11T18:00:00.000Z')
  })

  it('el desfase es configurable', () => {
    expect(surveySendAt(CIERRE, 2)).toBe('2026-09-10T20:00:00.000Z')
  })

  it('sin fecha válida no se programa', () => {
    expect(surveySendAt('no es fecha')).toBeNull()
  })
})

describe('isSurveyDue — condición del cron', () => {
  const base = {
    survey_enabled: true,
    survey_send_at: '2026-09-11T18:00:00.000Z',
    feedback_requested_at: null as string | null,
    status: 'finalizado' as string | null,
  }

  it('llegado el momento, sí', () => {
    expect(isSurveyDue(base, new Date('2026-09-11T18:00:00.000Z'))).toBe(true)
  })

  it('antes de tiempo, no', () => {
    expect(isSurveyDue(base, new Date('2026-09-11T00:00:00.000Z'))).toBe(false)
  })

  it('ya enviada, no se reenvía', () => {
    expect(isSurveyDue({ ...base, feedback_requested_at: '2026-09-11T18:05:00Z' }, new Date('2026-10-01'))).toBe(false)
  })

  it('apagada en ese grupo, no', () => {
    expect(isSurveyDue({ ...base, survey_enabled: false }, new Date('2026-10-01'))).toBe(false)
  })

  it('grupo no cerrado, no', () => {
    expect(isSurveyDue({ ...base, status: 'en_curso' }, new Date('2026-10-01'))).toBe(false)
  })

  it('sin programar, no', () => {
    expect(isSurveyDue({ ...base, survey_send_at: null }, new Date('2026-10-01'))).toBe(false)
  })
})
