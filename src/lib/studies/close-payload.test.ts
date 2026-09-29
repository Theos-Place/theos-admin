import { describe, it, expect } from 'vitest'
import {
  toClosePayloadItem, toClosePayload, missingReasons, missingReasonsMessage,
  withdrawReasonError, WITHDRAW_REASON_MIN, type CloseRow,
} from './close-payload'

const row = (over: Partial<CloseRow> = {}): CloseRow => ({
  member_id: 'm1', status_result: 'aprobado', grade: '', fail_reason: '', withdraw_reason: '',
  rec_oracion: false, rec_servicio: false, rec_dirigente: false, rec_justification: '',
  ...over,
})

describe('toClosePayloadItem', () => {
  it('aprobado con nota', () => {
    expect(toClosePayloadItem(row({ grade: '95' }), false)).toMatchObject({
      status_result: 'aprobado', grade: 95, fail_reason: null, withdraw_reason: null,
    })
  })

  it('reprobado manda la justificación, no el comentario de retiro', () => {
    const item = toClosePayloadItem(row({
      status_result: 'reprobado', fail_reason: '  faltó a 6 clases  ', withdraw_reason: 'texto viejo',
    }), false)
    expect(item.fail_reason).toBe('faltó a 6 clases')
    expect(item.withdraw_reason).toBeNull()
  })

  it('retirado manda el comentario, no la justificación', () => {
    const item = toClosePayloadItem(row({
      status_result: 'retirado', withdraw_reason: '  se mudó a Liberia  ', fail_reason: 'texto viejo',
    }), false)
    expect(item.withdraw_reason).toBe('se mudó a Liberia')
    expect(item.fail_reason).toBeNull()
  })

  it('el motivo del retiro vacío viaja como null (el bloqueo lo hace missingReasons)', () => {
    expect(toClosePayloadItem(row({ status_result: 'retirado' }), false).withdraw_reason).toBeNull()
    expect(toClosePayloadItem(row({ status_result: 'retirado', withdraw_reason: '   ' }), false).withdraw_reason).toBeNull()
  })

  it('sin nota escrita, grade va null (no 0)', () => {
    expect(toClosePayloadItem(row({ grade: '' }), false).grade).toBeNull()
  })

  it('recomendaciones solo si el plan las permite', () => {
    const conRec = row({ rec_dirigente: true, rec_justification: ' listo ' })
    expect(toClosePayloadItem(conRec, true).recommendations).toEqual({
      oracion: false, servicio: false, dirigente: true, justification: 'listo',
    })
    expect(toClosePayloadItem(conRec, false).recommendations).toBeNull()
  })

  it('sin ninguna marca no manda objeto de recomendaciones', () => {
    expect(toClosePayloadItem(row(), true).recommendations).toBeNull()
  })
})

describe('toClosePayload', () => {
  it('omite a quien no tiene resultado marcado', () => {
    const items = toClosePayload([
      row({ member_id: 'a' }),
      row({ member_id: 'b', status_result: '' }),
      row({ member_id: 'c', status_result: 'retirado' }),
    ], false)
    expect(items.map(i => i.member_id)).toEqual(['a', 'c'])
  })
})

