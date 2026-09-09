import { describe, it, expect } from 'vitest'
import {
  CAMPOS_ALTA_CHECKIN, CAMPOS_CORRECCION_CHECKIN,
  soloCamposPermitidos, camposRechazados,
} from './alta-desde-checkin'

describe('el alcance del check-in sobre una ficha', () => {
  it('la corrección se limita a documento y teléfono — nada más del perfil', () => {
    expect([...CAMPOS_CORRECCION_CHECKIN].sort()).toEqual(['cedula', 'document_type', 'phone'])
  })

  it('el alta pide solo datos básicos', () => {
    expect([...CAMPOS_ALTA_CHECKIN].sort())
      .toEqual(['birth_date', 'cedula', 'document_type', 'email', 'first_name', 'last_name', 'phone'])
  })

  it('ningún campo de gestión se cuela en ninguna de las dos listas', () => {
    const prohibidos = ['is_active', 'is_donor', 'is_system', 'notes', 'auth_user_id', 'roles', 'sede']
    for (const p of prohibidos) {
      expect(CAMPOS_ALTA_CHECKIN as readonly string[]).not.toContain(p)
      expect(CAMPOS_CORRECCION_CHECKIN as readonly string[]).not.toContain(p)
    }
  })

  it('el correo se puede dar de alta pero NO corregir: cambiarlo mueve el acceso a la cuenta', () => {
    expect(CAMPOS_ALTA_CHECKIN as readonly string[]).toContain('email')
    expect(CAMPOS_CORRECCION_CHECKIN as readonly string[]).not.toContain('email')
  })
})

describe('soloCamposPermitidos', () => {
  it('descarta lo que no está en la lista', () => {
    const r = soloCamposPermitidos(
      { cedula: '112340567', phone: '88887777', is_active: false, notes: 'hola' },
      CAMPOS_CORRECCION_CHECKIN,
    )
    expect(r).toEqual({ cedula: '112340567', phone: '88887777' })
  })

  it('conserva un null explícito (borrar el teléfono es una edición válida)', () => {
    expect(soloCamposPermitidos({ phone: null }, CAMPOS_CORRECCION_CHECKIN)).toEqual({ phone: null })
  })

  it('con basura devuelve vacío en vez de reventar', () => {
    expect(soloCamposPermitidos(null, CAMPOS_CORRECCION_CHECKIN)).toEqual({})
    expect(soloCamposPermitidos('texto', CAMPOS_CORRECCION_CHECKIN)).toEqual({})
  })
})

describe('camposRechazados', () => {
  it('nombra lo que se intentó mandar de más', () => {
    expect(camposRechazados({ cedula: '1', is_active: false, email: 'a@b.c' }, CAMPOS_CORRECCION_CHECKIN))
      .toEqual(['is_active', 'email'])
  })

  it('un cuerpo limpio no rechaza nada', () => {
    expect(camposRechazados({ cedula: '1', phone: '2' }, CAMPOS_CORRECCION_CHECKIN)).toEqual([])
  })
})
