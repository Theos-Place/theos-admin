import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// 2026-10-15 · El QR registraba SIEMPRE como participante: a un servidor había
// que borrarlo y registrarlo a mano. Ahora la puerta elige «Escanear como».
const pantalla = readFileSync('src/app/(admin)/eventos/[id]/checkin/page.tsx', 'utf8')
const queries = readFileSync('src/lib/supabase/queries/events.ts', 'utf8')

describe('QR · escanear como servidor', () => {
  it('el QR manda la calidad elegida, no una fija', () => {
    expect(pantalla).toMatch(/persistCheckin\(\{ id: memberId, name \}, scanComo, 'qr'\)/)
    expect(pantalla).not.toMatch(/persistCheckin\(\{ id: memberId, name \}, 'participant', 'qr'\)/)
  })
  it('hay un selector Participante / Servidor junto a la cámara', () => {
    expect(pantalla).toMatch(/aria-label="Escanear como"/)
    expect(pantalla).toMatch(/\['server', 'Servidor'\]/)
  })
  it('el servidor devuelve con qué calidad QUEDÓ, y la pantalla lo usa', () => {
    expect(queries).toMatch(/\.select\('id, checked_in_as, sin_inscripcion'\)/)
    expect(pantalla).toMatch(/ultimaCalidad\.current = data\?\.checked_in_as/)
    expect(pantalla).toMatch(/no es servidor del comité organizador/)
  })
  it('la revalidación del servidor sigue: quien no califica entra como asistente', () => {
    expect(queries).toMatch(/if \(calidad === 'servidor' && !\(await calificaComoServidor\(/)
  })
})