describe('missingReasons', () => {
  it('marca los reprobados sin justificación', () => {
    expect(missingReasons([
      row({ member_id: 'a', status_result: 'reprobado' }),
      row({ member_id: 'b', status_result: 'reprobado', fail_reason: 'ok' }),
      row({ member_id: 'c', status_result: 'aprobado' }),
    ])).toEqual([{ member_id: 'a', status: 'reprobado' }])
  })

  it('un retirado SIN motivo bloquea (obligatorio desde 2026-08-04)', () => {
    expect(missingReasons([row({ member_id: 'a', status_result: 'retirado' })]))
      .toEqual([{ member_id: 'a', status: 'retirado' }])
    expect(missingReasons([row({ member_id: 'a', status_result: 'retirado', withdraw_reason: '   ' })]))
      .toEqual([{ member_id: 'a', status: 'retirado' }])
  })

  it('con motivo escrito, el retirado pasa', () => {
    expect(missingReasons([row({ status_result: 'retirado', withdraw_reason: 'se mudó' })])).toEqual([])
  })

  it('el aprobado nunca pide motivo', () => {
    expect(missingReasons([row({ status_result: 'aprobado' })])).toEqual([])
  })

  it('SIN resultado bloquea el cierre (2026-09-28)', () => {
    // Antes se podía cerrar dejando a alguien sin marcar, y esa persona
    // quedaba en `en_revision` dentro de un grupo cerrado: ni aprobada ni
    // reprobada, y sin que nadie se enterara. Al 2026-09-28 hay 10 así.
    expect(missingReasons([row({ status_result: '' })]))
      .toEqual([{ member_id: 'm1', status: 'sin_resultado' }])
  })

  it('pero la NOTA no bloquea: es una decisión, no un olvido', () => {
    // CCB nunca guardó notas numéricas —el formulario de fin de nivel pedía
    // la lista de quién aprobó y quién reprobó—, así que exigirla volvería
    // imposible cerrar un grupo cuyo dirigente no tiene de dónde sacarla.
    expect(missingReasons([row({ status_result: 'aprobado', grade: '' })])).toEqual([])
    expect(missingReasons([row({ status_result: 'reprobado', fail_reason: 'no asistió', grade: '' })]))
      .toEqual([])
  })
})

describe('missingReasonsMessage', () => {
  const nameOf = (id: string) => (id === 'a' ? 'Ana Ruiz' : 'Beto Mora')

  it('sin faltantes, sin mensaje', () => {
    expect(missingReasonsMessage([], nameOf)).toBe('')
  })

  it('dice QUÉ falta y DE QUIÉN', () => {
    expect(missingReasonsMessage([{ member_id: 'a', status: 'retirado' }], nameOf))
      .toBe('Antes de cerrar: Ana Ruiz (falta el motivo del retiro).')
  })

  it('dice que falta el resultado con esas palabras, no «falta un motivo»', () => {
    // No es un motivo lo que falta: es decir si aprobó, reprobó o se retiró.
    expect(missingReasonsMessage([{ member_id: 'a', status: 'sin_resultado' }], nameOf))
      .toBe('Antes de cerrar: Ana Ruiz (falta marcar si aprobó, reprobó o se retiró).')
  })

  it('varios: los lista a todos', () => {
    const msg = missingReasonsMessage([
      { member_id: 'a', status: 'retirado' },
      { member_id: 'b', status: 'reprobado' },
    ], nameOf)
    expect(msg).toContain('faltan 2 datos')
    expect(msg).toContain('Ana Ruiz (falta el motivo del retiro)')
    expect(msg).toContain('Beto Mora (falta la justificación de la reprobación)')
  })
})

// EST-14 · La causa raíz no era la validación del cierre (esa estaba bien) sino
// el botón "Desinscribir" de la ficha del grupo, que mandaba el motivo
// hardcodeado 'Desinscrito desde el grupo'. Un obligatorio que acepta cualquier
// cosa se llena con cualquier cosa.
describe('withdrawReasonError', () => {
  it('vacío no pasa', () => {
    expect(withdrawReasonError('')).toMatch(/escribí el motivo/i)
    expect(withdrawReasonError(null)).toMatch(/escribí el motivo/i)
    expect(withdrawReasonError(undefined)).toMatch(/escribí el motivo/i)
    expect(withdrawReasonError('    ')).toMatch(/escribí el motivo/i)
  })

  it('un tecleo tampoco', () => {
    expect(withdrawReasonError('x')).toMatch(/muy corto/i)
    expect(withdrawReasonError('asdf')).toMatch(/muy corto/i)
    expect(withdrawReasonError('no sé')).toMatch(/muy corto/i)
  })

  it('un motivo de verdad pasa', () => {
    expect(withdrawReasonError('Se mudó de zona')).toBeNull()
    expect(withdrawReasonError('Cambió de horario en el trabajo')).toBeNull()
  })

  it('el mínimo se mide sin los espacios de los extremos', () => {
    expect(withdrawReasonError(`  ${'a'.repeat(WITHDRAW_REASON_MIN)}  `)).toBeNull()
    expect(withdrawReasonError(`  ${'a'.repeat(WITHDRAW_REASON_MIN - 1)}  `)).toMatch(/muy corto/i)
  })
})
