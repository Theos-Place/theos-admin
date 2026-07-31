import { describe, it, expect } from 'vitest'
import {
  requestQueueScope, canAssignRequests, canBeAssigned, canWorkRequest, isStudyCommitteeArea,
} from './request-assignment'

describe('requestQueueScope', () => {
  it('los coordinadores ven toda la cola', () => {
    expect(requestQueueScope({ roles: ['coordinador_estudios'] })).toBe('all')
    expect(requestQueueScope({ roles: ['coordinador_dirigentes'] })).toBe('all')
    expect(requestQueueScope({ roles: ['direccion'] })).toBe('all')
    expect(requestQueueScope({ roles: ['admin'] })).toBe('all')
  })

  it('el comité ve solo lo asignado', () => {
    expect(requestQueueScope({ roles: ['miembro'], inStudyCommittee: true })).toBe('assigned')
    // Sin rol alguno: igual entra si está en el comité (es el caso de las 15
    // personas del comité que no tienen rol en el sistema).
    expect(requestQueueScope({ roles: [], inStudyCommittee: true })).toBe('assigned')
  })

  it('coordinador Y comité: gana la cola completa', () => {
    expect(requestQueueScope({ roles: ['coordinador_estudios'], inStudyCommittee: true })).toBe('all')
  })

  it('el resto no entra', () => {
    expect(requestQueueScope({ roles: ['miembro'] })).toBe('none')
    expect(requestQueueScope({ roles: ['dirigente'], inStudyCommittee: false })).toBe('none')
    expect(requestQueueScope({ roles: null })).toBe('none')
  })
})

describe('canAssignRequests', () => {
  it('asignar es de los coordinadores; el comité recibe, no reparte', () => {
    expect(canAssignRequests(['coordinador_estudios'])).toBe(true)
    expect(canAssignRequests(['miembro'])).toBe(false)
    expect(canAssignRequests([])).toBe(false)
  })
})

describe('canBeAssigned', () => {
  it('coordinadores y comité son asignables', () => {
    expect(canBeAssigned({ roles: ['coordinador_dirigentes'] })).toBe(true)
    expect(canBeAssigned({ roles: [], inStudyCommittee: true })).toBe(true)
    expect(canBeAssigned({ roles: ['miembro'] })).toBe(false)
  })
})

describe('canWorkRequest', () => {
  const req = { reviewed_by: 'm1' }

  it('el coordinador trabaja cualquiera', () => {
    expect(canWorkRequest('all', req, 'otro')).toBe(true)
    expect(canWorkRequest('all', { reviewed_by: null }, null)).toBe(true)
  })

  it('el del comité solo la que le asignaron', () => {
    expect(canWorkRequest('assigned', req, 'm1')).toBe(true)
    expect(canWorkRequest('assigned', req, 'm2')).toBe(false)
    expect(canWorkRequest('assigned', { reviewed_by: null }, 'm1')).toBe(false)
  })

  it('sin alcance o sin miembro, nunca', () => {
    expect(canWorkRequest('none', req, 'm1')).toBe(false)
    expect(canWorkRequest('assigned', req, null)).toBe(false)
  })
})

describe('isStudyCommitteeArea', () => {
  it('matchea sin acentos ni mayúsculas', () => {
    expect(isStudyCommitteeArea('Comité de Estudios Bíblicos')).toBe(true)
    expect(isStudyCommitteeArea('comite de estudios biblicos')).toBe(true)
    expect(isStudyCommitteeArea('  Comité de Estudios Bíblicos  ')).toBe(true)
  })

  it('no matchea otra área', () => {
    expect(isStudyCommitteeArea('Comité de Dirigentes')).toBe(false)
    expect(isStudyCommitteeArea(null)).toBe(false)
    expect(isStudyCommitteeArea('')).toBe(false)
  })
})
