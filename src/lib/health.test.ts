// Guard de configuración: cada cron de vercel.json debe tener su health check,
// y cada health check del código debe estar listado en .env.example.
//
// Modo de fallo que esto evita: "el cron falla y nadie se entera". Un cron nuevo
// sin ping no avisa nunca, y una variable que no está en .env.example no se
// configura porque nadie sabe que existe.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons: Array<{ path: string }> }
const envExample = readFileSync('.env.example', 'utf8')
const health = readFileSync('src/lib/health.ts', 'utf8')

/** Nombres de variable que el helper acepta (la unión de tipos). */
const declaradas = [...health.matchAll(/'(HEALTHCHECK_URL_[A-Z_]+)'/g)].map(m => m[1])

describe('health checks de los crons', () => {
  it('cada cron de vercel.json pingea un health check', () => {
    const sinPing: string[] = []
    for (const { path } of vercel.crons) {
      const archivo = `src/app${path}/route.ts`
      const src = readFileSync(archivo, 'utf8')
      if (!src.includes('pingHealthcheck(')) sinPing.push(path)
    }
    expect(sinPing, `crons sin health check: ${sinPing.join(', ')}`).toEqual([])
  })

  it('todas las variables que el código acepta están en .env.example', () => {
    expect(declaradas.length).toBeGreaterThan(5)
    const faltantes = declaradas.filter(v => !envExample.includes(v))
    expect(faltantes, `faltan en .env.example: ${faltantes.join(', ')}`).toEqual([])
  })

  it('hay tantos health checks como crons', () => {
    // Si no coinciden, o sobra una variable muerta o falta un cron por cubrir.
    expect(declaradas.length).toBe(vercel.crons.length)
  })
})
