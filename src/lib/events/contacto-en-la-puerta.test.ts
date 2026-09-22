import { describe, it, expect } from 'vitest'
import {
  pedirContacto, faltaAlgunContacto, avisoDeContacto, puedeGuardar, encolarPendientes,
} from './contacto-en-la-puerta'

const HOY = '2026-09-22'
const adulta = { birth_date: '1990-01-01' }
const menor = { birth_date: '2012-01-01' }

describe('a quién se le pide', () => {
  it('a la adulta sin correo, sí', () => {
    expect(pedirContacto({ ...adulta, email: null, phone: '8888' }, HOY))
      .toEqual({ email: true, phone: false })
  })

  it('si ya tiene los dos, no se pide nada', () => {
    expect(faltaAlgunContacto({ ...adulta, email: 'a@b.com', phone: '8888' }, HOY)).toBe(false)
  })

  it('un campo en blanco cuenta como vacío', () => {
    expect(pedirContacto({ ...adulta, email: '   ', phone: '' }, HOY))
      .toEqual({ email: true, phone: true })
  })

  it('AL MENOR NUNCA — es la regla de FAM-2, no un detalle de pantalla', () => {
    expect(pedirContacto({ ...menor, email: null, phone: null }, HOY))
      .toEqual({ email: false, phone: false })
  })

  it('SIN FECHA DE NACIMIENTO tampoco: no sabemos si es menor', () => {
    // Más estricto que el resto del sistema a propósito. Son 3.260 fichas así,
    // y capturarle el correo propio a un chico de 15 es justo lo que no se
    // quiere. Si esto se afloja alguna vez, que sea a sabiendas.
    expect(pedirContacto({ birth_date: null, email: null, phone: null }, HOY))
      .toEqual({ email: false, phone: false })
  })

  it('con datos protegidos tampoco', () => {
    expect(pedirContacto({ ...adulta, datos_protegidos: true, email: null }, HOY))
      .toEqual({ email: false, phone: false })
  })

  it('el día que cumple 18 ya se le pide', () => {
    expect(pedirContacto({ birth_date: '2008-09-22', email: null }, HOY).email).toBe(true)
    // Y el día antes todavía no.
    expect(pedirContacto({ birth_date: '2008-09-23', email: null }, HOY).email).toBe(false)
  })
})

describe('el aviso', () => {
  it('nombra el correo primero: es el que destraba la cuenta', () => {
    expect(avisoDeContacto('Camila', { ...adulta, email: null, phone: '8888' }, HOY))
      .toContain('no tiene correo registrado')
  })

  it('si faltan los dos lo dice en una sola frase', () => {
    const a = avisoDeContacto('Camila', { ...adulta, email: null, phone: null }, HOY)
    expect(a).toBe('Camila no tiene correo ni teléfono registrados — aprovechá y pedíselos.')
  })

  it('sin nada que pedir, no hay aviso', () => {
    expect(avisoDeContacto('Camila', { ...adulta, email: 'a@b.com', phone: '8' }, HOY)).toBeNull()
  })
})

describe('puedeGuardar · la decisión del servidor', () => {
  it('deja llenar un campo vacío de una adulta', () => {
    expect(puedeGuardar({ ...adulta, email: null }, 'email', 'c@theos.org', HOY))
      .toEqual({ ok: true })
  })

  it('NO PISA un valor que ya existe', () => {
    expect(puedeGuardar({ ...adulta, email: 'viejo@x.com' }, 'email', 'nuevo@x.com', HOY))
      .toEqual({ ok: false, motivo: 'campo_ya_tiene_valor' })
  })

  it('a un menor no lo deja aunque el campo esté vacío', () => {
    // El guard tiene que estar ACÁ y no solo en la pantalla: quien tenga el
    // endpoint puede mandar cualquier member_id.
    expect(puedeGuardar({ ...menor, email: null }, 'email', 'c@x.com', HOY))
      .toEqual({ ok: false, motivo: 'no_se_le_pide' })
  })

  it('sin fecha de nacimiento tampoco', () => {
    expect(puedeGuardar({ birth_date: null, email: null }, 'email', 'c@x.com', HOY))
      .toEqual({ ok: false, motivo: 'no_se_le_pide' })
  })

  it('un valor vacío no es un guardado', () => {
    expect(puedeGuardar({ ...adulta, email: null }, 'email', '   ', HOY))
      .toEqual({ ok: false, motivo: 'vacio' })
  })
})

describe('encolarPendientes', () => {
  const p = (id: string, email = true) => ({ id, name: id, pedir: { email, phone: false } })

  it('agrega al final: se atiende en el orden en que pasaron por la puerta', () => {
    expect(encolarPendientes([p('a')], [p('b'), p('c')]).map(x => x.id))
      .toEqual(['a', 'b', 'c'])
  })

  it('no encola a quien no hay nada que pedirle', () => {
    expect(encolarPendientes([], [{ id: 'a', name: 'A', pedir: { email: false, phone: false } }]))
      .toEqual([])
  })

  it('no repite a quien ya está en la cola', () => {
    // Con el QR es fácil escanear dos veces a la misma persona.
    expect(encolarPendientes([p('a')], [p('a')]).map(x => x.id)).toEqual(['a'])
  })

  it('tampoco repite dentro del mismo lote', () => {
    expect(encolarPendientes([], [p('a'), p('a')]).map(x => x.id)).toEqual(['a'])
  })

  it('devuelve el MISMO array si no hay nada que agregar', () => {
    // Para no provocar un render por cada check-in de alguien con sus datos.
    const actual = [p('a')]
    expect(encolarPendientes(actual, [])).toBe(actual)
    expect(encolarPendientes(actual, [p('a')])).toBe(actual)
  })

  it('una familia de cuatro entra completa', () => {
    const familia = [p('mama'), p('papa'), p('hijo1'), p('hijo2')]
    expect(encolarPendientes([], familia)).toHaveLength(4)
  })
})
