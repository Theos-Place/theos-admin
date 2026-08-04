import { describe, it, expect } from 'vitest'
import { sesMessageIdFromResponse, providerMessageId, normalizeSesMessageId } from './ses-message-id'

// El ID real de un envío del 2026-08-03, tal como lo devolvió SES y como después
// apareció en el header Message-ID que vio Gmail.
const REAL = '0100019fca782e02-c4b6abfc-5e3f-45ba-a7a8-f637b782562a-000000'

describe('sesMessageIdFromResponse', () => {
  it('lo saca de la respuesta del SMTP de SES', () => {
    expect(sesMessageIdFromResponse(`250 Ok ${REAL}`)).toBe(REAL)
  })

  it('aguanta variantes de la respuesta', () => {
    expect(sesMessageIdFromResponse(`250 OK ${REAL}`)).toBe(REAL)
    expect(sesMessageIdFromResponse(`  250 Ok ${REAL}\r\n`)).toBe(REAL)
  })

  it('acepta el valor ya como Message-ID: pela <> y el dominio', () => {
    expect(sesMessageIdFromResponse(`250 Ok <${REAL}@email.amazonses.com>`)).toBe(REAL)
  })

  it('devuelve null cuando no hay un ID de SES: mejor no saber que guardar basura', () => {
    expect(sesMessageIdFromResponse('250 Message accepted')).toBeNull()
    expect(sesMessageIdFromResponse('250 2.0.0 Ok: queued as A1B2C3')).toBeNull()
    expect(sesMessageIdFromResponse('')).toBeNull()
    expect(sesMessageIdFromResponse(null)).toBeNull()
    expect(sesMessageIdFromResponse(undefined)).toBeNull()
  })

  it('NO confunde el Message-ID local de nodemailer con uno de SES', () => {
    // Este es justo el valor que se estaba guardando por error.
    expect(sesMessageIdFromResponse('250 Ok <7eb167e2-808a-a8e9-07a2-b3e04afd036e@theosplace.org>')).toBeNull()
  })
})

describe('providerMessageId', () => {
  it('prefiere el de SES: es el que llega en los eventos de SNS', () => {
    const local = `<7eb167e2-808a-a8e9-07a2-b3e04afd036e@theosplace.org>`
    expect(providerMessageId(`250 Ok ${REAL}`, local)).toBe(REAL)
  })

  it('sin ID de SES cae al Message-ID local, pelado', () => {
    expect(providerMessageId('250 Message accepted', '<abc@theosplace.org>')).toBe('abc')
  })

  it('sin nada devuelve cadena vacía, no undefined', () => {
    expect(providerMessageId(null, null)).toBe('')
    expect(providerMessageId(undefined, undefined)).toBe('')
  })
})

describe('normalizeSesMessageId', () => {
  it('deja igual el ID pelado que manda SNS', () => {
    expect(normalizeSesMessageId(REAL)).toBe(REAL)
  })

  it('pela <> y dominio: los dos lados quedan comparables', () => {
    expect(normalizeSesMessageId(`<${REAL}@email.amazonses.com>`)).toBe(REAL)
  })

  it('null cuando no viene nada', () => {
    expect(normalizeSesMessageId(null)).toBeNull()
    expect(normalizeSesMessageId('')).toBeNull()
    expect(normalizeSesMessageId('   ')).toBeNull()
  })
})
