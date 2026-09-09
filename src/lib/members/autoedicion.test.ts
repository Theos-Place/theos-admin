import { describe, it, expect } from 'vitest'
import {
  CAMPOS_AUTOEDITABLES, filtrarAutoedicion, mensajeDeCampoBloqueado, puedeEditarColumna,
} from './autoedicion'

describe('qué puede editar alguien de su propia ficha', () => {
  it('los datos personales que pidió el negocio, y nada más', () => {
    expect([...CAMPOS_AUTOEDITABLES].sort()).toEqual([
      'address', 'allergies', 'birth_date', 'canton',
      'dietary_restrictions',
      'district', 'emergency_contact_name', 'emergency_contact_phone',
      'first_name', 'gender', 'last_name',
      'medications', 'occupation', 'phone', 'province', 'workplace',
    ])
  })

  it('el correo NO: es su usuario de login y la llave de dedup', () => {
    const r = filtrarAutoedicion({ email: 'otro@x.com' }, null)
    expect(r.permitidos).toEqual({})
    expect(r.rechazados[0].motivo).toMatch(/usuario para entrar/)
  })

  // Decisión del usuario 2026-09-10, que revierte la restricción inicial: la
  // gente corrige sus propios typos. El correo sigue afuera.
  it('nombre, apellidos, fecha de nacimiento y género SÍ', () => {
    for (const campo of ['first_name', 'last_name', 'birth_date', 'gender']) {
      const r = filtrarAutoedicion({ [campo]: 'x' }, null)
      expect(r.permitidos, campo).toEqual({ [campo]: 'x' })
      expect(r.rechazados, campo).toEqual([])
    }
  })

  it('los flags de gestión tampoco', () => {
    const r = filtrarAutoedicion({ is_active: true, is_donor: true, is_system: true }, null)
    expect(r.permitidos).toEqual({})
    expect(r.rechazados.map(x => x.campo).sort()).toEqual(['is_active', 'is_donor', 'is_system'])
  })

  it('cada rechazo dice a quién pedírselo, no solo que no se puede', () => {
    for (const { motivo } of filtrarAutoedicion({ email: 'a@b.c', first_name: 'x' }, null).rechazados) {
      expect(motivo).toMatch(/soporte@theosplace\.org|equipo de Theos/)
    }
  })

  it('un campo inventado se rechaza con el mensaje genérico', () => {
    expect(mensajeDeCampoBloqueado('columna_que_no_existe')).toMatch(/equipo de Theos/)
  })
})

describe('el documento: completar sí, cambiar no', () => {
  it('sin documento registrado, lo puede completar', () => {
    const r = filtrarAutoedicion({ cedula: '112340567', document_type: 'cedula' }, null)
    expect(r.permitidos).toEqual({ cedula: '112340567', document_type: 'cedula' })
    expect(r.rechazados).toEqual([])
  })

  it('con documento registrado, NO lo puede cambiar', () => {
    const r = filtrarAutoedicion({ cedula: '999999999' }, '112340567')
    expect(r.permitidos).toEqual({})
    expect(r.rechazados[0].motivo).toMatch(/Ya tenés un documento registrado/)
  })

  it('un documento en blanco o con espacios cuenta como "no tiene"', () => {
    expect(filtrarAutoedicion({ cedula: '1' }, '').permitidos).toEqual({ cedula: '1' })
    expect(filtrarAutoedicion({ cedula: '1' }, '   ').permitidos).toEqual({ cedula: '1' })
  })

  it('tener documento no bloquea el resto de los campos', () => {
    const r = filtrarAutoedicion({ cedula: '9', allergies: 'maní' }, '112340567')
    expect(r.permitidos).toEqual({ allergies: 'maní' })
    expect(r.rechazados.map(x => x.campo)).toEqual(['cedula'])
  })
})

describe('mezclas', () => {
  it('guarda lo permitido y reporta lo demás, en la misma llamada', () => {
    const r = filtrarAutoedicion(
      { allergies: 'polen', phone: '88887777', email: 'nuevo@x.com', is_active: false },
      null,
    )
    expect(r.permitidos).toEqual({ allergies: 'polen', phone: '88887777' })
    expect(r.rechazados.map(x => x.campo).sort()).toEqual(['email', 'is_active'])
  })

  it('conserva un valor vacío: borrar las alergias es una edición válida', () => {
    expect(filtrarAutoedicion({ allergies: '' }, null).permitidos).toEqual({ allergies: '' })
    expect(filtrarAutoedicion({ allergies: null }, null).permitidos).toEqual({ allergies: null })
  })

  it('con basura no revienta', () => {
    expect(filtrarAutoedicion(null, null)).toEqual({ permitidos: {}, rechazados: [] })
    expect(filtrarAutoedicion('texto', null)).toEqual({ permitidos: {}, rechazados: [] })
  })
})

describe('puedeEditarColumna — quién edita qué', () => {
  const yo = { esStaff: false, esPropia: true, tieneDocumento: false }
  const staff = { esStaff: true, esPropia: false, tieneDocumento: true }
  const ajeno = { esStaff: false, esPropia: false, tieneDocumento: false }

  it('sobre la ficha de otra persona, sin ser staff, no se edita nada', () => {
    for (const c of ['phone', 'allergies', 'first_name', 'email']) {
      expect(puedeEditarColumna(c, ajeno), c).toBe(false)
    }
  })

  it('el correo lo edita el staff, no la persona', () => {
    expect(puedeEditarColumna('email', staff)).toBe(true)
    expect(puedeEditarColumna('email', { ...yo })).toBe(false)
  })

  it('el estado civil lo edita el staff, no la persona', () => {
    expect(puedeEditarColumna('marital_status', staff)).toBe(true)
    expect(puedeEditarColumna('marital_status', yo)).toBe(false)
  })

  it('la cédula: el staff siempre; la persona solo si le falta', () => {
    expect(puedeEditarColumna('cedula', staff)).toBe(true)
    expect(puedeEditarColumna('cedula', { ...yo, tieneDocumento: false })).toBe(true)
    expect(puedeEditarColumna('cedula', { ...yo, tieneDocumento: true })).toBe(false)
  })

  it('los datos personales los edita cualquiera de los dos', () => {
    for (const c of ['phone', 'address', 'allergies', 'occupation', 'gender', 'birth_date']) {
      expect(puedeEditarColumna(c, yo), c).toBe(true)
      expect(puedeEditarColumna(c, staff), c).toBe(true)
    }
  })

  it('una columna de gestión no la edita nadie desde esta pantalla', () => {
    for (const c of ['is_active', 'is_donor', 'is_system', 'sede_id']) {
      expect(puedeEditarColumna(c, staff), c).toBe(false)
      expect(puedeEditarColumna(c, yo), c).toBe(false)
    }
  })
})
