import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 2026-10-19 · `audit_log.actor_id` apunta a auth.users, no a members. Cinco
 * rutas nuevas le pasaban `auth.ctx.memberId` con un insert directo que no
 * miraba el error: la auditoría fallaba en silencio y la acción quedaba sin
 * rastro. El camino es `logAudit({ actorUserId: auth.ctx.userId, … })`.
 */
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return archivos(p)
    return /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : []
  })
}

describe('la auditoría lleva el usuario de acceso', () => {
  it('nadie le pasa el id de la FICHA como actor', () => {
    const malos = archivos('src').filter(p => /actor_id:\s*auth\.ctx\.memberId|actorUserId:\s*auth\.ctx\.memberId/.test(readFileSync(p, 'utf8')))
    expect(malos).toEqual([])
  })
})
