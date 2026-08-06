// Guardar una plantilla: que un fallo se VEA y que la caché no siga sirviendo
// la versión vieja. Los dos síntomas de "no se guarda" (bug 2026-08-06).
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { saveTemplate, saveErrorMessage } from './save-template'
import {
  writeCommsCache, readCommsCache, invalidateCommsCache, commsCacheHas, COMMS_TTL_MS,
} from './comms-cache'

const PAYLOAD = {
  name: 'Bienvenida', category: 'general', subject: 'Hola',
  body: '<p>Hola {nombre}</p>', body_format: 'html' as const,
}

function respuesta(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => { if (body === undefined) throw new Error('sin cuerpo'); return body },
  } as unknown as Response
}

beforeEach(() => { invalidateCommsCache() })
afterEach(() => { vi.unstubAllGlobals() })

describe('caché de comunicaciones', () => {
  it('sirve lo cacheado dentro del TTL y lo suelta después', () => {
    writeCommsCache('templates', [{ id: '1' }], 1_000)
    expect(readCommsCache('templates', 1_000 + COMMS_TTL_MS - 1)).toHaveLength(1)
    expect(readCommsCache('templates', 1_000 + COMMS_TTL_MS + 1)).toBeNull()
  })

  it('invalidar un slice no toca los otros', () => {
    writeCommsCache('templates', [{ id: '1' }])
    writeCommsCache('messages', [{ id: '2' }])
    invalidateCommsCache('templates')
    expect(commsCacheHas('templates')).toBe(false)
    expect(commsCacheHas('messages')).toBe(true)
  })
})

describe('saveTemplate', () => {
  it('al guardar bien INVALIDA la caché (si no, el listado muestra lo viejo)', async () => {
    writeCommsCache('templates', [{ id: '1', body: '<p>viejo</p>' }])
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(200, { ok: true })))

    const res = await saveTemplate(PAYLOAD, 'abc')

    expect(res.ok).toBe(true)
    expect(commsCacheHas('templates')).toBe(false)
  })

  it('un PUT fallido devuelve un motivo legible y NO invalida', async () => {
    writeCommsCache('templates', [{ id: '1' }])
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(500, { error: 'La base no responde' })))

    const res = await saveTemplate(PAYLOAD, 'abc')

    expect(res).toEqual({ ok: false, error: 'La base no responde' })
    expect(commsCacheHas('templates')).toBe(true)
  })

  it('sin cuerpo de error, el mensaje igual explica algo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(403)))
    const res = await saveTemplate(PAYLOAD, 'abc')
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toMatch(/permiso/i)
  })

  it('sin red, lo dice — antes esto era un catch mudo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const res = await saveTemplate(PAYLOAD, 'abc')
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toMatch(/conexión/i)
  })

  it('sin id crea (POST) y con id actualiza (PUT)', async () => {
    const llamadas: Array<[string, RequestInit]> = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      llamadas.push([url, init])
      return respuesta(200, { ok: true })
    })

    await saveTemplate(PAYLOAD)
    await saveTemplate(PAYLOAD, 'abc')

    expect(llamadas[0][0]).toBe('/api/communications/templates')
    expect(llamadas[0][1].method).toBe('POST')
    expect(llamadas[1][0]).toBe('/api/communications/templates/abc')
    expect(llamadas[1][1].method).toBe('PUT')
  })

  it('el cuerpo viaja tal cual: guardar no debe tocar el HTML', async () => {
    let enviado: string | null = null
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      enviado = init.body as string
      return respuesta(200, { ok: true })
    })
    const html = '<table><tr><td style="padding:20px">Diseño</td></tr></table>'

    await saveTemplate({ ...PAYLOAD, body: html }, 'abc')

    expect(JSON.parse(enviado!).body).toBe(html)
  })
})

describe('saveErrorMessage', () => {
  it('traduce los códigos a algo que se entienda', async () => {
    expect(await saveErrorMessage(respuesta(404))).toMatch(/ya no existe/i)
    expect(await saveErrorMessage(respuesta(409))).toMatch(/ya existe una plantilla/i)
    expect(await saveErrorMessage(respuesta(418))).toMatch(/error 418/)
  })

  it('prefiere el mensaje del servidor cuando lo hay', async () => {
    expect(await saveErrorMessage(respuesta(400, { error: 'Falta el nombre' }))).toBe('Falta el nombre')
  })
})
