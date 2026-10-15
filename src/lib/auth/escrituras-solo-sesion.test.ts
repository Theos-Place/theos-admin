import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/**
 * AGENTS.md, «Seguridad en rutas API»: las escrituras exigen roles explícitos,
 * «salvo decisión documentada en el propio handler». QA-3/N1 (2026-10-15)
 * encontró 31 escrituras que solo pedían sesión SIN decir por qué. Todas se
 * protegían de otra forma —por pertenencia, por puesto, por grupo— pero eso
 * vivía en la cabeza de quien las escribió.
 *
 * Desde acá, una escritura que solo pide sesión tiene que decir por qué basta
 * (`// Solo sesión: …`, o una decisión documentada con otras palabras).
 */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
const GUARD_FUERTE = /requireRoles\((?!\))|requireModuleView\(|requireAccesoAReporte\(|requireEventAccess\(|requireFormEdit\(|requireEventManage\w*\(|secretsMatch\(|CRON_SECRET/
const DOCUMENTADA = /Solo sesión:|decisi[oó]n|a prop[oó]sito|basta (con )?la sesi[oó]n|solo (exige|pide) sesi[oó]n|cualquier miembro|todo miembro|la propia persona|el propio|es de quien|autoservicio/i
const PUBLICOS = [/^src\/app\/api\/auth\//, /^src\/app\/api\/public\//, /^src\/app\/api\/email\//]

function escriturasSinDecision(): string[] {
  const rutas = execSync('git ls-files "src/app/api/**/route.ts"', { encoding: 'utf8' }).split('\n').filter(Boolean)
  const out: string[] = []
  for (const f of rutas) {
    if (PUBLICOS.some(p => p.test(f))) continue
    const src = readFileSync(f, 'utf8')
    const metodos = [...src.matchAll(/export (?:async )?function (POST|PUT|PATCH|DELETE)\b/g)]
    for (const m of metodos) {
      const i = m.index!
      const fin = src.indexOf('\nexport ', i + 10)
      const cuerpo = src.slice(i, fin > 0 ? fin : src.length)
      // helpers del mismo archivo que el handler llama (p. ej. puertaDeEntrada)
      const helpers = [...cuerpo.matchAll(/await (\w+)\(/g)].map(x => x[1])
      const deHelpers = helpers.map(h => {
        const j = src.indexOf(`function ${h}(`)
        return j >= 0 ? src.slice(Math.max(0, j - 900), src.indexOf('\n}', j) + 2) : ''
      }).join('\n')
      const codigo = sinComentarios(cuerpo + deHelpers)
      const soloSesion = /requireRoles\(\)|getAuthContext\(\)/.test(codigo) && !GUARD_FUERTE.test(codigo)
      if (!soloSesion) continue
      // la decisión puede estar en el handler, en el helper o en el bloque de arriba
      const contexto = src.slice(Math.max(0, i - 900), fin > 0 ? fin : src.length) + deHelpers
      if (!DOCUMENTADA.test(contexto)) out.push(`${m[1]} ${f}`)
    }
  }
  return out
}

describe('escrituras que solo piden sesión', () => {
  it('todas dicen por qué basta la sesión', () => {
    expect(escriturasSinDecision()).toEqual([])
  })
})
