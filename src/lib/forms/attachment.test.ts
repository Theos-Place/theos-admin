import { describe, it, expect } from 'vitest'
import { esPathDeAdjunto, urlDeAdjunto } from './attachment'

describe('esPathDeAdjunto', () => {
  it('acepta lo que genera la subida', () => {
    expect(esPathDeAdjunto('0290a632-b4d0-4c0c-8de7-1b07dcc1510d.webp')).toBe(true)
    expect(esPathDeAdjunto('0290a632-b4d0-4c0c-8de7-1b07dcc1510d.jpg')).toBe(true)
  })
  it('rechaza cualquier intento de salirse del archivo', () => {
    // La ruta que sirve el adjunto corre con service role sobre un bucket
    // privado: un path armado a mano no puede poder pedir otro objeto.
    expect(esPathDeAdjunto('../payment-receipts/algo.jpg')).toBe(false)
    expect(esPathDeAdjunto('carpeta/0290a632-b4d0-4c0c-8de7-1b07dcc1510d.webp')).toBe(false)
    expect(esPathDeAdjunto('0290a632-b4d0-4c0c-8de7-1b07dcc1510d.webp/../x')).toBe(false)
  })
  it('rechaza extensiones que no se suben', () => {
    expect(esPathDeAdjunto('0290a632-b4d0-4c0c-8de7-1b07dcc1510d.pdf')).toBe(false)
    expect(esPathDeAdjunto('0290a632-b4d0-4c0c-8de7-1b07dcc1510d.svg')).toBe(false)
  })
  it('rechaza lo vacío y lo que no es un uuid', () => {
    expect(esPathDeAdjunto('')).toBe(false)
    expect(esPathDeAdjunto('comprobante.jpg')).toBe(false)
  })
})

describe('urlDeAdjunto', () => {
  it('apunta a nuestra ruta, no a una URL firmada', () => {
    // La firmada dura minutos: en un Excel que alguien abre mañana sería un
    // link muerto.
    const u = urlDeAdjunto('0290a632-b4d0-4c0c-8de7-1b07dcc1510d.webp', 'https://x.test')
    expect(u).toBe('https://x.test/api/forms/attachment?path=0290a632-b4d0-4c0c-8de7-1b07dcc1510d.webp')
  })
  it('no duplica la barra final del origen', () => {
    expect(urlDeAdjunto('a.webp', 'https://x.test/')).toContain('https://x.test/api/')
  })
})

describe('adjuntos de formularios PÚBLICOS (2026-10-19)', () => {
  // El comprobante de Matrimonios salía como el path pelado: la subida pública
  // guarda en `publico/<formulario>/`, y la regla solo aceptaba el nombre suelto.
  it('acepta la carpeta publico/<uuid>/', () => {
    expect(esPathDeAdjunto('publico/648daa3b-6af1-4df4-be69-ab9cd8b7848c/457fef66-da60-4312-b769-899d62604398.jpg')).toBe(true)
  })
  it('y nada más: ni otra carpeta, ni subir de nivel, ni un nombre que no sea uuid', () => {
    expect(esPathDeAdjunto('otra/648daa3b-6af1-4df4-be69-ab9cd8b7848c/457fef66-da60-4312-b769-899d62604398.jpg')).toBe(false)
    expect(esPathDeAdjunto('publico/../457fef66-da60-4312-b769-899d62604398.jpg')).toBe(false)
    expect(esPathDeAdjunto('publico/648daa3b-6af1-4df4-be69-ab9cd8b7848c/foto.jpg')).toBe(false)
  })
  it('la subida pública escribe justo esa forma', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('src/app/api/public/forms/[id]/upload-attachment/route.ts', 'utf8')).toContain('const path = `publico/${id}/${crypto.randomUUID()}.${EXT[file.type]}`')
  })
})
