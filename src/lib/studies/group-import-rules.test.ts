import { describe, it, expect } from 'vitest'
import { validateGroupImportRow, type GroupImportContext } from './group-import-rules'

const ctx: GroupImportContext = {
  plansByCode: new Map([['N1', { id: 'p1', level: 'niveles' }], ['DIS1', { id: 'p2', level: 'niveles' }]]),
  zoneCodeByName: new Map([['heredia', 'HER'], ['her', 'HER']]),
  leaderIdByCedula: new Map([['112345678', 'm1']]),
}

describe('validateGroupImportRow (EST-2)', () => {
  it('fila completa válida', () => {
    const v = validateGroupImportRow({
      plan: 'n1', zona: 'Heredia', dia: 'Martes', horario: '19:00',
      fecha_inicio: '2026-09-01', fecha_fin: '2026-11-30', cupo: '12',
      cedula_dirigente: '1-1234-5678', inicio_matricula: '2026-08-01', fin_matricula: '2026-08-25',
    }, ctx)
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.insert.plan_id).toBe('p1')
      expect(v.insert.zone).toBe('HER')
      expect(v.insert.leader_id).toBe('m1')
      expect(v.insert.name).toBe('N1 — Heredia')
      expect(v.insert.max_students).toBe(12)
      expect(v.warning).toBeUndefined()
    }
  })

  it('plan obligatorio y existente', () => {
    expect(validateGroupImportRow({ plan: '' }, ctx)).toMatchObject({ ok: false })
    expect(validateGroupImportRow({ plan: 'N9' }, ctx)).toMatchObject({ ok: false, reason: expect.stringContaining('N9') })
  })

  it('zona desconocida es error; vacía es "Todas las zonas"', () => {
    expect(validateGroupImportRow({ plan: 'N1', zona: 'Marte' }, ctx)).toMatchObject({ ok: false })
    const v = validateGroupImportRow({ plan: 'N1' }, ctx)
    expect(v.ok && v.insert.zone).toBeNull()
    expect(v.ok && v.insert.name).toBe('N1 — Todas las zonas')
  })

  it('cédula sin match: grupo sin dirigente + advertencia (no error)', () => {
    const v = validateGroupImportRow({ plan: 'N1', cedula_dirigente: '9-9999-9999' }, ctx)
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.insert.leader_id).toBeNull()
      expect(v.warning).toContain('sin match')
    }
  })

  it('fechas incoherentes y ventana inválida son error', () => {
    // La fecha va FIJA. Antes el test leía el reloj real y sus fechas —futuras
    // cuando se escribió— caducaron: el 2026-09-01 empezó a fallar solo.
    const hoy = { ...ctx, todayYmd: '2026-08-01' }
    expect(validateGroupImportRow({ plan: 'N1', fecha_inicio: '2026-10-01', fecha_fin: '2026-09-01' }, hoy))
      .toMatchObject({ ok: false })
    expect(validateGroupImportRow({ plan: 'N1', fecha_inicio: '2026-09-01', fin_matricula: '2026-09-15' }, hoy))
      .toMatchObject({ ok: false }) // fin de matrícula después del inicio del grupo
  })

  it('un grupo que YA arrancó no acota la ventana (y eso no depende de hoy)', () => {
    // La contraparte, que es la razón de ser de maxEnrollmentEnd: registrar un
    // grupo en curso no puede dejar el campo inservible.
    expect(validateGroupImportRow(
      { plan: 'N1', fecha_inicio: '2026-07-01', fin_matricula: '2026-07-15' },
      { ...ctx, todayYmd: '2026-08-01' },
    )).toMatchObject({ ok: true })
  })

  it('cupo inválido es error; vacío es null', () => {
    expect(validateGroupImportRow({ plan: 'N1', cupo: 'abc' }, ctx)).toMatchObject({ ok: false })
    const v = validateGroupImportRow({ plan: 'N1', cupo: '' }, ctx)
    expect(v.ok && v.insert.max_students).toBeNull()
  })
})
