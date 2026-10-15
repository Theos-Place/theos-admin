import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// 2026-10-15 · La suscripción al calendario público: lo que se rompe sin ruido.
const leer = (p: string) => readFileSync(p, 'utf8')

describe('el feed de suscripción', () => {
  const ruta = leer('src/app/api/public/events.ics/route.ts')
  it('usa los MISMOS eventos que la cartelera pública', () => {
    expect(ruta).toMatch(/eventosPublicos\(\)/)
    expect(leer('src/app/api/public/events/route.ts')).toMatch(/eventosPublicos\(\)/)
  })
  it('expande con el mismo motor que dibuja /calendario', () => {
    expect(ruta).toMatch(/eventsInRange\(/)
  })
  it('responde text/calendar', () => {
    expect(ruta).toMatch(/'Content-Type': 'text\/calendar; charset=utf-8'/)
  })
  it('es una whitelist: nunca hace spread del evento', () => {
    expect(ruta).not.toMatch(/\.\.\.e\b/)
  })
})

describe('la cartelera pública manda zona y excepciones', () => {
  const ruta = leer('src/app/api/public/events/route.ts')
  it('sin zona, una serie de Madrid se expandía en hora de Costa Rica', () => {
    expect(ruta).toMatch(/timezone: e\.timezone/)
  })
  it('sin excepciones, salían las fechas canceladas de una serie', () => {
    expect(ruta).toMatch(/exceptions: \(e\.exceptions/)
  })
})

describe('el botón', () => {
  it('ya no se baja un .ics estático desde Eventos', () => {
    const eventos = leer('src/app/(admin)/eventos/page.tsx')
    expect(eventos).not.toMatch(/downloadAllEventsICS/)
    expect(eventos).toMatch(/<SuscribirseAlCalendario/)
  })
  it('el calendario público lo ofrece, también embebido', () => {
    const pub = leer('src/app/(public)/calendario/page.tsx')
    expect((pub.match(/<SuscribirseAlCalendario/g) ?? []).length).toBe(2)
  })
})

describe('las series que se pisan no se guardan', () => {
  it('ni al crear ni al editar', () => {
    expect(leer('src/app/api/events/route.ts')).toMatch(/solapamientoDeLaSerie\(entrada\)/)
    expect(leer('src/app/api/events/[id]/route.ts')).toMatch(/solapamientoDeLaSerie\(quedaria\)/)
  })
})
