import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { conditionLabel } from '@/lib/condition-labels'

const cond = (negate = false) => ({ id: 1, group: 'attend' as const, type: 'sin_actividad' as const, anios: 3, negate })

describe('PAR-10 · «Ya no es de Theos»', () => {
  it('la etiqueta dice qué es, y negada dice lo contrario con texto propio', () => {
    expect(conditionLabel(cond())).toBe('Ya no es de Theos (3+ años sin actividad)')
    expect(conditionLabel(cond(true))).toBe('Con actividad en los últimos 3 años')
  })

  const sql = readFileSync('supabase/migrations/20261030200000_par10_sin_actividad.sql', 'utf8')
  it('actividad = check-in, inscripción a evento o estar INSCRITO en un estudio (sin exigir asistencia)', () => {
    expect(sql).toContain('from event_checkins')
    expect(sql).toContain('from event_registrations')
    expect(sql).toContain('from study_enrollments')
    expect(sql).not.toContain('study_attendance')
  })
  it('la ficha tiene que tener más de N años SIEMPRE: una ficha nueva todavía puede integrarse', () => {
    expect(sql).toMatch(/where m\.created_at < corte\.f\s+and \(u\.f is null or u\.f < corte\.f\)/)
  })
  it('quien sirve hoy no entra', () => {
    expect(sql).toMatch(/not exists \(select 1 from volunteers v where v\.member_id = m\.id and v\.status = 'active'\)/)
  })
  it('la función no queda abierta a la llave pública (SEC-3)', () => {
    expect(sql).toContain('revoke execute on function public.miembros_sin_actividad(int) from public, anon, authenticated;')
    expect(sql).toContain("alter  function public.miembros_sin_actividad(int) set search_path to 'public';")
  })
  it('está en la pestaña Asistencia, con incluir y excluir', () => {
    const ui = readFileSync('src/components/members/AdvancedFilters.tsx', 'utf8')
    expect(ui).toContain("attend:  (['attendance', 'registration', 'sin_actividad'] as const)")
    expect(ui).toContain("negate: modo === 'excluir'")
  })
  it('el servidor la resuelve con la función SQL', () => {
    expect(readFileSync('src/lib/supabase/queries/members.ts', 'utf8')).toContain(".rpc('miembros_sin_actividad'")
  })
})
