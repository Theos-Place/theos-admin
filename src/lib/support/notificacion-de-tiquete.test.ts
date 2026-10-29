import { describe, it, expect } from 'vitest'
import { destinatariosDeTiquete, notificacionDeTiquete } from './notificacion-de-tiquete'

const fila = (member_id: string, role: string, o: Partial<{ role_active: boolean; member_active: boolean }> = {}) =>
  ({ member_id, role, role_active: true, member_active: true, ...o })

describe('SOP-3 · destinatariosDeTiquete', () => {
  it('admin y soporte técnico activos, sin repetir a quien tiene los dos', () => {
    expect(destinatariosDeTiquete([fila('a', 'admin'), fila('b', 'soporte_tecnico'), fila('a', 'soporte_tecnico')]).sort())
      .toEqual(['a', 'b'])
  })
  it('otros roles no reciben nada', () => {
    expect(destinatariosDeTiquete([fila('c', 'direccion'), fila('d', 'encargado_eventos')])).toEqual([])
  })
  it('rol inactivo o persona inactiva quedan fuera', () => {
    expect(destinatariosDeTiquete([fila('a', 'admin', { role_active: false }), fila('b', 'soporte_tecnico', { member_active: false })])).toEqual([])
  })
  it('a quien levantó el tiquete no se le avisa de lo que acaba de hacer', () => {
    expect(destinatariosDeTiquete([fila('a', 'admin'), fila('b', 'admin')], { excludeMemberId: 'a' })).toEqual(['b'])
  })
})

describe('SOP-3 · notificacionDeTiquete', () => {
  it('dice quién, dónde y el principio del detalle, con link a la cola', () => {
    const n = notificacionDeTiquete({ member_name: 'Raquel Otárola', reason: 'A María le sale otra familia.', event_title: 'Charla Pedregal' })
    expect(n).toEqual({
      type: 'support_ticket_new', title: 'Nuevo tiquete de soporte',
      body: 'Raquel Otárola (Charla Pedregal): A María le sale otra familia.', link: '/soporte',
    })
  })
  it('recorta un detalle largo', () => {
    const n = notificacionDeTiquete({ member_name: 'X', reason: 'a'.repeat(300) })
    expect(n.body.length).toBeLessThanOrEqual(3 + 140)
    expect(n.body.endsWith('…')).toBe(true)
  })
})
