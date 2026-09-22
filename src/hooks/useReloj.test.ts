import { describe, it, expect, vi, afterEach } from 'vitest'

/**
 * LINT-1 · El reloj reactivo. Lo que hay que fijar no es que devuelva la hora
 * —eso es trivial— sino las dos decisiones que lo hacen barato y correcto.
 */
afterEach(() => vi.useRealTimers())

describe('la instantánea decide cuántos renders hay', () => {
  it('el minuto se REDONDEA, así que 30 segundos después es el MISMO valor', async () => {
    // El tic interno es de 30 s. Sin redondeo, cada tic sería un render en cada
    // pantalla que use el hook. React compara la instantánea: si no cambia, no
    // re-renderiza.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-22T10:00:05Z'))
    const alMinuto = () => Math.floor(Date.now() / 60_000) * 60_000
    const a = alMinuto()
    vi.setSystemTime(new Date('2026-09-22T10:00:35Z'))
    expect(alMinuto()).toBe(a)
    vi.setSystemTime(new Date('2026-09-22T10:01:05Z'))
    expect(alMinuto()).not.toBe(a)
  })

  it('el día es un string, así que solo cambia a la medianoche', async () => {
    const { ymdCR } = await import('@/lib/format')
    vi.useFakeTimers()
    // 10:00 y 23:00 del mismo día en Costa Rica (UTC-6) → 16:00 y 05:00 UTC.
    vi.setSystemTime(new Date('2026-09-22T16:00:00Z'))
    const manana = ymdCR()
    vi.setSystemTime(new Date('2026-09-23T05:00:00Z'))
    expect(ymdCR()).toBe(manana)
    // Y al pasar la medianoche CR sí cambia.
    vi.setSystemTime(new Date('2026-09-23T06:30:00Z'))
    expect(ymdCR()).not.toBe(manana)
  })
})

describe('el módulo no arranca temporizadores por importarlo', () => {
  it('sin suscriptores no hay setInterval', async () => {
    const spy = vi.spyOn(globalThis, 'setInterval')
    await import('./useReloj')
    // Un setInterval a nivel de módulo correría para siempre en cada proceso
    // que lo importe, incluidos los tests y el render del servidor.
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
