// CONTRATO de la regla "sede por asistencia a charlas", compartido por sus DOS
// implementaciones (que existen a propósito por rendimiento/contexto):
//   1. TS  — computeMemberSede() en sede-attendance.ts (cálculo en vivo, perfil).
//   2. SQL — refresh_member_sedes() en la migración baseline (cron masivo 22k+).
//
// ⚠️ Si cambiás la regla de sede, actualizá los TRES:
//    · src/lib/sede-attendance.ts (computeMemberSede)
//    · refresh_member_sedes() en supabase/migrations (la función SQL espejo)
//    · estos fixtures
// El test sede-attendance.test.ts valida el lado TS contra estos casos; sirven
// además como especificación única para verificar el lado SQL (ver el script de
// paridad si se agrega uno con BD de prueba).
//
// Regla (decisión 2026-07-15):
//  · Activo (asistió en los últimos 6 meses): sede = charla más asistida en esos
//    6 meses; empate → la más reciente.
//  · Inactivo (sin asistencia en 6 meses): sede = charla más asistida en los 6
//    meses PREVIOS a su última asistencia (su último período activo).
//  · Sin asistencias con sede reconocible: sin sede (null).

export type SedeCheckin = { checked_in_at: string; title: string }
export type SedeExpected = { name: string; case: 'activo' | 'inactivo'; lastCheckin: string } | null

export type SedeRuleCase = {
  name: string
  now: string
  checkins: SedeCheckin[]
  expected: SedeExpected
}

export const SEDE_RULE_CASES: SedeRuleCase[] = [
  {
    name: 'sin check-ins → null',
    now: '2026-07-15T12:00:00Z',
    checkins: [],
    expected: null,
  },
  {
    name: 'título no canónico se ignora → null',
    now: '2026-07-15T12:00:00Z',
    checkins: [{ checked_in_at: '2026-06-01T00:00:00Z', title: 'Actividad especial' }],
    expected: null,
  },
  {
    name: 'activo: sede = más asistida en los últimos 6 meses',
    now: '2026-07-15T12:00:00Z',
    checkins: [
      { checked_in_at: '2026-07-01T00:00:00Z', title: 'Charla Cartago' },
      { checked_in_at: '2026-06-01T00:00:00Z', title: 'Charla Cartago' },
      { checked_in_at: '2026-05-01T00:00:00Z', title: 'Charla Heredia' },
    ],
    expected: { name: 'Cartago', case: 'activo', lastCheckin: '2026-07-01T00:00:00Z' },
  },
  {
    name: 'activo con empate → gana la más reciente',
    now: '2026-07-15T12:00:00Z',
    checkins: [
      { checked_in_at: '2026-06-01T00:00:00Z', title: 'Charla Cartago' },
      { checked_in_at: '2026-07-01T00:00:00Z', title: 'Charla Heredia' },
    ],
    expected: { name: 'Heredia', case: 'activo', lastCheckin: '2026-07-01T00:00:00Z' },
  },
  {
    name: 'inactivo: usa la ventana previa a la última asistencia, no todo el historial',
    now: '2026-07-15T12:00:00Z',
    checkins: [
      { checked_in_at: '2024-01-01T00:00:00Z', title: 'Charla Alajuela' },
      { checked_in_at: '2024-02-01T00:00:00Z', title: 'Charla Alajuela' },
      { checked_in_at: '2024-03-01T00:00:00Z', title: 'Charla Alajuela' },
      { checked_in_at: '2025-08-01T00:00:00Z', title: 'Charla Cartago' },
      { checked_in_at: '2025-09-01T00:00:00Z', title: 'Charla Cartago' },
      { checked_in_at: '2025-11-01T00:00:00Z', title: 'Charla Cartago' },
    ],
    expected: { name: 'Cartago', case: 'inactivo', lastCheckin: '2025-11-01T00:00:00Z' },
  },
  {
    name: 'mezcla canónico/no canónico: ignora los no reconocidos',
    now: '2026-07-15T12:00:00Z',
    checkins: [
      { checked_in_at: '2026-07-02T00:00:00Z', title: 'Reunión general' },
      { checked_in_at: '2026-07-01T00:00:00Z', title: 'Charla Heredia' },
    ],
    expected: { name: 'Heredia', case: 'activo', lastCheckin: '2026-07-01T00:00:00Z' },
  },
]
