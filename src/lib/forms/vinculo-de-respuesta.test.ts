import { describe, it, expect } from 'vitest'
import { candidatoParaRespuesta } from './vinculo-de-respuesta'

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
