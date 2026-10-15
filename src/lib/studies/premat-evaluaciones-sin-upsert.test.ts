import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// 2026-10-15 · El cierre de prematrimonial daba 500 (Danilo, prod): el upsert
// de las evaluaciones pedía ON CONFLICT sobre índices únicos PARCIALES, que
// PostgreSQL no puede usar sin su WHERE y que PostgREST no sabe mandar
// (42P10). Pasaba con solicitud y sin ella: ningún cierre con evaluación
// funcionaba desde PRE-8 (13-oct).
describe('savePrematEvaluations', () => {
  const src = readFileSync('src/lib/supabase/queries/prematrimonial.ts', 'utf8')
  const fn = src.slice(src.indexOf('export async function savePrematEvaluations'), src.indexOf('export async function getPrematEvaluations'))

  it('no usa upsert ni onConflict', () => {
    expect(fn).not.toMatch(/\.upsert\(|onConflict/)
  })
  it('busca la evaluación previa y la actualiza, o la crea', () => {
    expect(fn).toMatch(/\.update\(fila\)\.eq\('id', previa\.id\)/)
    expect(fn).toMatch(/\.insert\(fila\)/)
  })
})
