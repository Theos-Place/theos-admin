/**
 * Ida y vuelta de la hora de un evento: guardar → abrir para editar → guardar
 * otra vez NO debe mover el evento.
 *
 * Es el test que faltaba. El arreglo de zona en combineDateTime (guardar
 * interpretando los inputs como hora CR) dejó descalzada la pantalla de editar,
 * que mostraba la hora cruda en UTC. Cada edición corría el evento 6 horas, y
 * se acumulaba: dos ediciones, 12 horas. Con TZ=UTC, que es Vercel.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { formToWriteInput } from './form-mapper'
import { crFormParts } from '@/lib/format'

const tzOriginal = process.env.TZ

describe('ida y vuelta de la hora de un evento (servidor en UTC)', () => {
  beforeAll(() => { process.env.TZ = 'UTC' })
  afterAll(() => { process.env.TZ = tzOriginal })

  it('abrir y volver a guardar deja el evento en el mismo instante', () => {
    const guardado = formToWriteInput({
      title: 'X', start_date: '2026-08-27', start_time: '22:00',
      end_date: '2026-08-27', end_time: '23:45',
    } as Record<string, unknown>)

    // Lo que la pantalla de editar pone en los inputs.
    const inicio = crFormParts(guardado.starts_at)
    const fin = crFormParts(guardado.ends_at)
    expect(inicio).toEqual({ date: '2026-08-27', time: '22:00' })
    expect(fin).toEqual({ date: '2026-08-27', time: '23:45' })

    // Guardar de nuevo sin tocar nada.
    const reguardado = formToWriteInput({
      title: 'X', start_date: inicio.date, start_time: inicio.time,
      end_date: fin.date, end_time: fin.time,
    } as Record<string, unknown>)
    expect(reguardado.starts_at).toBe(guardado.starts_at)
    expect(reguardado.ends_at).toBe(guardado.ends_at)
  })

  it('tres ediciones seguidas tampoco lo mueven', () => {
    let actual = formToWriteInput({
      title: 'X', start_date: '2026-12-31', start_time: '18:30',
    } as Record<string, unknown>).starts_at
    const original = actual
    for (let i = 0; i < 3; i++) {
      const p = crFormParts(actual)
      actual = formToWriteInput({
        title: 'X', start_date: p.date, start_time: p.time,
      } as Record<string, unknown>).starts_at
    }
    expect(actual).toBe(original)
  })
})
