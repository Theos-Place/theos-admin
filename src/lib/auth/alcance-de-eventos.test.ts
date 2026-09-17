import { describe, it, expect } from 'vitest'
import { alcanceDeEventos, puedeOperarEvento, type AlcanceDeEventos } from './alcance-de-eventos'
import type { RoleId } from '@/types/auth'

const COMITE_ALAJUELA = 'c-alajuela'
const COMITE_CARTAGO = 'c-cartago'

const alcance = (
  roles: RoleId[], rolesAutomaticos: RoleId[] = [], comitesDeSusPuestos: string[] = [],
) => alcanceDeEventos({ roles, rolesAutomaticos, comitesDeSusPuestos })

describe('alcanceDeEventos', () => {
  it('EL CASO DE EVE-12: el rol que llegó por el puesto queda en sus comités', () => {
    expect(alcance(['encargado_eventos'], ['encargado_eventos'], [COMITE_ALAJUELA]))
      .toEqual({ alcance: 'comites', comites: [COMITE_ALAJUELA] })
  })

  it('el mismo rol puesto A MANO sigue abriendo todo', () => {
    // Son 9 personas en producción; no se les toca nada.
    expect(alcance(['encargado_eventos'], [], [COMITE_ALAJUELA])).toEqual({ alcance: 'todos' })
  })

  it('dirección y admin no se acotan nunca', () => {
    for (const r of ['direccion', 'admin', 'comunicaciones', 'encargado_staff'] as RoleId[]) {
      expect(alcance([r], [r], []), r).toEqual({ alcance: 'todos' })
    }
  })

  it('sin el módulo de eventos, ninguno', () => {
    expect(alcance(['miembro'])).toEqual({ alcance: 'ninguno' })
    expect(alcance([])).toEqual({ alcance: 'ninguno' })
  })

  it('un rol MANUAL de eventos le gana al automático, no se recorta', () => {
    // Quien tiene el rol por su puesto de bienvenida Y además se lo dieron a
    // mano para otra cosa: lo manual manda.
    expect(alcance(['encargado_eventos', 'comunicaciones'], ['encargado_eventos'], [COMITE_ALAJUELA]))
      .toEqual({ alcance: 'todos' })
  })

  it('con el rol por puesto pero sin ningún comité activo, no alcanza nada', () => {
    // No es un bug: si se le dio de baja de todos sus puestos, el rol se le cae
    // solo en el siguiente sync. Mientras tanto no opera nada.
    expect(alcance(['encargado_eventos'], ['encargado_eventos'], []))
      .toEqual({ alcance: 'comites', comites: [] })
  })

  it('los comités repetidos no se duplican', () => {
    // Dos puestos en la misma sede son un comité, no dos.
    expect(alcance(['encargado_eventos'], ['encargado_eventos'], [COMITE_ALAJUELA, COMITE_ALAJUELA]))
      .toEqual({ alcance: 'comites', comites: [COMITE_ALAJUELA] })
  })
})

describe('puedeOperarEvento', () => {
  const suyo: AlcanceDeEventos = { alcance: 'comites', comites: [COMITE_ALAJUELA] }

  it('su comité organiza el evento: sí', () => {
    expect(puedeOperarEvento(suyo, [COMITE_ALAJUELA])).toBe(true)
  })

  it('basta con que UNO de los organizadores sea suyo', () => {
    expect(puedeOperarEvento(suyo, [COMITE_CARTAGO, COMITE_ALAJUELA])).toBe(true)
  })

  it('el evento de otra sede: no', () => {
    expect(puedeOperarEvento(suyo, [COMITE_CARTAGO])).toBe(false)
  })

  it('UN EVENTO SIN COMITÉ le queda cerrado, a propósito', () => {
    // Sin la etiqueta no hay forma de saber si es suyo. Se arregla asignándole
    // comité al evento, no aflojando la regla.
    expect(puedeOperarEvento(suyo, [])).toBe(false)
  })

  it("'todos' opera hasta lo que no tiene comité", () => {
    expect(puedeOperarEvento({ alcance: 'todos' }, [])).toBe(true)
  })

  it("'ninguno' no opera ni su propio comité", () => {
    expect(puedeOperarEvento({ alcance: 'ninguno' }, [COMITE_ALAJUELA])).toBe(false)
  })
})
