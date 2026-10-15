import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { inicioDeHoyCR } from './hoy-cr'

// QA-3/M2 (2026-10-15) · La lista de eventos traía el historial entero de
// check-ins (32.476, 3,4 MB para 500 eventos) y sus tres consumidores solo
// usan los de HOY. El detalle de un evento sigue trayendo todos.
describe('lista de eventos', () => {
  const src = readFileSync('src/lib/supabase/queries/events.ts', 'utf8')

  it('acota los check-ins embebidos a hoy, solo en la lista', () => {
    expect(src).toMatch(/if \(!filters\.light\) query = query\.gte\('checkins\.checked_in_at', inicioDeHoyCR\(\)\)/)
  })
  it('el detalle (getEventById) no se acota', () => {
    const detalle = src.slice(src.indexOf('export async function getEventById'), src.indexOf('export async function getEventById') + 400)
    expect(detalle).not.toMatch(/checked_in_at/)
  })
  it('hoy empieza a las 00:00 de Costa Rica (06:00 UTC)', () => {
    expect(inicioDeHoyCR(new Date('2026-10-15T23:30:00-06:00'))).toBe('2026-10-15T06:00:00.000Z')
    // Pasada la medianoche en UTC pero todavía el 15 en Costa Rica
    expect(inicioDeHoyCR(new Date('2026-10-16T02:00:00Z'))).toBe('2026-10-15T06:00:00.000Z')
  })
})
