import { describe, it, expect } from 'vitest'
import { destinatariosDelEnvio, type Congelado } from './scheduled-recipients'

const foto: Congelado[] = [
  { member_id: 'a', channel: 'email' },
  { member_id: 'b', channel: 'email' },
]

describe('destinatariosDelEnvio', () => {
  it('con lista recalculada, manda la lista', () => {
    // El caso que importa: 'b' ya llevó el estudio y no debe recibir la
    // invitación; 'c' entró al criterio después de programarse y sí.
    const r = destinatariosDelEnvio(foto, ['a', 'c'])
    expect(r).toEqual({ ids: ['a', 'c'], fuente: 'lista', canal: 'email' })
  })
  it('sin lista, manda la foto congelada', () => {
    expect(destinatariosDelEnvio(foto, null)).toEqual({ ids: ['a', 'b'], fuente: 'foto', canal: 'email' })
  })
  it('si el recálculo da VACÍO, cae a la foto en vez de no mandar a nadie', () => {
    // Un filtro que hoy no matchea a nadie no debe convertir el envío en un
    // silencio que nadie note.
    expect(destinatariosDelEnvio(foto, [])).toMatchObject({ ids: ['a', 'b'], fuente: 'foto' })
  })
  it('hereda el canal de la foto, también para quien entra nuevo', () => {
    const wa: Congelado[] = [{ member_id: 'a', channel: 'whatsapp' }]
    expect(destinatariosDelEnvio(wa, ['a', 'z']).canal).toBe('whatsapp')
  })
  it('sin nada, no revienta', () => {
    expect(destinatariosDelEnvio([], null)).toEqual({ ids: [], fuente: 'foto', canal: 'email' })
  })
  it('descarta los member_id nulos de la foto', () => {
    expect(destinatariosDelEnvio([{ member_id: null, channel: 'email' }, ...foto], null).ids).toEqual(['a', 'b'])
  })
})
