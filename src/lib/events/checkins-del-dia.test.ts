import { describe, it, expect } from 'vitest'
import { diaCR, checkinsDeLaOcurrencia, diaQueSeEstaViendo, fechaDeLaAsistencia } from './checkins-del-dia'

const ci = (checked_at: string) => ({ checked_at })

describe('diaCR', () => {
  it('una charla de las 7 p.m. cuenta en SU día, no en el siguiente', () => {
    // 19:00 en CR son las 01:00 UTC del día siguiente. Con la fecha UTC, media
    // charla quedaría en un día y media en otro.
    expect(diaCR('2026-09-09T01:00:00Z')).toBe('2026-09-08')
    expect(diaCR('2026-09-08T23:07:00Z')).toBe('2026-09-08')
  })
  it('una fecha inválida no revienta', () => {
    expect(diaCR('cualquier cosa')).toBe('')
  })
})

describe('checkinsDeLaOcurrencia', () => {
  const todos = [ci('2026-09-09T01:00:00Z'), ci('2026-09-16T01:00:00Z')]

  it('en un recurrente deja solo los del día que se ve', () => {
    // El caso real: la Charla Meridiano Martes mostraba 189 y eran de la
    // semana anterior.
    expect(checkinsDeLaOcurrencia(todos, true, '2026-09-15')).toHaveLength(1)
    expect(checkinsDeLaOcurrencia(todos, true, '2026-09-08')).toHaveLength(1)
    expect(checkinsDeLaOcurrencia(todos, true, '2026-09-01')).toHaveLength(0)
  })

  it('un evento NO recurrente no se filtra', () => {
    // Pasa una sola vez y sus check-ins son suyos, incluidos los que se
    // digitaron al día siguiente — pasa seguido con las personas nuevas.
    expect(checkinsDeLaOcurrencia(todos, false, '2026-09-15')).toHaveLength(2)
  })

  it('sin día no se filtra: mejor de más que esconder asistencia', () => {
    expect(checkinsDeLaOcurrencia(todos, true, null)).toHaveLength(2)
  })
})

describe('diaQueSeEstaViendo', () => {
  it('sin parámetro, un recurrente muestra HOY', () => {
    // No la fecha de inicio: la serie arrancó hace meses y quien abre la
    // pantalla está parado en la charla de hoy.
    expect(diaQueSeEstaViendo(null, true, '2026-09-15')).toBe('2026-09-15')
  })
  it('con ?date= manda el parámetro', () => {
    expect(diaQueSeEstaViendo('2026-09-08', true, '2026-09-15')).toBe('2026-09-08')
  })

  it('acepta el ISO COMPLETO, que es lo que manda el calendario', () => {
    // El bug: el calendario y la lista de check-in pasan el start_at entero,
    // no un YYYY-MM-DD. Rechazándolo, abrir la ocurrencia del 8 de setiembre
    // caía en "hoy" y mostraba cero check-ins de 189.
    expect(diaQueSeEstaViendo('2026-09-08T19:00:00.000Z', true, '2026-09-15')).toBe('2026-09-08')
  })

  it('un ISO de las 7 p.m. CR se resuelve a SU día, no al siguiente', () => {
    // 19:00 CR viaja como la 01:00 UTC del día siguiente. Cortar el string con
    // slice(0,10) daría el 9 y volvería a vaciar la pantalla.
    expect(diaQueSeEstaViendo('2026-09-09T01:00:00.000Z', true, '2026-09-15')).toBe('2026-09-08')
  })
  it('un parámetro con basura se ignora', () => {
    expect(diaQueSeEstaViendo('ayer', true, '2026-09-15')).toBe('2026-09-15')
  })
  it('un evento no recurrente no tiene día de ocurrencia', () => {
    expect(diaQueSeEstaViendo('2026-09-08', false, '2026-09-15')).toBeNull()
  })
})

describe('fechaDeLaAsistencia', () => {
  const martes8 = '2026-09-09T01:07:00.000Z'   // 8 set 19:07 CR
  const martes15 = '2026-09-16T07:56:00.000Z'  // 16 set 01:56 CR
  const anclaSerie = '2026-09-09T07:30:00.000Z'

  it('EL BUG: dos semanas de un recurrente no pueden dar la misma fecha', () => {
    // Floriana veía dos veces el 8 de setiembre y ninguna del 15: las dos
    // asistencias se pintaban con el starts_at de la serie.
    const a = fechaDeLaAsistencia({ esRecurrente: true, inicioDelEvento: anclaSerie, marcadoEn: martes8 })
    const b = fechaDeLaAsistencia({ esRecurrente: true, inicioDelEvento: anclaSerie, marcadoEn: martes15 })
    expect(a).not.toBe(b)
    expect(diaCR(a)).toBe('2026-09-08')
    expect(diaCR(b)).toBe('2026-09-16')
  })

  it('un evento de una sola vez conserva SU fecha', () => {
    // Acá el check-in puede haberse digitado al día siguiente y la fecha buena
    // es la del evento, no la del tecleo.
    const r = fechaDeLaAsistencia({
      esRecurrente: false, inicioDelEvento: '2026-08-04T00:00:00.000Z',
      marcadoEn: '2026-08-05T15:00:00.000Z',
    })
    expect(r).toBe('2026-08-04T00:00:00.000Z')
  })

  it('sin fecha de evento cae al check-in y no queda vacío', () => {
    expect(fechaDeLaAsistencia({ esRecurrente: false, inicioDelEvento: null, marcadoEn: martes8 })).toBe(martes8)
  })

  it('is_recurring nulo se trata como no recurrente', () => {
    expect(fechaDeLaAsistencia({ esRecurrente: null, inicioDelEvento: anclaSerie, marcadoEn: martes8 })).toBe(anclaSerie)
  })
})
