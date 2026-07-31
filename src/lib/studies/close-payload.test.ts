import { describe, it, expect } from 'vitest'
import { toClosePayloadItem, toClosePayload, failsWithoutReason, type CloseRow } from './close-payload'

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

  it('el comentario del retiro es OPCIONAL: vacío viaja como null', () => {
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

describe('failsWithoutReason', () => {
  it('cuenta los reprobados sin justificación', () => {
    expect(failsWithoutReason([
      row({ status_result: 'reprobado' }),
      row({ status_result: 'reprobado', fail_reason: 'ok' }),
      row({ status_result: 'aprobado' }),
    ])).toBe(1)
  })

  it('un retirado sin comentario NO bloquea (es opcional)', () => {
    expect(failsWithoutReason([row({ status_result: 'retirado' })])).toBe(0)
  })
})
