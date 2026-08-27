/**
 * La hora de un evento se guarda en hora de Costa Rica, no en la del servidor.
 *
 * Fuerza TZ=UTC por dentro, que es la zona en la que corre Vercel y la única en
 * la que el defecto se manifestaba: `new Date("2026-08-27T10:00")` sin zona se
 * interpreta como hora local del SERVIDOR. Al fijar la zona acá, el test falla
 * en cualquier máquina si alguien vuelve a quitar el offset — no depende de en
 * qué zona esté quien lo corre. Lo que dejó pasar el bug no fue la zona de la
 * máquina: fue que no existía ningún test sobre esto.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { formToWriteInput } from './form-mapper'

const tzOriginal = process.env.TZ

describe('hora de evento con el servidor en UTC', () => {
  beforeAll(() => { process.env.TZ = 'UTC' })
  afterAll(() => { process.env.TZ = tzOriginal })

  const base = { title: 'X', start_date: '2026-08-27', start_time: '10:00' }

  it('guarda las 10:00 de Costa Rica, no las 10:00 del servidor', () => {
    const out = formToWriteInput({ ...base } as Record<string, unknown>)
    // 10:00 en CR (UTC-6) son las 16:00 UTC.
    expect(out.starts_at).toBe('2026-08-27T16:00:00.000Z')
    expect(out.starts_at).not.toBe('2026-08-27T10:00:00.000Z')
  })

  it('sin hora asume medianoche de Costa Rica', () => {
    const out = formToWriteInput({ title: 'X', start_date: '2026-08-27' } as Record<string, unknown>)
    expect(out.starts_at).toBe('2026-08-27T06:00:00.000Z')
  })

  it('acepta HH:mm:ss sin romperse', () => {
    const out = formToWriteInput({ ...base, start_time: '10:00:00' } as Record<string, unknown>)
    expect(out.starts_at).toBe('2026-08-27T16:00:00.000Z')
  })
})
