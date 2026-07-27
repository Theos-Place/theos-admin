import { describe, it, expect } from 'vitest'
import { shouldNotifyAssignment } from './assignment-rules'

const base = { is_active: true, entity_type: 'event' as const, entity_id: 'e1', assignment_notified_key: null }

describe('shouldNotifyAssignment (FEA-1)', () => {
  it('notifica una asignación nueva en un form activo', () => {
    expect(shouldNotifyAssignment(base)).toEqual({ notify: true, key: 'event:e1' })
    expect(shouldNotifyAssignment({ ...base, entity_type: 'study_group', entity_id: 'g1' }))
      .toEqual({ notify: true, key: 'study_group:g1' })
  })

  it('NO notifica borradores ni forms sin entidad real', () => {
    expect(shouldNotifyAssignment({ ...base, is_active: false }).notify).toBe(false)
    expect(shouldNotifyAssignment({ ...base, entity_type: 'general' }).notify).toBe(false)
    expect(shouldNotifyAssignment({ ...base, entity_type: null }).notify).toBe(false)
    expect(shouldNotifyAssignment({ ...base, entity_id: null }).notify).toBe(false)
  })

  it('dedupe: re-guardar sin cambiar la asignación no reenvía', () => {
    expect(shouldNotifyAssignment({ ...base, assignment_notified_key: 'event:e1' }).notify).toBe(false)
  })

  it('reasignar a otra entidad sí reenvía', () => {
    expect(shouldNotifyAssignment({ ...base, assignment_notified_key: 'event:otro' }))
      .toEqual({ notify: true, key: 'event:e1' })
  })
})
