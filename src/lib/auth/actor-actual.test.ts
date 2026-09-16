import { describe, it, expect } from 'vitest'
import { actorActual, recordarActor, HEADER_ACTOR } from './actor-actual'

const USUARIO = '78982f04-9a5c-4645-bb63-517cf1f24039'

describe('actorActual', () => {
  it('sin sesión no hay actor, y eso no es un error', () => {
    // Los crons y los webhooks escriben sin nadie detrás: la auditoría queda
    // sin autor, igual que antes de este cambio.
    expect(actorActual()).toBeNull()
  })

  it('después de recordarlo, queda disponible sin pasarlo por parámetro', async () => {
    // Esta es la razón de ser del módulo: createAdminClient() se llama en 666
    // lugares y ninguno le pasa el actor.
    recordarActor(USUARIO)
    expect(actorActual()).toBe(USUARIO)
    // Y sobrevive a un await, que es lo que hace cualquier handler.
    await Promise.resolve()
    expect(actorActual()).toBe(USUARIO)
  })

  it('el nombre del header es el que lee el trigger', () => {
    // Si esto cambia hay que cambiar también la migración
    // 20260916190000_audit_log_guarda_quien.sql, que lo lee literal.
    expect(HEADER_ACTOR).toBe('x-actor-user-id')
  })
})

describe('contrato: el cliente admin manda el actor', () => {
  it('createAdminClient lo adjunta como header', async () => {
    // POR QUÉ ESTE TEST. Si alguien simplifica createAdminClient y se lleva el
    // header por delante, la auditoría vuelve a quedarse sin autor y nada falla
    // a la vista: los 369.773 registros seguirían escribiéndose, solo que
    // anónimos otra vez.
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/lib/supabase/admin.ts', 'utf8')
    expect(src).toMatch(/actorActual\(\)/)
    expect(src).toMatch(/HEADER_ACTOR/)
  })

  it('el guard lo recuerda al resolver la sesión', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/lib/auth/guard.ts', 'utf8')
    expect(src).toMatch(/recordarActor\(user\.id\)/)
  })
})
