import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

/**
 * 2026-10-16 · Cuatro crons agendados en vercel.json exportaban solo POST.
 * Vercel los invoca con GET, así que contestaban 405 y NUNCA corrieron en
 * producción desde que se crearon (setiembre): study-requests-expire,
 * study-requests-wake, cuentas-sin-ficha y evaluation-digest. Nadie se enteró
 * porque tampoco llegaba el ping a Healthchecks — lo único que lo habría
 * delatado.
 *
 * Esto revisa CADA cron agendado: que su ruta exista, que responda a GET y que
 * avise a un monitor documentado en .env.example.
 */
const crons = (JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons: Array<{ path: string; schedule: string }> }).crons
const envEjemplo = readFileSync('.env.example', 'utf8')

describe('cada cron agendado en vercel.json', () => {
  for (const c of crons) {
    const archivo = `src/app${c.path}/route.ts`
    describe(c.path, () => {
      it('tiene su ruta', () => {
        expect(existsSync(archivo)).toBe(true)
      })

      const src = existsSync(archivo) ? readFileSync(archivo, 'utf8') : ''

      it('responde a GET, que es como lo llama Vercel', () => {
        expect(src).toMatch(/export (async function GET|const GET\b|\{[^}]*\bGET\b[^}]*\})/)
      })

      it('avisa a un monitor de Healthchecks documentado', () => {
        const claves = [...src.matchAll(/pingHealthcheck\('(HEALTHCHECK_URL_[A-Z_]+)'\)/g)].map(m => m[1])
        expect(claves.length, 'sin ping, si deja de correr nadie se entera').toBeGreaterThan(0)
        for (const k of claves) expect(envEjemplo).toMatch(new RegExp(`^${k}=`, 'm'))
      })
    })
  }
})
