// Programación de comunicados: la hora elegida es la de SU zona, no la del navegador.
import { describe, it, expect } from 'vitest'
import {
  zonedToUtc, resolveScheduledAt, isBroadcastDue, scheduleSummary, SCHEDULED_STATUS,
  SCHEDULE_MESSAGES, TICK_MINUTES, esHoraEnPunto,
  partesDeLaProgramacion, componerProgramacion, HORAS_EN_PUNTO,
} from './schedule'

describe('de hora local + zona a instante', () => {
  it('Costa Rica no tiene horario de verano: siempre -6', () => {
    expect(zonedToUtc('2026-08-10T15:30', 'America/Costa_Rica')).toBe('2026-08-10T21:30:00.000Z')
    expect(zonedToUtc('2026-01-10T15:30', 'America/Costa_Rica')).toBe('2026-01-10T21:30:00.000Z')
  })

  it('EL CASO QUE IMPORTA: Madrid cambia de +1 a +2 con el horario de verano', () => {
    // Agosto: CEST (+2) → las 15:30 de Madrid son las 13:30 UTC.
    expect(zonedToUtc('2026-08-10T15:30', 'Europe/Madrid')).toBe('2026-08-10T13:30:00.000Z')
    // Enero: CET (+1) → las 15:30 son las 14:30 UTC. Un offset fijo fallaría acá.
    expect(zonedToUtc('2026-01-10T15:30', 'Europe/Madrid')).toBe('2026-01-10T14:30:00.000Z')
  })

  it('el este de EE.UU. también cambia', () => {
    expect(zonedToUtc('2026-08-10T09:00', 'America/New_York')).toBe('2026-08-10T13:00:00.000Z')
    expect(zonedToUtc('2026-01-10T09:00', 'America/New_York')).toBe('2026-01-10T14:00:00.000Z')
  })

  it('medianoche no se corre de día', () => {
    expect(zonedToUtc('2026-08-10T00:00', 'America/Costa_Rica')).toBe('2026-08-10T06:00:00.000Z')
  })

  it('texto que no es fecha no revienta', () => {
    expect(zonedToUtc('', 'America/Costa_Rica')).toBeNull()
    expect(zonedToUtc('mañana', 'America/Costa_Rica')).toBeNull()
  })
})

describe('validación de lo que eligió el usuario', () => {
  const ahora = new Date('2026-08-10T12:00:00.000Z')

  it('una hora futura pasa y devuelve el instante', () => {
    // En punto: desde 2026-09-17 los envíos van a la hora exacta (ver el bloque
    // de abajo). Antes este caso usaba 15:30.
    const r = resolveScheduledAt('2026-08-10T15:00', 'America/Costa_Rica', ahora)
    expect(r).toEqual({ ok: true, iso: '2026-08-10T21:00:00.000Z' })
  })

  it('una hora que YA PASÓ se rechaza: si no, saldría de inmediato', () => {
    const r = resolveScheduledAt('2026-08-10T05:00', 'America/Costa_Rica', ahora)
    expect(r).toEqual({ ok: false, error: 'en_el_pasado' })
  })

  it('sin fecha, con el toggle encendido, se avisa', () => {
    expect(resolveScheduledAt('', 'America/Costa_Rica', ahora))
      .toEqual({ ok: false, error: 'sin_fecha' })
  })

  it('la próxima hora en punto SÍ se acepta, aunque falte poco', () => {
    // La intención original era "programar algo cercano es legítimo". Con el
    // tick en una hora, lo cercano es la siguiente hora en punto: no se exige
    // margen, solo que no haya pasado.
    const r = resolveScheduledAt('2026-08-10T07:00', 'America/Costa_Rica', ahora)
    expect(r.ok).toBe(true)
  })
})

describe('a quién le toca salir', () => {
  const ahora = new Date('2026-08-10T12:00:00.000Z')

  it('vencido, sí', () => {
    expect(isBroadcastDue({ status: SCHEDULED_STATUS, scheduled_at: '2026-08-10T11:59:00Z' }, ahora)).toBe(true)
  })

  it('ATRASADO también: si un barrido falla, el siguiente lo recoge', () => {
    expect(isBroadcastDue({ status: SCHEDULED_STATUS, scheduled_at: '2026-08-09T00:00:00Z' }, ahora)).toBe(true)
  })

  it('todavía no, no', () => {
    expect(isBroadcastDue({ status: SCHEDULED_STATUS, scheduled_at: '2026-08-10T12:01:00Z' }, ahora)).toBe(false)
  })

  it('un borrador o uno ya enviado NUNCA salen por acá', () => {
    expect(isBroadcastDue({ status: 'draft', scheduled_at: '2026-08-01T00:00:00Z' }, ahora)).toBe(false)
    expect(isBroadcastDue({ status: 'sent', scheduled_at: '2026-08-01T00:00:00Z' }, ahora)).toBe(false)
    expect(isBroadcastDue({ status: SCHEDULED_STATUS, scheduled_at: null }, ahora)).toBe(false)
  })
})

