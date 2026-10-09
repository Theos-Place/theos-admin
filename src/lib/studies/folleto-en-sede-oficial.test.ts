import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * «¿Dónde te dejamos los folletos?» · solo sedes oficiales (Floriana,
 * 2026-10-09).
 *
 * Era texto libre con el placeholder «Una sede, o lo que te sirva». Las
 * cuatro personas que lo llenaron escribieron la suya de cuatro formas:
 * «Antares», «Madrid», «Meridiano Martes», «Sede Alajuela». Para quien
 * reparte folletos eso no es una dirección, es adivinar.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const PANTALLA = sinComentarios('src/components/studies/ConfiguracionDelDirigente.tsx')
const API = sinComentarios('src/app/api/studies/dirigentes/[id]/route.ts')
const QUERIES = sinComentarios('src/lib/supabase/queries/studies.ts')

describe('la pantalla ofrece sedes, no un campo libre', () => {
  it('es un select con las sedes activas', () => {
    const i = PANTALLA.indexOf('id="folleto-loc"')
    expect(i).toBeGreaterThan(-1)
    const bloque = PANTALLA.slice(i - 200, i + 900)
    expect(bloque).toContain('<select')
    expect(bloque).toContain('activeSedes.map')
    expect(bloque).not.toContain('Una sede, o lo que te sirva')
  })

  it('conserva como opción lo que alguien escribió antes', () => {
    /**
     * Sin esto, abrir la pantalla y guardar cualquier otra cosa le borraría
     * en silencio el dato a quien lo tenía escrito a mano.
     */
    const i = PANTALLA.indexOf('id="folleto-loc"')
    expect(PANTALLA.slice(i, i + 1200)).toContain('(sede no oficial)')
  })
})

describe('el servidor lo valida: la pantalla nunca fue el permiso', () => {
  it('rechaza con 400 lo que no sea una sede activa', () => {
    const i = API.indexOf('patch.folleto_location')
    expect(i).toBeGreaterThan(-1)
    const bloque = API.slice(i, i + 900)
    expect(bloque).toContain("from('sedes')")
    expect(bloque).toContain("eq('is_active', true)")
    expect(bloque).toContain('status: 400')
  })

  it('y vacío sigue siendo «no dijo», no un error', () => {
    const i = API.indexOf('patch.folleto_location')
    expect(API.slice(i, i + 900)).toContain('patch.folleto_location = v || null')
  })
})

describe('el reporte muestra el NOMBRE, no el código', () => {
  it('traduce el code contra el catálogo de sedes', () => {
    // Quien reparte folletos lee «Sede Antares», no «antares».
    const fn = QUERIES.slice(QUERIES.indexOf('export async function getDisponibilidadDeDirigentes'))
    expect(fn.slice(0, 2500)).toContain('nombreDeSede.get(r.folleto_location as string)')
  })

  it('y si no es un code conocido lo escribe tal cual', () => {
    // Una ficha con texto viejo se sigue viendo en vez de salir vacía.
    const fn = QUERIES.slice(QUERIES.indexOf('export async function getDisponibilidadDeDirigentes'))
    expect(fn.slice(0, 2500)).toMatch(/nombreDeSede\.get\([^)]+\) \?\? \(r\.folleto_location as string\)/)
  })
})
