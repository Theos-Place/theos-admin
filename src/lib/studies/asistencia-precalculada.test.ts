import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// QA-3/M3 (2026-10-15) · Retención leía 176.731 check-ins en cada apertura
// (0,5–2,9 s). Ahora lee una vista materializada refrescada cada noche. En el
// ensayo contra prod las 17.945 filas salieron idénticas y bajó a ~0,1 s.
const sql = readFileSync('supabase/migrations/20261015220000_qa3_asistencia_por_grupo_precalculada.sql', 'utf8')

describe('asistencia por grupo precalculada', () => {
  it('la vista vive en private: PostgREST no la publica', () => {
    expect(sql).toMatch(/create materialized view if not exists private\.asistencia_por_grupo/)
    expect(sql).toMatch(/revoke all on private\.asistencia_por_grupo from public, anon, authenticated/)
  })
  it('la función conserva su firma y lee de la vista', () => {
    expect(sql).toMatch(/returns table\(person_id uuid, yr integer, grp text, visits integer, max_age integer\)/)
    expect(sql).toMatch(/from private\.asistencia_por_grupo/)
  })
  it('las dos funciones cierran EXECUTE y fijan search_path (SEC-3)', () => {
    for (const fn of ['get_group_attendance', 'refresh_asistencia_por_grupo']) {
      expect(sql).toContain(`revoke execute on function public.${fn}() from public, anon, authenticated`)
      expect(sql).toContain(`grant  execute on function public.${fn}() to service_role`)
    }
    expect((sql.match(/set search_path to 'public'/g) ?? []).length).toBe(2)
  })
  it('se refresca cada noche sin bloquear lecturas', () => {
    expect(sql).toMatch(/refresh materialized view concurrently private\.asistencia_por_grupo/)
    expect(sql).toMatch(/create unique index if not exists asistencia_por_grupo_uniq/)
    expect(sql).toMatch(/cron\.schedule\('refresh-asistencia-por-grupo', '50 6 \* \* \*'/)
  })
})
