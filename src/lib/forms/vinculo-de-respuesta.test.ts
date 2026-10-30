import { describe, it, expect } from 'vitest'
import { candidatoParaRespuesta, nombreDesdeRespuesta, normalizarTelefono } from './vinculo-de-respuesta'

const f = (id: string, first_name: string, last_name: string, email: string | null) => ({ id, first_name, last_name, email, cedula: null })
const FICHAS = [
  f('a', 'Hazel', 'Chavarría Chacón', 'AXCHA21@hotmail.com'),
  f('b', 'Israel', 'González', 'israel@x.com'),
  f('c', 'Israel', 'Gonzalez', 'otro@x.com'),
  f('d', 'Jhonny', 'Leandro', 'jl@x.com'),
  f('e', 'Jhonny', 'Leandro Dos', 'jl@x.com'),
]

describe('FRM-9 · candidatoParaRespuesta', () => {
  it('el correo manda, sin importar mayúsculas ni espacios', () => {
    const c = candidatoParaRespuesta({ guest_name: 'Otro Nombre', guest_email: ' axcha21@hotmail.com ' }, FICHAS)
    expect(c?.miembro.id).toBe('a'); expect(c?.motivo).toBe('correo')
  })
  it('dos fichas con el mismo correo: no se propone nada, ni por nombre', () => {
    expect(candidatoParaRespuesta({ guest_name: 'Jhonny Leandro', guest_email: 'jl@x.com' }, FICHAS)).toBeNull()
  })
  it('sin correo que coincida, nombre exacto con UNA ficha', () => {
    const c = candidatoParaRespuesta({ guest_name: 'Hazel Chavarria Chacon', guest_email: 'nuevo@x.com' }, FICHAS)
    expect(c?.miembro.id).toBe('a'); expect(c?.motivo).toBe('nombre')
  })
  it('dos fichas con el mismo nombre: nada', () => {
    expect(candidatoParaRespuesta({ guest_name: 'Israel González', guest_email: null }, FICHAS)).toBeNull()
  })
  it('sin nombre ni correo: nada', () => {
    expect(candidatoParaRespuesta({ guest_name: null, guest_email: null }, FICHAS)).toBeNull()
  })
})

describe('EVE-14 · cédula y teléfono como candidatos', () => {
  const fichas = [
    { id: 'a', first_name: 'Ana', last_name: 'Mora', email: 'ana@x.com', cedula: '1-1234-5678', phone: '+506 8888-1234' },
    { id: 'b', first_name: 'Beto', last_name: 'Mora', email: 'beto@x.com', cedula: null, phone: '88881234' },
  ]
  it('la cédula manda sobre el correo', () => {
    const c = candidatoParaRespuesta({ guest_name: 'Otro', guest_email: 'beto@x.com', guest_cedula: '112345678' }, fichas)
    expect(c).toMatchObject({ miembro: { id: 'a' }, motivo: 'cedula' })
  })
  it('teléfono: últimos 8 dígitos, con o sin +506; dos fichas iguales no proponen', () => {
    expect(normalizarTelefono('+506 8888-1234')).toBe('88881234')
    expect(candidatoParaRespuesta({ guest_name: 'X', guest_email: null, guest_phone: '8888 1234' }, fichas)).toBeNull()
    expect(candidatoParaRespuesta({ guest_name: 'X', guest_email: null, guest_phone: '8888 1234' }, [fichas[1]])?.motivo).toBe('telefono')
  })
})

describe('EVE-14 · nombreDesdeRespuesta', () => {
  it('dos palabras: nombre y apellido; tres: un nombre y dos apellidos', () => {
    expect(nombreDesdeRespuesta('Israel Gonzalez')).toEqual({ first_name: 'Israel', last_name: 'Gonzalez' })
    expect(nombreDesdeRespuesta('Hazel Chavarría Chacón')).toEqual({ first_name: 'Hazel', last_name: 'Chavarría Chacón' })
  })
  it('cuatro o más: los dos últimos son apellidos', () => {
    expect(nombreDesdeRespuesta('María José Soto Mora')).toEqual({ first_name: 'María José', last_name: 'Soto Mora' })
  })
  it('una palabra o nada: no inventa apellidos', () => {
    expect(nombreDesdeRespuesta('Juan')).toEqual({ first_name: 'Juan', last_name: '' })
    expect(nombreDesdeRespuesta('  ')).toEqual({ first_name: '', last_name: '' })
  })
})
