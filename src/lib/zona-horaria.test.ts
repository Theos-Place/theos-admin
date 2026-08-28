/**
 * Candado: la suite corre en UTC.
 *
 * Si alguien quita `env: { TZ: 'UTC' }` de vitest.config.ts, este test falla en
 * cualquier máquina que no esté en UTC — y con él vuelve el agujero que dejó
 * pasar el bug del 2026-08-27: los tests pasaban en Costa Rica y fallaban en CI.
 *
 * No es un test de una función: es un test de que el entorno de pruebas se
 * parece a producción (Vercel corre en UTC).
 */
import { describe, it, expect } from 'vitest'

describe('la suite corre en UTC', () => {
  it('el proceso está en UTC', () => {
    expect(process.env.TZ).toBe('UTC')
  })

  it('y las fechas de verdad se comportan como UTC', () => {
    // No alcanza con leer la variable: hay que confirmar que el runtime la tomó.
    expect(new Date('2026-08-27T00:00:00Z').getHours()).toBe(0)
    expect(new Date(Date.UTC(2026, 7, 27)).getDate()).toBe(27)
  })

  it('una fecha sin zona se lee como UTC, que es lo que hace Vercel', () => {
    // El comportamiento exacto que corrió las horas de los eventos seis horas.
    // Dejarlo escrito acá explica por qué los tests de fechas llevan offset.
    expect(new Date('2026-08-27T10:00').toISOString()).toBe('2026-08-27T10:00:00.000Z')
  })
})
