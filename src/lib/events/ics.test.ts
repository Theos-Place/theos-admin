import { describe, it, expect } from 'vitest'
import { armarIcs, escaparTexto, plegar, fechaIcs, uidDe, linksDeSuscripcion } from './ics'
import { eventsInRange } from './event-views'
import type { AdminEvent } from '@/data/event-config'

const AHORA = new Date('2026-10-15T12:00:00Z')
const BASE = 'https://admin.theosplace.org'

describe('formato', () => {
  it('las horas van en UTC, sin milisegundos', () => {
    // 19:00 en Costa Rica = 01:00 UTC del día siguiente
    expect(fechaIcs('2026-10-21T01:00:00.000Z')).toBe('20261021T010000Z')
  })

  it('escapa coma, punto y coma, barra y saltos', () => {
    expect(escaparTexto('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne')
  })

  it('pliega a 75 octetos sin partir una tilde', () => {
    const larga = 'DESCRIPTION:' + 'ñ'.repeat(80)
    const plegada = plegar(larga)
    for (const l of plegada.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
    expect(plegada.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(larga)
    expect(plegada).not.toMatch(/�/)
  })

  it('termina cada línea en CRLF', () => {
    const ics = armarIcs([], { base: BASE, ahora: AHORA })
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/)
  })
})

describe('un evento', () => {
  const ev = {
    id: 'e1', name: 'Charla, martes', description: 'Línea 1\nLínea 2', location: 'Sede Escazú',
    start_at: '2026-10-21T01:00:00.000Z', end_at: '2026-10-21T03:00:00.000Z', updated_at: '2026-10-10T00:00:00Z',
  }
  const ics = armarIcs([ev], { base: BASE, ahora: AHORA })

  it('lleva inicio y fin reales, con el link al detalle', () => {
    expect(ics).toContain('DTSTART:20261021T010000Z')
    expect(ics).toContain('DTEND:20261021T030000Z')
    expect(ics).toContain('SUMMARY:Charla\\, martes')
    expect(ics).toContain(`URL:${BASE}/calendario/e1`)
    expect(ics).toContain('LAST-MODIFIED:20261010T000000Z')
  })

  it('sin hora de fin, dura una hora (decisión 2026-10-15)', () => {
    const sinFin = armarIcs([{ ...ev, end_at: ev.start_at }], { base: BASE, ahora: AHORA })
    expect(sinFin).toContain('DTSTART:20261021T010000Z')
    expect(sinFin).toContain('DTEND:20261021T020000Z')
  })

  it('pide que se refresque solo cada 6 horas', () => {
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT6H')
  })
})

describe('repeticiones: el feed es lo mismo que dibuja /calendario', () => {
  const serie = {
    id: 'cm', name: 'Cárcel de Menores', start_at: '2026-10-16T21:30:00.000Z', end_at: '2026-10-16T23:30:00.000Z',
    is_recurring: true, recurrence_rule: 'WEEKLY:FRI', recurrence_end: '2026-11-07T05:59:59.000Z',
    exception_dates: ['2026-10-30'], timezone: 'America/Costa_Rica',
  } as unknown as AdminEvent

  const fechas = eventsInRange([serie], new Date('2026-10-01'), new Date('2026-12-01'))

  it('una VEVENT por fecha, sin la excepción, cada una de dos horas', () => {
    const ics = armarIcs(fechas, { base: BASE, ahora: AHORA })
    const inicios = [...ics.matchAll(/DTSTART:(\S+)/g)].map(m => m[1])
    expect(inicios).toEqual(['20261016T213000Z', '20261023T213000Z', '20261106T213000Z'])
    const fines = [...ics.matchAll(/DTEND:(\S+)/g)].map(m => m[1])
    expect(fines).toEqual(['20261016T233000Z', '20261023T233000Z', '20261106T233000Z'])
  })

  it('UID estable por fecha: la app actualiza en vez de duplicar', () => {
    const uids = fechas.map(uidDe)
    expect(new Set(uids).size).toBe(uids.length)
    expect(uids[0]).toBe('cm@theosplace.org')
    expect(uids[1]).toBe('cm-20261023T213000Z@theosplace.org')
    expect(eventsInRange([serie], new Date('2026-10-01'), new Date('2026-12-01')).map(uidDe)).toEqual(uids)
  })
})

describe('links de suscripción', () => {
  const l = linksDeSuscripcion(`${BASE}/api/public/events.ics`)
  it('webcal para Apple y Outlook de escritorio', () => {
    expect(l.webcal).toBe('webcal://admin.theosplace.org/api/public/events.ics')
  })
  it('Google recibe el feed en cid', () => {
    expect(l.google).toBe('https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(l.webcal))
  })
  it('Outlook de trabajo (Microsoft 365, el de Theos) va a outlook.office.com', () => {
    expect(l.outlook.startsWith('https://outlook.office.com/calendar/0/addfromweb?url=')).toBe(true)
    expect(l.outlook).toContain(encodeURIComponent(`${BASE}/api/public/events.ics`))
  })
  it('Outlook personal va a outlook.live.com', () => {
    expect(l.outlookPersonal.startsWith('https://outlook.live.com/calendar/0/addfromweb?url=')).toBe(true)
  })
})
