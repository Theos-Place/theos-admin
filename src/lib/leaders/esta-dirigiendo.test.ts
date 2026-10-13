import { describe, it, expect } from 'vitest'
import { disponibilidadEfectiva, ocupaAlDirigente } from './esta-dirigiendo'

const activo = { estado_base: 'activo', disponibilidad: 'disponible', razon_no_disponible: null }

describe('DIR-8 · «dirigiendo» se deriva de tener grupo', () => {
  it('un disponible CON grupo pasa a no disponible · dirigiendo', () => {
    // El caso medido: 116 personas con grupo en curso figuraban como
    // disponibles, y ese número se usa para repartir grupos nuevos.
    const r = disponibilidadEfectiva({ estado: activo, dirigiendo: true })
    expect(r).toEqual({ disponibilidad: 'no_disponible', razonNoDisponible: 'dirigiendo', derivada: true })
  })

  it('un disponible SIN grupo se queda disponible', () => {
    const r = disponibilidadEfectiva({ estado: activo, dirigiendo: false })
    expect(r.disponibilidad).toBe('disponible')
    expect(r.derivada).toBe(false)
  })

  it('lo que coordinación eligió GANA sobre la derivación', () => {
    // «En pausa» con un grupo asignado es raro, pero es una decisión que
    // alguien tomó y pisarla sería borrarla sin avisar.
    for (const razon of ['pausa', 'pasantia', 'en_formacion', 'estudiante_capacitacion']) {
      const r = disponibilidadEfectiva({
        estado: { estado_base: 'activo', disponibilidad: 'no_disponible', razon_no_disponible: razon },
        dirigiendo: true,
      })
      expect(r.razonNoDisponible, razon).toBe(razon)
      expect(r.derivada).toBe(false)
    }
  })

  it('un INACTIVO no tiene disponibilidad, tenga grupo o no', () => {
    const r = disponibilidadEfectiva({
      estado: { estado_base: 'inactivo', disponibilidad: null, razon_no_disponible: null },
      dirigiendo: true,
    })
    expect(r.disponibilidad).toBeNull()
  })

  it('marca cuáles vienen derivadas, para poder decirlo en pantalla', () => {
    // La ficha necesita distinguir «lo puso coordinación» de «lo calculó el
    // sistema»: lo segundo cambia solo cuando el grupo cierra.
    expect(disponibilidadEfectiva({ estado: activo, dirigiendo: true }).derivada).toBe(true)
    expect(disponibilidadEfectiva({ estado: activo, dirigiendo: false }).derivada).toBe(false)
  })
})

describe('qué grupos ocupan al dirigente', () => {
  it('el PREMATRIMONIAL no ocupa', () => {
    // Decisión de DIR-8: son mentores que acompañan a una pareja, no un
    // grupo que llene la agenda, y hay quien da varios a la vez.
    expect(ocupaAlDirigente('PREMAT')).toBe(false)
  })

  it('los demás sí', () => {
    for (const c of ['N1', 'N2', 'DIS1', 'SCJ', 'CDEB', 'PAN']) {
      expect(ocupaAlDirigente(c), c).toBe(true)
    }
  })

  it('sin plan no ocupa: no se asume', () => {
    expect(ocupaAlDirigente(null)).toBe(false)
    expect(ocupaAlDirigente(undefined)).toBe(false)
  })
})
