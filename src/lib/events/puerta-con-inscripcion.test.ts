import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  buscarInvitados, conteosDeLaPuerta, estadoDeInscripcion, llegaronSinInscripcion, normalizarNombre,
  origenDeCheckin, sugerirVinculo, textoDeConteos,
} from './puerta-con-inscripcion'

const INVITADOS = [
  { id: 'r1', nombre: 'Hazel Chavarría Chacón', email: 'h@x.com' },
  { id: 'r2', nombre: 'Israel Gonzalez', email: null },
  { id: 'r3', nombre: 'Jhonny Leandro', email: 'j@x.com' },
]

describe('EVE-15 · estadoDeInscripcion', () => {
  const inscritos = [{ member_id: 'm1' }]
  it('inscrito / no inscrito cuando el evento pide inscripción', () => {
    expect(estadoDeInscripcion({ requires_registration: true }, 'm1', inscritos).estado).toBe('inscrito')
    expect(estadoDeInscripcion({ requires_registration: true }, 'm2', inscritos).estado).toBe('no_inscrito')
  })
  it('no aplica en una charla sin inscripción: nada que avisar', () => {
    expect(estadoDeInscripcion({ requires_registration: false }, 'm2', inscritos).estado).toBe('no_aplica')
  })
})

describe('EVE-15 · buscarInvitados', () => {
  it('encuentra por nombre sin tildes ni mayúsculas', () => {
    expect(buscarInvitados(INVITADOS, 'chavarria').map(i => i.id)).toEqual(['r1'])
    expect(buscarInvitados(INVITADOS, 'GONZÁLEZ').map(i => i.id)).toEqual(['r2'])
  })
  it('con menos de dos letras no busca', () => {
    expect(buscarInvitados(INVITADOS, 'j')).toEqual([])
  })
  it('normalizarNombre colapsa espacios', () => {
    expect(normalizarNombre('  Ana   María ')).toBe('ana maria')
  })
})

describe('EVE-15 · sugerirVinculo', () => {
  const miembros = [{ id: 'a', name: 'Israel González' }, { id: 'b', name: 'Israel Gonzalez' }, { id: 'c', name: 'Hazel Chavarria Chacon' }]
  it('sugiere cuando hay exactamente una ficha con el mismo nombre', () => {
    expect(sugerirVinculo(INVITADOS[0], miembros)?.id).toBe('c')
  })
  it('con dos fichas iguales no sugiere nada (no se adivina)', () => {
    expect(sugerirVinculo(INVITADOS[1], miembros)).toBeNull()
  })
  it('sin coincidencia, null', () => {
    expect(sugerirVinculo(INVITADOS[2], miembros)).toBeNull()
  })
})

describe('EVE-15 · conteosDeLaPuerta', () => {
  const inscritos = [{ member_id: 'm1' }, { member_id: 'm2' }]
  it('presentes, ausentes y sin inscripción, con ficha y por el link', () => {
    const c = conteosDeLaPuerta({
      inscritos, invitados: INVITADOS,
      checkins: [
        { member_id: 'm1' },                         // inscrito presente
        { form_response_id: 'r2' },                  // invitado presente
        { member_id: 'm9', sin_inscripcion: true },  // llegó sin inscripción
        { member_id: 'm8' },                         // fila vieja sin flag: igual cuenta
      ],
    })
    expect(c).toEqual({ inscritos: 5, presentes: 2, ausentes: 3, sinInscripcion: 2 })
    expect(textoDeConteos(c)).toBe('2 de 5 inscritos presentes · 2 sin inscripción')
  })
  it('una persona con dos check-ins cuenta una vez', () => {
    const c = conteosDeLaPuerta({ inscritos, invitados: [], checkins: [{ member_id: 'm1' }, { member_id: 'm1' }] })
    expect(c.presentes).toBe(1)
  })
  it('sin nadie sin inscripción el texto no lo menciona', () => {
    expect(textoDeConteos({ inscritos: 3, presentes: 0, ausentes: 3, sinInscripcion: 0 })).toBe('0 de 3 inscritos presentes')
  })
})

describe('EVE-15 · origenDeCheckin y llegaronSinInscripcion', () => {
  const inscritos = [{ member_id: 'm1' }]
  const ids = new Set(['m1'])
  it('distingue inscrito, por el link y sin inscripción', () => {
    expect(origenDeCheckin({ member_id: 'm1' }, ids)).toBe('inscrito')
    expect(origenDeCheckin({ form_response_id: 'r1' }, ids)).toBe('por_el_link')
    expect(origenDeCheckin({ member_id: 'm9', sin_inscripcion: true }, ids)).toBe('sin_inscripcion')
    expect(origenDeCheckin({ member_id: 'm9' }, ids)).toBe('sin_inscripcion') // fila vieja sin flag
  })
  it('un invitado ya vinculado a su ficha cuenta como inscrito (su check-in viajó con él)', () => {
    expect(origenDeCheckin({ member_id: 'm9', form_response_id: 'r1' }, ids)).toBe('inscrito')
  })
  it('la lista del evento trae solo los que llegaron sin inscripción', () => {
    const lista = llegaronSinInscripcion([
      { member_id: 'm1' }, { form_response_id: 'r1' }, { member_id: 'm9', sin_inscripcion: true },
    ], inscritos)
    expect(lista).toEqual([{ member_id: 'm9', sin_inscripcion: true }])
  })
})

describe('EVE-15 · la migración', () => {
  const sql = readFileSync('supabase/migrations/20261029150000_eve15_checkin_sin_inscripcion.sql', 'utf8')
  it('agrega las dos columnas y el check-in sigue a la ficha por disparador', () => {
    expect(sql).toContain('add column if not exists form_response_id')
    expect(sql).toContain('add column if not exists sin_inscripcion boolean not null default false')
    expect(sql).toContain('after update of member_id on public.form_responses')
  })
  it('la función queda cerrada al público (SEC-3)', () => {
    expect(sql).toMatch(/revoke execute on function public\.eve15_checkin_sigue_a_la_ficha\(\) from public, anon, authenticated/)
    expect(sql).toMatch(/set search_path to 'public'/)
  })
})
