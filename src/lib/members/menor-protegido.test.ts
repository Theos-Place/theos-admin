import { describe, it, expect } from 'vitest'
import {
  motivoQueImpideCrear, fichaDeMenorProtegido, puedeTenerCuenta, edadEnAnios,
  CAMPOS_MENOR_PROTEGIDO,
} from './menor-protegido'

const HOY = new Date('2026-09-10T12:00:00Z')
const ok = { first_name: 'Mateo', last_name: 'Ruiz', birth_date: '2018-04-02' }
const crear = (datos: Record<string, unknown>, familiarId: string | null = 'mama') =>
  motivoQueImpideCrear({ datos, familiarId, hoy: HOY })

describe('qué se guarda de un menor protegido', () => {
  it('son tres campos y solo tres', () => {
    expect([...CAMPOS_MENOR_PROTEGIDO]).toEqual(['first_name', 'last_name', 'birth_date'])
  })

  it('la ficha se arma con esos tres, aunque llegue más', () => {
    expect(fichaDeMenorProtegido({ ...ok, email: 'x@y.cr', cedula: '123', notas: 'algo' }))
      .toEqual({ first_name: 'Mateo', last_name: 'Ruiz', birth_date: '2018-04-02', datos_protegidos: true, is_active: true })
  })

  it('recorta los espacios', () => {
    expect(fichaDeMenorProtegido({ first_name: '  Ana ', last_name: ' Paz ', birth_date: '2019-01-01' }).first_name)
      .toBe('Ana')
  })
})

describe('motivoQueImpideCrear', () => {
  it('con nombre, fecha y familiar se puede', () => {
    expect(crear(ok)).toBeNull()
  })

  it('un correo o una cédula lo frenan, y dice cuáles', () => {
    const r = crear({ ...ok, email: 'nino@x.cr', cedula: '112233' })
    expect(r?.code).toBe('campo_prohibido')
    if (r?.code === 'campo_prohibido') expect(r.campos.sort()).toEqual(['cedula', 'email'])
  })

  it('un campo prohibido VACÍO no molesta: la pantalla manda cadenas vacías', () => {
    expect(crear({ ...ok, email: '', phone: null })).toBeNull()
  })

  it('sin nombre no se puede: hay que poder llamarlo', () => {
    expect(crear({ ...ok, first_name: '  ', last_name: '' })?.code).toBe('falta_nombre')
  })

  it('sin fecha tampoco: sin ella no se sabe que es menor', () => {
    expect(crear({ ...ok, birth_date: '' })?.code).toBe('falta_fecha')
  })

  it('una fecha rara se rechaza en vez de guardarse', () => {
    expect(crear({ ...ok, birth_date: '2 de abril' })?.code).toBe('fecha_invalida')
  })

  it('una persona ADULTA no entra por esta puerta', () => {
    const r = crear({ ...ok, birth_date: '1990-04-02' })
    expect(r?.code).toBe('no_es_menor')
    expect(r?.mensaje).toContain('36 años')
  })

  it('el que cumple 18 hoy ya no es menor', () => {
    expect(crear({ ...ok, birth_date: '2008-09-10' })?.code).toBe('no_es_menor')
  })

  it('el que los cumple mañana todavía sí', () => {
    expect(crear({ ...ok, birth_date: '2008-09-11' })).toBeNull()
  })

  it('sin familiar no se crea: una ficha de menor no queda sola', () => {
    const r = crear(ok, null)
    expect(r?.code).toBe('sin_familia')
    expect(r?.mensaje).toContain('no puede quedar sola')
  })
})

describe('edadEnAnios', () => {
  it('cuenta el cumpleaños que todavía no llegó', () => {
    expect(edadEnAnios('2018-12-31', HOY)).toBe(7)
    expect(edadEnAnios('2018-01-01', HOY)).toBe(8)
  })
})

describe('puedeTenerCuenta', () => {
  it('un menor protegido NUNCA', () => {
    expect(puedeTenerCuenta({ datos_protegidos: true })).toBe(false)
  })
  it('cualquier otra ficha sí', () => {
    expect(puedeTenerCuenta({ datos_protegidos: false })).toBe(true)
    expect(puedeTenerCuenta({})).toBe(true)
  })
})
