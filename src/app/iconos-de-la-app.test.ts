import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import manifest from './manifest'
import { isPublic } from '@/proxy'

/**
 * UX-8 · El ícono del acceso directo salía con FONDO NEGRO y la theta navy
 * encima, o sea invisible.
 *
 * La causa no era el diseño: era el CANAL ALFA. Un PNG transparente lo
 * rellena Android de negro al generar el acceso directo. Esto vigila esa
 * propiedad en los archivos, porque es invisible en el código y en cualquier
 * visor de escritorio —donde la transparencia se dibuja blanca y el ícono se
 * ve perfecto—.
 */

/** ¿El PNG declara canal alfa? Sale del byte 25 de la cabecera IHDR:
 *  2 = RGB, 6 = RGB+alfa, 0 = gris, 4 = gris+alfa. */
function tipoDeColor(ruta: string): number {
  const buf = readFileSync(join(process.cwd(), ruta))
  expect(buf.subarray(1, 4).toString(), `${ruta} no es un PNG`).toBe('PNG')
  return buf[25]
}

function lado(ruta: string): number {
  return readFileSync(join(process.cwd(), ruta)).readUInt32BE(16)
}

const ICONOS = [
  ['src/app/icon.png', 512],
  ['src/app/apple-icon.png', 180],
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/icon-192-maskable.png', 192],
  ['public/icon-512-maskable.png', 512],
] as const

describe('UX-8 · los íconos de la app', () => {
  it('NINGUNO tiene canal alfa: la transparencia es el bug', () => {
    for (const [ruta] of ICONOS) {
      expect([2, 0], `${ruta} tiene canal alfa`).toContain(tipoDeColor(ruta))
    }
  })

  it('cada uno mide lo que dice su nombre', () => {
    for (const [ruta, px] of ICONOS) expect(lado(ruta), ruta).toBe(px)
  })
})

describe('UX-8 · el manifest', () => {
  const m = manifest()

  it('declara íconos maskable, que es lo que Android usa', () => {
    const maskables = (m.icons ?? []).filter(i => i.purpose === 'maskable')
    expect(maskables.length).toBeGreaterThanOrEqual(2)
    expect(maskables.map(i => i.sizes)).toContain('512x512')
  })

  it('y también los normales: `maskable` solo no alcanza en iOS', () => {
    expect((m.icons ?? []).some(i => i.purpose === 'any')).toBe(true)
  })

  it('el fondo y el tema son el navy de marca, no blanco', () => {
    // Si `background_color` fuera claro, la pantalla de arranque destella
    // en blanco antes de pintar la app.
    expect(m.background_color).toBe('#161440')
    expect(m.theme_color).toBe('#161440')
  })

  it('el manifest es PÚBLICO: el teléfono no trae sesión', () => {
    // Sin esto el proxy lo mandaba al login con un 307, el teléfono no lo
    // leía nunca, y el acceso directo se quedaba sin íconos maskable ni
    // color de tema — o sea, sin nada de lo que este ítem arregló. Se vio
    // probándolo en el navegador; ningún test de datos lo habría mostrado.
    expect(isPublic('/manifest.webmanifest')).toBe(true)
  })

  it('todos los íconos del manifest existen de verdad', () => {
    // Un src equivocado no rompe el build: el teléfono simplemente no
    // encuentra el ícono y cae al que adivine.
    for (const i of m.icons ?? []) {
      expect(() => readFileSync(join(process.cwd(), 'public', i.src!)), i.src).not.toThrow()
    }
  })
})
