import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ymdCR, toYmdLocal, calcAge, formatMoney, formatCRC, currencySymbol, formatDate, formatDateLong, formatDateNumeric, formatDayMonth, formatMonthYear, formatBirthday } from './format'

describe('ymdCR', () => {
  it('un instante de madrugada UTC es el día ANTERIOR en CR (UTC-6)', () => {
    // 2026-07-14 01:30Z = 2026-07-13 19:30 en CR
    expect(ymdCR(new Date('2026-07-14T01:30:00Z'))).toBe('2026-07-13')
  })
  it('mediodía UTC es el mismo día en CR', () => {
    expect(ymdCR(new Date('2026-07-14T12:00:00Z'))).toBe('2026-07-14')
  })
  it('frontera exacta: 06:00Z es medianoche CR (ya es el día UTC)', () => {
    expect(ymdCR(new Date('2026-07-14T06:00:00Z'))).toBe('2026-07-14')
    expect(ymdCR(new Date('2026-07-14T05:59:59Z'))).toBe('2026-07-13')
  })
})

describe('toYmdLocal', () => {
  it('usa componentes locales del runtime (no UTC)', () => {
    const d = new Date(2026, 6, 14, 23, 59) // 14 jul local, independiente de TZ
    expect(toYmdLocal(d)).toBe('2026-07-14')
  })
})

describe('calcAge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 13)) // 13 de julio de 2026, hora local
  })
  afterEach(() => vi.useRealTimers())

  it('cumpleaños ya pasado este año', () => {
    expect(calcAge('1990-05-15')).toBe(36)
  })
  it('cumpleaños todavía no llega', () => {
    expect(calcAge('1990-12-01')).toBe(35)
  })
  it('cumpleaños HOY cuenta como cumplido', () => {
    expect(calcAge('1990-07-13')).toBe(36)
  })
  it('fecha pura YYYY-MM-DD no retrocede un día por parseo UTC', () => {
    // new Date('1990-07-14') sería medianoche UTC = 13 jul en CR; el parseo
    // flexible debe tratarla como local y NO regalar un año.
    expect(calcAge('1990-07-14')).toBe(35)
  })
  it('null/undefined/inválida → 0', () => {
    expect(calcAge(null)).toBe(0)
    expect(calcAge(undefined)).toBe(0)
    expect(calcAge('no-es-fecha')).toBe(0)
  })
})

// INT-2: formateo por moneda (helper único).
describe('formatMoney', () => {
  it('CRC por default (todo lo histórico)', () => {
    expect(formatMoney(50000)).toBe(`\u20a1${(50000).toLocaleString('es-CR')}`)
    expect(formatMoney(50000, null)).toBe(formatMoney(50000, 'CRC'))
  })
  it('USD y EUR con su símbolo Y SUS CÉNTIMOS (INT-3)', () => {
    // Antes se formateaban sin decimales, como los colones: €25,50 salía "€25,5".
    expect(formatMoney(120, 'USD')).toBe('$120,00')
    expect(formatMoney(75, 'EUR')).toBe('\u20ac75,00')
    expect(formatMoney(25.5, 'EUR')).toBe('\u20ac25,50')
  })
  it('moneda desconocida antepone el código (no revienta)', () => {
    expect(formatMoney(10, 'GBP')).toBe('GBP 10,00')
  })
  it('formatCRC delega en formatMoney', () => {
    expect(formatCRC(1234)).toBe(formatMoney(1234, 'CRC'))
  })
  it('currencySymbol', () => {
    expect(currencySymbol('CRC')).toBe('\u20a1')
    expect(currencySymbol(undefined)).toBe('\u20a1')
    expect(currencySymbol('EUR')).toBe('\u20ac')
  })
})

describe('fechas puras: no se corren un día en Costa Rica', () => {
  // Las columnas `date` (study_groups.starts_at, volunteers.start_date,
  // donations.donation_date, committee_goals.due_date) llegan como
  // "2026-09-28". `new Date("2026-09-28")` las lee como medianoche UTC y en CR
  // (UTC-6) muestran el 27. Por eso existe parseFlexibleDate y por eso hay que
  // usar estos formateadores en vez de new Date(...).toLocaleDateString.
  it('formatDate no retrocede el día', () => {
    expect(formatDate('2026-09-28')).toContain('28')
  })
  it('formatDateLong tampoco', () => {
    expect(formatDateLong('2026-09-28')).toContain('28')
  })
  it('formatDateNumeric tampoco', () => {
    expect(formatDateNumeric('2026-09-28')).toBe('28/09/2026')
  })
  it('el 1 de enero no se va al año anterior', () => {
    // El caso que más duele: 2026-01-01 mostrándose como 31 dic 2025.
    expect(formatDateNumeric('2026-01-01')).toBe('01/01/2026')
    expect(formatDate('2026-01-01')).toContain('2026')
  })
  it('un timestamp con hora sigue siendo un instante, no una fecha pura', () => {
    // La suite corre en UTC (ver vitest.config), así que este caso comprueba la
    // RAMA, no el corrimiento: un valor con hora no entra por el atajo de fecha
    // pura y se interpreta con new Date(). El corrimiento real solo se ve en
    // una zona negativa, y de eso se cuida no usar new Date() en las pantallas.
    expect(formatDateNumeric('2026-09-27T23:30:00.000Z')).toBe('27/09/2026')
    expect(formatDateNumeric('2026-09-28T00:30:00.000Z')).toBe('28/09/2026')
  })
})

// QA-1/M1 · Los dos formatos que las pantallas de empleados armaban a mano con
// `new Date(x + 'T00:00:00').toLocaleDateString(...)`. Salen exactamente igual
// que antes; lo que cambia es que la protección de zona vive en un solo lugar.
describe('formatMonthYear y formatDayMonth', () => {
  it('mes y año, sin día', () => {
    expect(formatMonthYear('2026-05-15')).toBe('may 2026')
    expect(formatMonthYear('2026-01-01')).toBe('ene 2026')
  })
  it('día y mes, sin año', () => {
    expect(formatDayMonth('2026-05-15')).toBe('15 may')
    expect(formatDayMonth('2026-01-01')).toBe('1 ene')
  })
  it('null da la raya, igual que el resto', () => {
    expect(formatMonthYear(null)).toBe('—')
    expect(formatDayMonth(undefined)).toBe('—')
    expect(formatMonthYear('cualquier cosa')).toBe('—')
  })
})

describe('formatBirthday', () => {
  it('no corre el día: el bug del export de servidores (2026-09-21)', () => {
    // `new Date('1990-05-14')` es medianoche UTC = 13 de mayo 6 p.m. en CR, y
    // por eso TODO el archivo salía con la fecha de la víspera.
    expect(formatBirthday('1990-05-14')).toBe('14 de mayo')
    expect(formatBirthday('2001-01-01')).toBe('1 de enero')
    expect(formatBirthday('1985-12-31')).toBe('31 de diciembre')
  })

  it('va sin año: sirve para felicitar, no para saber la edad', () => {
    expect(formatBirthday('1990-05-14')).not.toMatch(/1990/)
  })

  it('sin fecha devuelve vacío, no "—": va en una celda de Excel', () => {
    expect(formatBirthday(null)).toBe('')
    expect(formatBirthday(undefined)).toBe('')
    expect(formatBirthday('no es fecha')).toBe('')
  })
})
