import { describe, it, expect } from 'vitest'
import {
  LEADER_STATUSES, LEADER_ADMIN_ROLES, ADMIN_ONLY_STATUSES, SETTABLE_STATUSES,
  LEADER_STATUS_LABEL, canSeeLeaderAdminStatus, visibleLeaderStatus, blocksAssignment,
} from './leader-admin-status'

describe('quién ve el matiz', () => {
  it('lo ven los tres roles que lo gestionan', () => {
    for (const r of LEADER_ADMIN_ROLES) {
      expect(canSeeLeaderAdminStatus([r])).toBe(true)
    }
  })

  // La decisión que importa: dirección tiene el módulo estudios completo y aun
  // así NO ve esto. Mismo criterio que DIR-5.
  it('dirección NO lo ve, aunque administre estudios', () => {
    expect(canSeeLeaderAdminStatus(['direccion'])).toBe(false)
    expect(LEADER_ADMIN_ROLES).not.toContain('direccion')
  })

  it('el dirigente y el miembro tampoco', () => {
    expect(canSeeLeaderAdminStatus(['dirigente'])).toBe(false)
    expect(canSeeLeaderAdminStatus(['miembro'])).toBe(false)
    expect(canSeeLeaderAdminStatus([])).toBe(false)
    expect(canSeeLeaderAdminStatus(null)).toBe(false)
  })

  it('con varios roles alcanza uno', () => {
    expect(canSeeLeaderAdminStatus(['miembro', 'dirigente', 'coordinador_dirigentes'])).toBe(true)
  })
})

describe('visibleLeaderStatus', () => {
  it('quien administra ve el estado real', () => {
    for (const s of LEADER_STATUSES) {
      expect(visibleLeaderStatus(s, true)).toBe(s)
    }
  })

  // El punto de DIR-6: afuera, en pausa y en revisión son indistinguibles de
  // inactivo. No es otra etiqueta, es otro dato.
  it('afuera, los matices colapsan a inactivo', () => {
    for (const s of ADMIN_ONLY_STATUSES) {
      expect(visibleLeaderStatus(s, false)).toBe('inactive')
    }
  })

  it('los estados que no son matiz pasan igual', () => {
    expect(visibleLeaderStatus('available', false)).toBe('available')
    expect(visibleLeaderStatus('assigned', false)).toBe('assigned')
    expect(visibleLeaderStatus('inactive', false)).toBe('inactive')
  })

  it('un valor desconocido o vacío cae a disponible, no revienta', () => {
    expect(visibleLeaderStatus(null, true)).toBe('available')
    expect(visibleLeaderStatus(undefined, false)).toBe('available')
    expect(visibleLeaderStatus('cualquier_cosa', true)).toBe('available')
  })
})

describe('blocksAssignment', () => {
  it('solo en revisión bloquea', () => {
    expect(blocksAssignment('en_revision')).toBe(true)
    for (const s of ['available', 'assigned', 'resting', 'inactive', null, undefined]) {
      expect(blocksAssignment(s)).toBe(false)
    }
  })

  // En pausa es un descanso acordado: se le puede volver a asignar sin trámite.
  it('en pausa NO bloquea: es un descanso, no un problema', () => {
    expect(blocksAssignment('resting')).toBe(false)
  })
})

describe('etiquetas y estados elegibles', () => {
  it('cada estado tiene etiqueta', () => {
    for (const s of LEADER_STATUSES) {
      expect(LEADER_STATUS_LABEL[s]).toBeTruthy()
    }
  })

  it('resting se muestra como "En pausa"', () => {
    expect(LEADER_STATUS_LABEL.resting).toBe('En pausa')
  })

  // 'assigned' lo derivaría el sistema de tener un grupo activo: elegirlo a mano
  // crearía un estado que contradice la realidad.
  it('assigned no se puede elegir a mano', () => {
    expect(SETTABLE_STATUSES).not.toContain('assigned')
    expect(SETTABLE_STATUSES).toHaveLength(4)
  })
})
