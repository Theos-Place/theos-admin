import { describe, it, expect } from 'vitest'
import {
  APPLICATION_STATES, APPLICATION_STATE_LABEL, isApplicationState,
  motivoQueImpideCambiar, estadosDestino, admiteMotivo, avisosDe,
} from './application-states'

describe('los cinco estados', () => {
  it('son cinco y uno solo es nuevo', () => {
    expect(APPLICATION_STATES).toHaveLength(5)
    expect(APPLICATION_STATES).toContain('sent_to_leader')
    // Los otros cuatro son los que ya estaban en la columna: renombrarlos
    // habría obligado a migrar datos y a tocar el RPC que activa servidores.
    for (const viejo of ['pending', 'reviewing', 'approved', 'rejected']) {
      expect(APPLICATION_STATES).toContain(viejo)
    }
  })

  it('«recibida» y «en revisión» no se confunden: dicen cosas distintas', () => {
    expect(APPLICATION_STATE_LABEL.pending).toBe('Recibida')
    expect(APPLICATION_STATE_LABEL.reviewing).toBe('En revisión')
    expect(APPLICATION_STATE_LABEL.sent_to_leader).toBe('Enviada al encargado')
  })

  it('rechaza un estado inventado', () => {
    expect(isApplicationState('aceptada')).toBe(false)
    expect(isApplicationState('approved')).toBe(true)
  })
})

describe('una aceptada NO se deshace desde acá', () => {
  it('aceptar dio de alta a la persona: volver atrás mentiría', () => {
    // Aceptar activó a la persona como servidora del puesto y le sincronizó
    // los roles. Devolver la aplicación a «recibida» la dejaría sirviendo y
    // con permisos, con la pantalla diciendo otra cosa.
    for (const hacia of ['pending', 'reviewing', 'rejected', 'sent_to_leader']) {
      expect(motivoQueImpideCambiar('approved', hacia), hacia).toMatch(/quedó asignada/)
    }
    expect(estadosDestino('approved')).toEqual([])
  })

  it('desde los demás sí se mueve', () => {
    expect(motivoQueImpideCambiar('pending', 'sent_to_leader')).toBeNull()
    expect(motivoQueImpideCambiar('sent_to_leader', 'approved')).toBeNull()
    expect(motivoQueImpideCambiar('reviewing', 'rejected')).toBeNull()
  })

  it('al mismo estado, no', () => {
    expect(motivoQueImpideCambiar('pending', 'pending')).toMatch(/ya está/)
  })

  it('el selector nunca ofrece el estado actual', () => {
    for (const s of APPLICATION_STATES) {
      expect(estadosDestino(s), s).not.toContain(s)
    }
  })
})

describe('quién se entera', () => {
  it('«enviada al encargado» avisa al encargado del puesto', () => {
    expect(avisosDe('sent_to_leader')).toEqual(['encargado_del_puesto'])
  })

  it('«en revisión» y «aceptada» avisan a RH y staff', () => {
    expect(avisosDe('reviewing')).toEqual(['rh_y_staff'])
    expect(avisosDe('approved')).toEqual(['rh_y_staff'])
  })

  it('«rechazada» NO manda nada, y es a propósito', () => {
    // Un rechazo automático por correo es peor que el silencio: esa
    // conversación la tiene una persona.
    expect(avisosDe('rejected')).toEqual([])
    expect(avisosDe('pending')).toEqual([])
  })

  it('solo «en revisión» pide motivo', () => {
    expect(admiteMotivo('reviewing')).toBe(true)
    for (const s of ['pending', 'sent_to_leader', 'approved', 'rejected']) {
      expect(admiteMotivo(s), s).toBe(false)
    }
  })
})
