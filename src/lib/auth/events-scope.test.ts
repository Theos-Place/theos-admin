// FRM-1 parte B · Encargados de un evento. La regla vive en funciones puras;
// acá se fija el contrato que dependen las rutas, la ficha y el editor.
import { describe, it, expect } from 'vitest'
import {
  eventViewerScope, canManageEvent, canGrantEventManagers, isEventAdmin, hasEventsModule,
} from './events-scope'
import { formViewerScope, canEditFormStructure } from './forms-scope'
import { visibleEventTabs, canSeeEventManagementData, EVENT_TABS } from '@/lib/events/detail-access'
import type { RoleId } from '@/types/auth'

const EVENTO = { id: 'evt-1' }
const MIEMBRO = 'mem-1'

describe('eventViewerScope', () => {
  it('los roles que administran eventos son admin, tengan o no el evento a cargo', () => {
    for (const r of ['direccion', 'encargado_staff', 'comunicaciones', 'admin'] as RoleId[]) {
      expect(eventViewerScope({ roles: [r], memberId: MIEMBRO, event: EVENTO, isManager: false })).toBe('admin')
    }
  })

  it('el módulo de eventos (encargado_eventos) también da admin', () => {
    expect(hasEventsModule(['encargado_eventos'])).toBe(true)
    expect(eventViewerScope({ roles: ['encargado_eventos'], memberId: MIEMBRO, event: EVENTO, isManager: false })).toBe('admin')
  })

  it('sin rol pero con el evento a cargo: manager', () => {
    expect(eventViewerScope({ roles: ['miembro'], memberId: MIEMBRO, event: EVENTO, isManager: true })).toBe('manager')
  })

  it('sin rol y sin el evento a cargo: nada', () => {
    expect(eventViewerScope({ roles: ['miembro'], memberId: MIEMBRO, event: EVENTO, isManager: false })).toBe('none')
    expect(eventViewerScope({ roles: [], memberId: MIEMBRO, event: EVENTO, isManager: false })).toBe('none')
    expect(eventViewerScope({ roles: null, memberId: null, event: EVENTO, isManager: false })).toBe('none')
  })

  it('sin sesión de miembro no hay manager, aunque venga isManager en true', () => {
    // Defensa: si el caller no resolvió el member_id, no se concede nada.
    expect(eventViewerScope({ roles: ['miembro'], memberId: null, event: EVENTO, isManager: true })).toBe('none')
    expect(eventViewerScope({ roles: ['miembro'], memberId: MIEMBRO, event: null, isManager: true })).toBe('none')
  })
})

describe('qué puede hacer cada scope', () => {
  it('el encargado SÍ edita su evento (decisión 2026-08-06)', () => {
    expect(canManageEvent('manager')).toBe(true)
    expect(canManageEvent('admin')).toBe(true)
    expect(canManageEvent('none')).toBe(false)
  })

  it('el encargado NO reparte el permiso: solo lo hace quien administra eventos', () => {
    expect(canGrantEventManagers(['direccion'])).toBe(true)
    expect(canGrantEventManagers(['admin'])).toBe(true)
    // encargado_eventos ve el módulo pero no nombra encargados.
    expect(isEventAdmin(['encargado_eventos'])).toBe(false)
    expect(canGrantEventManagers(['encargado_eventos'])).toBe(false)
    expect(canGrantEventManagers(['miembro'])).toBe(false)
    expect(canGrantEventManagers(null)).toBe(false)
  })
})

describe('la ficha del evento para un encargado', () => {
  it('ve todos los tabs de su evento aunque no tenga permisos de módulo', () => {
    const tabs = visibleEventTabs({ canManage: false, canCheckin: false, canReport: false, isManager: true })
    expect(tabs).toEqual([...EVENT_TABS])
  })

  it('sin ser encargado ni tener permisos solo ve información', () => {
    const tabs = visibleEventTabs({ canManage: false, canCheckin: false, canReport: false })
    expect(tabs).toEqual(['informacion'])
  })

  it('el encargado recibe los datos de gestión (inscritos, cupos, check-ins)', () => {
    expect(canSeeEventManagementData({ canManage: false, canCheckin: false, canReport: false, isManager: true })).toBe(true)
    expect(canSeeEventManagementData({ canManage: false, canCheckin: false, canReport: false })).toBe(false)
  })
})

describe('herencia: el formulario del evento lo gestiona su encargado', () => {
  const FORM = { id: 'form-1' }

  it('encargado del evento padre → event_manager, y puede editar el formulario', () => {
    const scope = formViewerScope({
      roles: ['miembro'], memberId: MIEMBRO, form: FORM, hasGrant: false, isEventManager: true,
    })
    expect(scope).toBe('event_manager')
    expect(canEditFormStructure(scope)).toBe(true)
  })

  it('el acceso puntual lee y exporta, pero NO edita la estructura', () => {
    const scope = formViewerScope({
      roles: ['miembro'], memberId: MIEMBRO, form: FORM, hasGrant: true, isEventManager: false,
    })
    expect(scope).toBe('grantee')
    expect(canEditFormStructure(scope)).toBe(false)
  })

  it('la herencia no alcanza a un formulario suelto de otro evento', () => {
    expect(formViewerScope({
      roles: ['miembro'], memberId: MIEMBRO, form: FORM, hasGrant: false, isEventManager: false,
    })).toBe('none')
  })
})
