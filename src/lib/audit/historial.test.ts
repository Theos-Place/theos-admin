import { describe, it, expect } from 'vitest'
import {
  cambiosLegibles, valorLegible, etiquetaDe, textoDeLaAccion,
  aEntradaDeHistorial, historialLegible, type FilaDeAuditoria,
} from './historial'
import { formatCRC } from '@/lib/format'

const fila = (p: Partial<FilaDeAuditoria>): FilaDeAuditoria => ({
  id: 'a', action: 'UPDATE', entity_type: 'members', created_at: '2026-09-17T21:00:00Z',
  old_data: null, new_data: null, actor_nombre: null, ...p,
})

describe('valorLegible', () => {
  it('lo vacío se DICE, no se deja en blanco', () => {
    // Una celda en blanco no distingue "se borró el dato" de "no cambió".
    for (const v of [null, undefined, '']) expect(valorLegible('email', v)).toBe('vacío')
  })

  it('sí/no en vez de true/false', () => {
    expect(valorLegible('is_active', true)).toBe('Sí')
    expect(valorLegible('is_active', false)).toBe('No')
  })

  it('el monto usa formatCRC, la fuente única del repo', () => {
    // es-CR separa los miles con ESPACIO, no con punto. Formatearlo a mano acá
    // habría dado "₡15.000" y el resto del sistema muestra "₡15 000".
    expect(valorLegible('amount', 15000)).toBe(formatCRC(15000))
    expect(valorLegible('amount', 15000)).toContain('15')
  })

  it('las fechas se leen, y NO se corren un día', () => {
    // El bug de fecha-cr: "2026-09-19" como medianoche UTC mostrada en hora CR
    // retrocede al 18.
    const t = valorLegible('birth_date', '2026-09-19')
    expect(t).toContain('19')
    expect(t).not.toContain('18')
  })

  it('un uuid se recorta: entero no le dice nada a nadie', () => {
    expect(valorLegible('group_id', 'ca5ea95b-ac49-46ec-a631-f2d1632d6cae')).toBe('#ca5ea95b')
  })

  it('el texto normal pasa tal cual', () => {
    expect(valorLegible('first_name', 'María José')).toBe('María José')
  })
})

describe('lo que era ilegible con datos reales', () => {
  it('los estados se traducen: "pendiente_de_pago" no es castellano', () => {
    expect(valorLegible('status', 'pendiente_de_pago')).toBe('Pendiente de pago')
    expect(valorLegible('review_status', 'en_revision')).toBe('En revisión')
    expect(valorLegible('status', 'paid')).toBe('Pagado')
  })

  it('un estado desconocido se muestra igual, no se esconde', () => {
    expect(valorLegible('status', 'estado_nuevo')).toBe('estado_nuevo')
  })

  it('la ruta del comprobante se resume: ocupaba tres líneas', () => {
    expect(valorLegible('receipt_path', 'cdfc1da3-d9b8-4ca3/1276213a-dd0f-4411.jpg')).toBe('adjunto')
  })

  it('created_at NO se lista: la entrada ya trae su fecha arriba', () => {
    expect(cambiosLegibles(null, { created_at: '2026-09-10', first_name: 'Ana' })
      .map(c => c.campo)).toEqual(['first_name'])
  })

  it('los tokens internos tampoco', () => {
    expect(cambiosLegibles(null, { smart_link_token: 'abc', unsubscribe_token: 'def' })).toEqual([])
  })
})

describe('etiquetas', () => {
  it('traduce los campos conocidos', () => {
    expect(etiquetaDe('birth_date')).toBe('Fecha de nacimiento')
    expect(etiquetaDe('drop_reason')).toBe('Motivo de la baja')
  })

  it('lo desconocido se muestra igual, no se esconde', () => {
    // Un campo nuevo sin etiqueta tiene que verse: esconderlo sería perder el
    // cambio justo cuando alguien lo está buscando.
    expect(etiquetaDe('campo_nuevo_x')).toBe('campo nuevo x')
  })

  it('las acciones también', () => {
    expect(textoDeLaAccion('UPDATE')).toBe('Modificó')
    expect(textoDeLaAccion('ROLE_CHANGE')).toBe('Cambió los roles')
    expect(textoDeLaAccion('COSA_RARA')).toBe('COSA_RARA')
  })
})