describe('lo que se le muestra a quien programa', () => {
  it('se lee en SU zona, no en UTC', () => {
    const t = scheduleSummary('2026-08-10T13:30:00.000Z', 'Europe/Madrid')
    expect(t).toContain('3:30')
    expect(t).toContain('Madrid')
  })
})

describe('los envíos van en horas en punto (2026-09-17)', () => {
  // El cron pasó de cada 15 min a cada hora: era el 90% de las corridas
  // programadas del sistema y despertaba a buscar trabajo que casi nunca hay.
  // Con eso, ofrecer minutos sería prometer una precisión que no existe.
  const futuro = (hhmm: string) => `2099-08-10T${hhmm}`

  it('acepta una hora en punto', () => {
    expect(resolveScheduledAt(futuro('15:00'), 'America/Costa_Rica').ok).toBe(true)
  })

  it('rechaza cualquier minuto que no sea cero', () => {
    for (const hhmm of ['15:30', '15:01', '15:59', '00:15']) {
      const r = resolveScheduledAt(futuro(hhmm), 'America/Costa_Rica')
      expect(r.ok, hhmm).toBe(false)
      if (!r.ok) expect(r.error).toBe('minutos_no_cero')
    }
  })

  it('NO redondea en silencio', () => {
    // Mover el envío sin avisar es peor que pedir que elijan otra hora.
    const r = resolveScheduledAt(futuro('15:30'), 'America/Costa_Rica')
    expect(r.ok).toBe(false)
  })

  it('el mensaje dice qué hacer, no solo que está mal', () => {
    expect(SCHEDULE_MESSAGES.minutos_no_cero).toMatch(/hora exacta|en punto/i)
  })

  it('el tick coincide con el cron: una hora', () => {
    // Si alguien cambia vercel.json sin tocar esto, la pantalla mentiría.
    expect(TICK_MINUTES).toBe(60)
  })

  it('esHoraEnPunto no se confunde con basura', () => {
    for (const v of ['', 'hola', '2099-08-10', '2099-08-10T15']) expect(esHoraEnPunto(v), v).toBe(false)
  })
})

describe('la pantalla solo ofrece horas en punto (2026-09-18)', () => {
  // `datetime-local step=3600` NO alcanza: comprobado en el navegador, el campo
  // dibuja los minutos, acepta "15:37" y solo protesta al enviar, en inglés.
  it('parte un valor guardado en día y hora', () => {
    expect(partesDeLaProgramacion('2026-09-20T15:00')).toEqual({ dia: '2026-09-20', hora: '15' })
  })

  it('un valor vacío o raro no revienta', () => {
    for (const v of ['', null, undefined, 'mañana', '2026-09-20']) {
      expect(partesDeLaProgramacion(v as string)).toEqual({ dia: '', hora: '' })
    }
  })

  it('compone siempre con los minutos en cero', () => {
    expect(componerProgramacion('2026-09-20', '15')).toBe('2026-09-20T15:00')
    expect(componerProgramacion('2026-09-20', '00')).toBe('2026-09-20T00:00')
  })

  it('MEDIA SELECCIÓN NO ES UNA FECHA: devuelve vacío, no algo inválido', () => {
    // Mandar "2026-09-20T:00" haría fallar la validación con un mensaje que no
    // explica nada; con '' el formulario dice "elegí la fecha y la hora".
    expect(componerProgramacion('2026-09-20', '')).toBe('')
    expect(componerProgramacion('', '15')).toBe('')
  })

  it('ida y vuelta: lo que se parte se vuelve a componer igual', () => {
    const v = '2026-09-20T08:00'
    const { dia, hora } = partesDeLaProgramacion(v)
    expect(componerProgramacion(dia, hora)).toBe(v)
  })

  it('las 24 horas, y TODAS pasan la validación de hora en punto', () => {
    expect(HORAS_EN_PUNTO).toHaveLength(24)
    for (const h of HORAS_EN_PUNTO) {
      expect(esHoraEnPunto(componerProgramacion('2099-01-01', h.valor)), h.valor).toBe(true)
    }
  })

  it('las etiquetas se leen en español', () => {
    expect(HORAS_EN_PUNTO[0].etiqueta).toMatch(/12:00/)
    expect(HORAS_EN_PUNTO[15].etiqueta).toMatch(/3:00/)
  })
})
