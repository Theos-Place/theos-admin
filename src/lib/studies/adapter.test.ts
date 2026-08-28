import { describe, it, expect } from 'vitest'
import { toDomainStudyGroup } from './adapter'

describe('resultado del cierre — las dos convenciones de "reprobado"', () => {
  const base = { id: 'g1', name: 'G', status: 'finalizado', enrollment_counts: null } as never
  const participante = (status: string, notes: string | null) => toDomainStudyGroup({
    ...(base as object),
    enrollments: [{ member_id: 'm1', status, notes, grade: null, member: { first_name: 'A', last_name: 'B' } }],
  } as never).participants[0]

  it('status "reprobado" sin notes cuenta como reprobado, no como retirado', () => {
    // 152 filas de la base están así (migración y resolución individual).
    const p = participante('reprobado', null)
    expect(p.result).toBe('reprobado')
    expect(p.status).toBe('enrolled') // participó; el resultado lo dice `result`
  })

  it('la convención del cierre de la app (completed + notes) sigue funcionando', () => {
    expect(participante('completed', 'reprobado: no entregó el trabajo final').result).toBe('reprobado')
    expect(participante('completed', 'aprobado').result).toBe('aprobado')
    expect(participante('completed', null).result).toBe('aprobado')
  })

  it('un retiro de verdad sí es withdrawn', () => {
    expect(participante('dropped', null).status).toBe('withdrawn')
  })
})
