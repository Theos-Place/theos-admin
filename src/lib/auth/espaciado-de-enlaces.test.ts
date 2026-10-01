import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Entre un enlace de contraseña y el siguiente tienen que pasar 90 segundos.
 *
 * POR QUÉ: cada enlace nuevo ANULA al anterior. Comprobado contra Supabase el
 * 2026-10-01 — de tres tokens generados seguidos, los dos primeros responden
 * «Email link is invalid or has expired» y solo sirve el último. Así que quien
 * no ve llegar el correo y vuelve a pedirlo queda PEOR que antes: el que ya
 * tenía en la bandeja dejó de servir.
 *
 * Dos casos reales: Nestor Gamboa (3 envíos en 2 minutos) y Carolina Bon
 * Barret (3 en 93 segundos). Los dos cabían dentro del límite viejo de 3 cada
 * 15 minutos, que por eso no los protegió: ese limita el ABUSO, no el ritmo.
 */
const SRC = readFileSync('src/app/api/auth/password-link/route.ts', 'utf8')

describe('el endpoint espacia los enlaces', () => {
  it('tiene una regla de espaciado aparte del límite de abuso', () => {
    expect(SRC).toContain('pwlink:espaciado:${identifier}')
    expect(SRC).toMatch(/pwlink:espaciado:\$\{identifier\}`, 1, 90_000/)
  })

  it('y NO reemplaza al límite de 3 en 15 minutos', () => {
    // Son dos cosas: una cuida a la persona de sí misma, la otra cuida el
    // buzón de alguien más.
    expect(SRC).toMatch(/pwlink:id:\$\{identifier\}`, 3, 15 \* 60_000/)
  })

  it('la clave es lo que la persona ESCRIBIÓ, no el estado de la cuenta', () => {
    // Si dependiera de si la cuenta existe, la respuesta diría si existe.
    expect(SRC).not.toMatch(/pwlink:espaciado:\$\{(email|member|auth)/)
  })

  it('el mensaje dice qué hacer: abrir el más reciente', () => {
    expect(SRC).toContain('Abrí el correo MÁS RECIENTE')
    expect(SRC).toContain('deja sin efecto a los anteriores')
    // Y no deja a nadie encerrado: se puede volver a pedir.
    expect(SRC).toContain('volvé a pedirlo')
  })
})

describe('la ventana de 90 segundos, de verdad', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('el segundo pedido inmediato se frena, y al minuto y medio pasa', () => {
    const clave = `pwlink:espaciado:prueba-${Math.random()}`
    expect(rateLimit(clave, 1, 90_000)).toBe(true)   // el primero sale
    expect(rateLimit(clave, 1, 90_000)).toBe(false)  // el de 2 segundos después, no
    vi.advanceTimersByTime(89_000)
    expect(rateLimit(clave, 1, 90_000)).toBe(false)  // casi
    vi.advanceTimersByTime(2_000)
    expect(rateLimit(clave, 1, 90_000)).toBe(true)   // ya
  })

  it('dos personas distintas no se estorban', () => {
    const a = `pwlink:espaciado:ana-${Math.random()}`
    const b = `pwlink:espaciado:beto-${Math.random()}`
    expect(rateLimit(a, 1, 90_000)).toBe(true)
    expect(rateLimit(b, 1, 90_000)).toBe(true)
  })
})
