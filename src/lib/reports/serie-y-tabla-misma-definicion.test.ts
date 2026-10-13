import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * REP-16 · La serie del gráfico y la tabla tienen que definir «año» igual.
 *
 * Son dos funciones SQL distintas y ningún test de TypeScript puede
 * compararlas: el descuadre de 1.897 contra 1.823 vivía entero en la base.
 * Esto vigila la definición en el fuente de la migración, que es donde está.
 *
 * Lo que se protege son los DOS EXTREMOS. La serie vieja usaba solo
 * `starts_at` y caía a `created_at`, que para los grupos del import
 * histórico es la fecha del import: grupos cerrados en 2015 aparecían como
 * estudiantes de 2026.
 */
const MIGRACIONES = join(process.cwd(), 'supabase/migrations')

/** La última migración que redefine esta función: la que está viva. */
function ultimaDefinicionDe(funcion: string): string {
  const archivos = readdirSync(MIGRACIONES)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .filter(f => readFileSync(join(MIGRACIONES, f), 'utf8')
      .includes(`function public.${funcion}`))
  expect(archivos.length, `ninguna migración define ${funcion}`).toBeGreaterThan(0)
  return readFileSync(join(MIGRACIONES, archivos[archivos.length - 1]), 'utf8')
}

describe('REP-16 · la serie y la tabla cuentan el mismo año', () => {
  const serie = ultimaDefinicionDe('report_estudios_series')

  it('el inicio sale del mismo coalesce que usa la tabla', () => {
    expect(serie).toMatch(/coalesce\(g\.starts_at,\s*g\.created_at\)/)
  })

  it('el fin también, y NO se queda solo con el inicio', () => {
    // El bug: la serie solo miraba el arranque, así que un grupo que cruza
    // de año aparecía en uno y no en los dos.
    expect(serie).toMatch(/coalesce\(g\.closed_at,\s*g\.ends_at,\s*g\.starts_at,\s*g\.created_at\)/)
  })

  it('expande el grupo a TODOS los años que abarca', () => {
    expect(serie).toMatch(/generate_series\(/)
  })

  it('excluye los mismos estados que la tabla', () => {
    for (const estado of ['cancelada', 'transferred', 'dropped']) {
      expect(serie, estado).toContain(`'${estado}'`)
    }
  })

  it('sigue excluyendo a la gente de prueba', () => {
    expect(serie).toMatch(/\[prueba\]/)
  })

  it('queda cerrada: PostgREST publica todo public en /rpc', () => {
    // La regla de AGENTS.md (SEC-3): una función nueva en public nace con
    // EXECUTE para PUBLIC y la llave pública va en el bundle del navegador.
    expect(serie).toMatch(/revoke execute on function public\.report_estudios_series/)
    expect(serie).toMatch(/grant\s+execute on function public\.report_estudios_series\(\) to service_role/)
  })
})