describe('cambiosLegibles', () => {
  it('EL CASO DE PAMELA: un traslado de grupo', () => {
    expect(cambiosLegibles({ group_id: 'aaaaaaaa-0000-4000-8000-000000000000' },
                           { group_id: 'bbbbbbbb-0000-4000-8000-000000000000' }))
      .toEqual([{ campo: 'group_id', etiqueta: 'Grupo', antes: '#aaaaaaaa', despues: '#bbbbbbbb' }])
  })

  it('EL RUIDO NO PASA: es lo que hace inservible el historial', () => {
    // sede_last_checkin sola son 19.239 filas de members en un mes, todas del
    // cron nocturno. Entre ella y search_text tapan lo que hizo una persona.
    expect(cambiosLegibles(
      { sede_last_checkin: '2026-09-01', search_text: 'a', cedula_normalized: '1', updated_at: 'x' },
      { sede_last_checkin: '2026-09-18', search_text: 'b', cedula_normalized: '2', updated_at: 'y' },
    )).toEqual([])
  })

  it('pero un cambio real acompañado de ruido SÍ se ve, sin el ruido', () => {
    const r = cambiosLegibles({ email: 'a@x.com', search_text: 'a' }, { email: 'b@x.com', search_text: 'b' })
    expect(r).toHaveLength(1)
    expect(r[0].etiqueta).toBe('Correo')
  })

  it('en un INSERT no se listan las veinte columnas vacías', () => {
    const r = cambiosLegibles(null, { first_name: 'Ana', email: null, phone: null, address: null })
    expect(r.map(c => c.etiqueta)).toEqual(['Nombre'])
    expect(r[0].despues).toBe('Ana')
  })

  it('un uuid con nombre conocido se muestra CON EL NOMBRE', () => {
    // Es la diferencia entre contestar la pregunta y no contestarla:
    // "Grupo #1a9acbce → #b89a3066" no le dice a nadie de dónde a dónde.
    const nombres = new Map([
      ['aaaaaaaa-0000-4000-8000-000000000000', 'SCJ — Oeste SJ'],
      ['bbbbbbbb-0000-4000-8000-000000000000', 'SCJ — Este SJ'],
    ])
    const [c] = cambiosLegibles(
      { group_id: 'aaaaaaaa-0000-4000-8000-000000000000' },
      { group_id: 'bbbbbbbb-0000-4000-8000-000000000000' }, nombres)
    expect(c.antes).toBe('SCJ — Oeste SJ')
    expect(c.despues).toBe('SCJ — Este SJ')
  })

  it('los campos salen en orden alfabético por su etiqueta, no por la columna', () => {
    const r = cambiosLegibles(null, { last_name: 'Mora', email: 'a@x.com', birth_date: '1990-01-01' })
    expect(r.map(c => c.etiqueta)).toEqual(['Apellidos', 'Correo', 'Fecha de nacimiento'])
  })
})

describe('aEntradaDeHistorial', () => {
  it('UN UPDATE VIEJO NO INVENTA: dice que no se sabe qué cambió', () => {
    // Hasta el 15-set el trigger no guardaba old_data y volcaba la fila entera
    // (44 claves de promedio). Pintar eso como "Correo vacío → ana@x.com"
    // afirma que el correo estaba vacío, y es falso: no se registró.
    const e = aEntradaDeHistorial(fila({
      action: 'UPDATE', old_data: null,
      new_data: { email: 'ana@x.com', first_name: 'Ana', last_name: 'Mora' },
    }))
    expect(e?.sinDetalle).toBe(true)
    expect(e?.cambios).toEqual([])
  })

  it('una creación no tiene "antes"', () => {
    // "vacío → Ana" se lee como si el nombre hubiera estado en blanco antes de
    // que la ficha existiera.
    const e = aEntradaDeHistorial(fila({ action: 'INSERT', new_data: { first_name: 'Ana' } }))
    expect(e?.cambios).toEqual([{ campo: 'first_name', etiqueta: 'Nombre', antes: '', despues: 'Ana' }])
  })

  it('y un borrado no tiene "después"', () => {
    const e = aEntradaDeHistorial(fila({ action: 'DELETE', old_data: { first_name: 'Ana' } }))
    expect(e?.cambios[0]).toEqual({ campo: 'first_name', etiqueta: 'Nombre', antes: 'Ana', despues: '' })
  })

  it('un UPDATE que solo movió ruido NO se muestra', () => {
    expect(aEntradaDeHistorial(fila({
      old_data: { sede_last_checkin: 'a' }, new_data: { sede_last_checkin: 'b' },
    }))).toBeNull()
  })

  it('un DELETE sin datos SÍ se muestra: que se borró algo es información', () => {
    const e = aEntradaDeHistorial(fila({ action: 'DELETE', old_data: null, new_data: null }))
    expect(e).not.toBeNull()
    expect(e?.queHizo).toBe('Eliminó')
  })

  it('sin actor, quien queda en null y lo resuelve la pantalla', () => {
    const e = aEntradaDeHistorial(fila({ action: 'DELETE' }))
    expect(e?.quien).toBeNull()
  })

  it('con actor, lo conserva', () => {
    const e = aEntradaDeHistorial(fila({ action: 'DELETE', actor_nombre: 'Ana Mora' }))
    expect(e?.quien).toBe('Ana Mora')
  })
})

describe('historialLegible', () => {
  it('filtra el ruido y conserva el orden que venía', () => {
    const r = historialLegible([
      fila({ id: '1', old_data: { email: 'a' }, new_data: { email: 'b' } }),
      fila({ id: '2', old_data: { search_text: 'a' }, new_data: { search_text: 'b' } }),
      fila({ id: '3', action: 'INSERT', new_data: { first_name: 'Ana' } }),
    ])
    expect(r.map(e => e.id)).toEqual(['1', '3'])
  })

  it('una lista vacía no revienta', () => {
    expect(historialLegible([])).toEqual([])
  })
})
