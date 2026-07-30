import { describe, it, expect } from 'vitest'
import {
  selectionPlanCode, isSelectionForm, selectionFieldIds, toYesNo,
  filterSelectionRows, summarizeSelection, chosenGroupOptions,
  canInvite, inviteCandidates, inviteBlockReason, isSelectionStatus,
  type SelectionRow, type SelectionField,
} from './selection-rules'

const FIELDS: SelectionField[] = [
  { id: 'f1', type: 'info', label: 'Gracias' },
  { id: 'f2', type: 'yes_no', label: '¿Estás de acuerdo con la Declaración doctrinal de Theos?' },
  { id: 'f3', type: 'yes_no', label: '¿Tenés el tiempo para capacitarte?' },
  { id: 'f4', type: 'radio', label: '¿Cuál grupo te serviría?', options_source: 'study_groups_open', options_source_param: 'CDEB' },
]

const row = (over: Partial<SelectionRow> = {}): SelectionRow => ({
  response_id: 'r1', member_id: 'm1', member_name: 'Ana Solís', submitted_at: '2026-07-30T12:00:00Z',
  status: 'pendiente', notes: null, invited_at: null,
  agrees_doctrine: true, available: true, chosen_group: 'Martes 7pm', recommendation: null,
  ...over,
})

describe('identificación del formulario', () => {
  it('el plan sale del campo de opciones dinámicas', () => {
    expect(selectionPlanCode(FIELDS)).toBe('CDEB')
    expect(isSelectionForm(FIELDS)).toBe(true)
  })

  it('un formulario cualquiera no es de preinscripción', () => {
    expect(selectionPlanCode([{ id: 'x', type: 'text', label: 'Nombre' }])).toBeNull()
    expect(isSelectionForm([])).toBe(false)
  })

  it('normaliza el code a mayúsculas y trata el vacío como ausente', () => {
    expect(selectionPlanCode([{ id: 'a', type: 'radio', label: 'g', options_source: 'study_groups_open', options_source_param: ' her ' }])).toBe('HER')
    expect(selectionPlanCode([{ id: 'a', type: 'radio', label: 'g', options_source: 'study_groups_open', options_source_param: '' }])).toBeNull()
  })

  it('distingue doctrinal de disponibilidad', () => {
    expect(selectionFieldIds(FIELDS)).toEqual({ doctrine: 'f2', availability: 'f3', group: 'f4' })
  })
})

describe('toYesNo', () => {
  it('acepta las formas que guarda el formulario', () => {
    expect(toYesNo('Sí')).toBe(true)
    expect(toYesNo('si')).toBe(true)
    expect(toYesNo('No')).toBe(false)
    expect(toYesNo(true)).toBe(true)
  })
  it('sin respuesta o valor raro → null', () => {
    expect(toYesNo('')).toBeNull()
    expect(toYesNo(undefined)).toBeNull()
    expect(toYesNo('tal vez')).toBeNull()
  })
})

describe('filtros', () => {
  const rows = [
    row({ response_id: 'a', member_name: 'Ana', status: 'aprobado' }),
    row({ response_id: 'b', member_name: 'Bruno', agrees_doctrine: false, chosen_group: 'No me sirve' }),
    row({ response_id: 'c', member_name: 'Carla', available: false, status: 'rechazado' }),
    row({ response_id: 'd', member_name: 'Delia', agrees_doctrine: null }),
  ]

  it('sin filtros devuelve todo', () => {
    expect(filterSelectionRows(rows, {}).length).toBe(4)
  })

  it('filtra por estado, doctrina, disponibilidad y grupo', () => {
    expect(filterSelectionRows(rows, { status: 'aprobado' }).map(r => r.response_id)).toEqual(['a'])
    expect(filterSelectionRows(rows, { doctrine: 'no' }).map(r => r.response_id)).toEqual(['b'])
    expect(filterSelectionRows(rows, { availability: 'no' }).map(r => r.response_id)).toEqual(['c'])
    expect(filterSelectionRows(rows, { group: 'No me sirve' }).map(r => r.response_id)).toEqual(['b'])
  })

  it('quien no contestó no cae ni en sí ni en no', () => {
    expect(filterSelectionRows(rows, { doctrine: 'si' }).map(r => r.response_id)).toEqual(['a', 'c'])
    expect(filterSelectionRows(rows, { doctrine: 'no' }).map(r => r.response_id)).toEqual(['b'])
  })

  it('busca por nombre sin importar mayúsculas', () => {
    expect(filterSelectionRows(rows, { q: 'car' }).map(r => r.response_id)).toEqual(['c'])
  })

  it('lista los grupos elegidos sin repetir', () => {
    expect(chosenGroupOptions(rows)).toEqual(['Martes 7pm', 'No me sirve'])
  })
})

describe('resumen', () => {
  it('cuenta por estado y los ya invitados', () => {
    expect(summarizeSelection([
      row({ status: 'aprobado', invited_at: '2026-07-30T00:00:00Z' }),
      row({ status: 'aprobado' }),
      row({ status: 'rechazado' }),
    ])).toEqual({ pendiente: 0, aprobado: 2, lista_espera: 0, rechazado: 1, invitados: 1 })
  })
})

describe('invitación', () => {
  it('solo aprobados, con miembro y sin invitar', () => {
    expect(canInvite(row({ status: 'aprobado' }))).toBe(true)
    expect(canInvite(row({ status: 'pendiente' }))).toBe(false)
    expect(canInvite(row({ status: 'aprobado', invited_at: '2026-07-30T00:00:00Z' }))).toBe(false)
    expect(canInvite(row({ status: 'aprobado', member_id: null }))).toBe(false)
  })

  it('inviteCandidates filtra la lista', () => {
    const rows = [row({ response_id: 'a', status: 'aprobado' }), row({ response_id: 'b', status: 'lista_espera' })]
    expect(inviteCandidates(rows).map(r => r.response_id)).toEqual(['a'])
  })

  it('el motivo del bloqueo prioriza el "ya invitado"', () => {
    expect(inviteBlockReason(row({ status: 'aprobado' }))).toBeNull()
    expect(inviteBlockReason(row({ status: 'rechazado', invited_at: '2026-07-30T00:00:00Z' })))
      .toBe('Ya se le envió la invitación.')
    expect(inviteBlockReason(row({ status: 'pendiente' }))).toBe('Solo se invita a quienes están aprobados.')
    expect(inviteBlockReason(row({ status: 'aprobado', member_id: null })))
      .toBe('La respuesta no está ligada a un miembro del sistema.')
  })
})

describe('isSelectionStatus', () => {
  it('valida el enum del body', () => {
    expect(isSelectionStatus('aprobado')).toBe(true)
    expect(isSelectionStatus('otro')).toBe(false)
    expect(isSelectionStatus(null)).toBe(false)
  })
})
