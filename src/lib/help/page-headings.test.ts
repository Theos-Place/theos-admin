// AUD-1 · Cada pantalla declara su <h1>.
//
// Sin encabezado principal no hay punto de entrada para un lector de pantalla: la
// persona tiene que tabular desde el principio para saber dónde está. El salto
// por encabezados es la forma normal de orientarse.
//
// El h1 puede venir de un COMPONENTE que la página renderiza (EventHeader,
// MemberHeader, EmployeeHeader…), así que el chequeo sigue los imports locales.
// Sin eso daba 7 falsos positivos de 21.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { execSync } from 'node:child_process'

/** Pantallas exentas, con su razón. */
const EXENTAS: Record<string, string> = {
  'pagos/revision': 'es un redirect() a /finanzas/pagos, no renderiza nada',
}

function resolver(imp: string, desde: string): string | null {
  let base: string
  if (imp.startsWith('@/')) base = 'src/' + imp.slice(2)
  else if (imp.startsWith('.')) base = normalize(join(dirname(desde), imp))
  else return null
  for (const ext of ['.tsx', '.ts', '/index.tsx']) {
    if (existsSync(base + ext)) return base + ext
  }
  return null
}

/** ¿este archivo, o algo que renderiza, declara un <h1>? */
function tieneH1(archivo: string, visto = new Set<string>(), prof = 0): boolean {
  if (visto.has(archivo) || prof > 2) return false
  visto.add(archivo)
  let s: string
  try { s = readFileSync(archivo, 'utf8') } catch { return false }
  if (s.includes('<h1')) return true
  for (const m of s.matchAll(/import\s+(?:\{[^}]*\}|\w+)\s+from\s+'([^']+)'/g)) {
    const f = resolver(m[1], archivo)
    if (f && (f.includes('/components/') || f.includes('_components/')) && tieneH1(f, visto, prof + 1)) {
      return true
    }
  }
  return false
}

describe('encabezado principal por pantalla', () => {
  const paginas = execSync("find 'src/app/(admin)' -name page.tsx", { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)

  it('toda pantalla de administración declara un <h1> (propio o de un componente)', () => {
    const sinH1 = paginas
      .filter(p => !tieneH1(p))
      .map(p => p.replace('src/app/(admin)/', '').replace('/page.tsx', ''))
      .filter(n => !(n in EXENTAS))
    expect(sinH1).toEqual([])
  })

  it('las exentas siguen siendo las mismas, y por la misma razón', () => {
    // Si una exenta deja de existir o deja de ser un redirect, hay que revisarla.
    for (const nombre of Object.keys(EXENTAS)) {
      const p = `src/app/(admin)/${nombre}/page.tsx`
      expect(existsSync(p), `${nombre} ya no existe: quitala de EXENTAS`).toBe(true)
      expect(readFileSync(p, 'utf8')).toContain('redirect(')
    }
  })
})
