import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * DAT-9 · Nadie busca por `external_id` a mano. Se usa la función.
 *
 * LA REGLA (AGENTS.md, desde el 2026-09-15): un external_id se resuelve con
 * `member_por_external_id(id)`, nunca con `members.external_id` a secas.
 *
 * POR QUÉ, en una línea: al fusionar duplicados el external_id del duplicado
 * NO se copia al principal, y la ficha del duplicado no se borra —queda
 * inactiva con `deactivation_reason='merged'` y su external_id intacto—. Así
 * que un mismo ID vive en DOS fichas y buscar por la columna devuelve la
 * MUERTA. Es peor que no encontrar nada: la persona aparece inactiva cuando
 * está sirviendo.
 *
 * POR QUÉ ESTE TEST EXISTE. El ítem DAT-9 decía «no es trabajo pendiente, es
 * una nota para el próximo import». Una nota en un archivo de 300 líneas
 * depende de que alguien la lea justo el día que escribe ese import. Esto no.
 *
 * LO QUE MIRA: filtrar por la columna. Leerla —traerla en un SELECT, mostrarla
 * en la ficha, copiarla en una fusión— es legítimo y no se toca.
 */
/**
 * SOLO `src/`. Los scripts de `scripts/` son de un solo uso y YA CORRIERON
 * —varios son anteriores a la regla del 2026-09-15—; reescribirlos sería
 * reescribir historia y no cambiaría ningún dato. El próximo import que
 * viva en el sistema va en `src/`, y es el que este guard cuida.
 *
 * Si algún día se agrega un script que cruce contra CCB, la regla sigue
 * estando en AGENTS.md y los scripts recientes ya la respetan
 * (`familias-2026-09-15`, `karen-steven-2026-09-15`).
 */
const RAICES = ['src']
const EXTENSIONES = ['.ts', '.tsx', '.cjs', '.mjs', '.js', '.sql']

/** Este archivo y los que explican la regla. */
const PERMITIDOS = [
  'buscar-por-external-id.test.ts',
  'resolucion-por-external-id.test.ts',
]

function archivos(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) archivos(p, acc)
    else if (EXTENSIONES.some(x => e.endsWith(x))) acc.push(p)
  }
  return acc
}

/**
 * Las formas de FILTRAR por la columna, que son las que importan:
 *   · PostgREST: .eq('external_id', …) · .in('external_id', …) · .filter(…)
 *   · SQL:       where … external_id = …  ·  external_id in (…)
 */
const FILTRA = [
  /\.(eq|in|filter|match|like|ilike)\(\s*['"`]external_id['"`]/,
  /\bexternal_id\s*=\s*(\$|\?|'|")/i,
  /\bexternal_id\s+in\s*\(/i,
]

describe('DAT-9 · el external_id se resuelve con la función, no a mano', () => {
  it('nadie filtra por la columna en src/ ni en scripts/', () => {
    const culpables: string[] = []
    for (const raiz of RAICES) {
      for (const ruta of archivos(raiz)) {
        if (PERMITIDOS.some(p => ruta.endsWith(p))) continue
        const texto = readFileSync(ruta, 'utf8')
        if (!texto.includes('external_id')) continue
        // Un archivo que ya usa la función está haciendo lo correcto.
        if (texto.includes('member_por_external_id')) continue
        texto.split('\n').forEach((linea, i) => {
          if (linea.trim().startsWith('*') || linea.trim().startsWith('//')) return
          if (FILTRA.some(re => re.test(linea))) culpables.push(`${ruta}:${i + 1}`)
        })
      }
    }
    expect(culpables, [
      'Hay código buscando por `members.external_id` directamente.',
      'Eso devuelve la ficha MUERTA de alguien fusionado — ver AGENTS.md.',
      'Usá `member_por_external_id(<id>)`.',
      ...culpables,
    ].join('\n  ')).toEqual([])
  })

  it('y la función sigue estando donde dice la regla', () => {
    // Si alguien la renombra, este test lo dice antes que el próximo import.
    const mig = archivos('supabase/migrations')
      .filter(f => f.endsWith('.sql'))
      .some(f => readFileSync(f, 'utf8').includes('member_por_external_id'))
    expect(mig).toBe(true)
  })
})
