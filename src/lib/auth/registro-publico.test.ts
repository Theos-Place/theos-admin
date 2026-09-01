import { describe, it, expect } from 'vitest'
import { erroresDeRegistro, normalizarRegistro, planDeRegistro, registroEsValido } from './registro-publico'

const ok = {
  first_name: 'Ana', last_name: 'Rojas Mora',
  document_type: 'cedula', cedula: '1-1234-5678',
  email: 'ana@gmail.com', phone: '8888 8888',
}

describe('erroresDeRegistro', () => {
  it('unos datos completos pasan', () => {
    expect(erroresDeRegistro(ok)).toEqual({})
    expect(registroEsValido(ok)).toBe(true)
  })

  it('el documento es OBLIGATORIO: sin él no se registra nadie', () => {
    // Es la única llave contra duplicados; sin documento el padrón se llena de
    // fichas repetidas que después hay que fusionar a mano.
    expect(erroresDeRegistro({ ...ok, cedula: '' })).toHaveProperty('cedula')
    expect(erroresDeRegistro({ ...ok, cedula: 'abc' })).toHaveProperty('cedula')
  })

  it('pide nombre y apellidos de verdad', () => {
    expect(erroresDeRegistro({ ...ok, first_name: '' })).toHaveProperty('first_name')
    expect(erroresDeRegistro({ ...ok, last_name: 'X' })).toHaveProperty('last_name')
  })

  it('valida el correo', () => {
    for (const email of ['', 'sin-arroba', 'a@b', 'a@b.c'])
      expect(erroresDeRegistro({ ...ok, email }), email).toHaveProperty('email')
  })

  it('el teléfono es opcional pero no cualquier cosa', () => {
    expect(erroresDeRegistro({ ...ok, phone: '' })).toEqual({})
    expect(erroresDeRegistro({ ...ok, phone: undefined })).toEqual({})
    expect(erroresDeRegistro({ ...ok, phone: '123' })).toHaveProperty('phone')
  })
})

describe('normalizarRegistro', () => {
  it('limpia lo que la gente escribe', () => {
    const r = normalizarRegistro({ ...ok, first_name: '  Ana  María ', email: '  ANA@Gmail.COM ' })
    expect(r.first_name).toBe('Ana María')
    expect(r.email).toBe('ana@gmail.com')
    expect(r.cedula).toBe('112345678')
    expect(r.phone).toBe('8888 8888')
  })
  it('teléfono vacío queda null, no cadena vacía', () => {
    expect(normalizarRegistro({ ...ok, phone: '   ' }).phone).toBeNull()
  })
})

describe('planDeRegistro', () => {
  it('documento nuevo → se crea', () => {
    expect(planDeRegistro({ existente: null })).toEqual({ accion: 'crear' })
  })

  it('documento YA registrado → no se crea y el enlace va al correo DE LA FICHA', () => {
    // La regla que cierra la apropiación de cuentas: registrarse con la cédula
    // de otro y un correo propio no puede entregarte su cuenta.
    const r = planDeRegistro({ existente: { id: 'm1', email: 'dueña@real.com' } })
    expect(r).toEqual({ accion: 'reenviar', memberId: 'm1', correoDeLaFicha: 'dueña@real.com' })
  })

  it('si la ficha existente no tiene correo, lo resuelve el staff', () => {
    // No hay a dónde mandar el enlace. Mandarlo al correo escrito sería
    // exactamente el agujero que la regla anterior cierra.
    const r = planDeRegistro({ existente: { id: 'm1', email: null } })
    expect(r.accion).toBe('derivar_a_staff')
  })

  it('un correo en blanco en la ficha cuenta como sin correo', () => {
    expect(planDeRegistro({ existente: { id: 'm1', email: '   ' } }).accion).toBe('derivar_a_staff')
  })
})

describe('mensajes al usuario', () => {
  it('el de "ya existe" dice que NO se creó nada y adónde fue el enlace', async () => {
    const { MENSAJE_YA_EXISTE, MENSAJE_SIN_CORREO } = await import('./registro-publico')
    // Sin esto la persona queda esperando un correo de bienvenida que no llega,
    // y a los cinco minutos vuelve a intentar registrarse.
    expect(MENSAJE_YA_EXISTE).toMatch(/no creamos un perfil nuevo/i)
    expect(MENSAJE_YA_EXISTE).toMatch(/correo registrado/i)
    // Nunca se dice CUÁL es ese correo: eso sería filtrar el dato de otra persona.
    expect(MENSAJE_YA_EXISTE).not.toMatch(/@/)
    expect(MENSAJE_SIN_CORREO).toMatch(/soporte@theosplace\.org/)
  })
})
