import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Guardia de contrato, al estilo de merge-members-coverage.test.ts: no hay BD en
// los tests, así que se verifica el TEXTO de la migración. Lo que protege es
// una regla que ya se rompió una vez en producción.
const SQL = readFileSync('supabase/migrations/20260915030000_member_por_external_id.sql', 'utf8')

describe('member_por_external_id · contrato', () => {
  it('busca en las DOS columnas', () => {
    // Si solo mirara external_id, una persona fusionada sería invisible: el
    // merge deja el id del duplicado en external_id_fusionados y no se lo copia
    // al principal.
    expect(SQL).toMatch(/m\.external_id\s*=\s*p_ext/)
    expect(SQL).toMatch(/m\.external_id_fusionados\s*@>\s*array\[p_ext\]/)
  })

  it('prefiere la ficha VIVA antes que el tipo de coincidencia', () => {
    // Un mismo id vive en dos fichas a la vez: como external_id de la muerta y
    // dentro del arreglo de la viva. Si el orden empezara por el tipo de
    // coincidencia, ganaría la muerta — que es el bug que esto evita.
    const orden = SQL.slice(SQL.indexOf('order by'))
    const viva = orden.indexOf('m.is_active desc')
    const tipo = orden.indexOf('(m.external_id = p_ext) desc')
    expect(viva).toBeGreaterThanOrEqual(0)
    expect(tipo).toBeGreaterThan(viva)
  })

  it('desempata de forma estable', () => {
    // Sin un último criterio determinista, dos corridas pueden devolver fichas
    // distintas para el mismo id.
    expect(SQL.slice(SQL.indexOf('order by'))).toMatch(/m\.created_at/)
  })

  it('el arreglo tiene índice: sin él cada búsqueda es un seq scan', () => {
    expect(SQL).toMatch(/create index[\s\S]*using gin \(external_id_fusionados\)/i)
  })
})
