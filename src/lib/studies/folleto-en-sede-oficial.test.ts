import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * «¿Dónde te dejamos los folletos?»: de dónde salió y dónde se valida.
 *
 * 2026-10-09 · Dejó de ser texto libre y pasó a ser un select de sedes
 * oficiales.
 * 2026-10-12 · La pregunta SALIÓ del formulario de disponibilidad (DIR-8):
 * el lugar de entrega es del grupo, no de la persona. El endpoint y el
 * reporte siguen igual, porque el dato ya contestado se conserva.
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

describe('DIR-8 · la pregunta salió del formulario de disponibilidad', () => {
  /**
   * CAMBIO DE DECISIÓN, 2026-10-12 (reunión con Fabiola). El 9-oct esto se
   * había convertido en un select de sedes oficiales, y funcionaba. Lo que
   * se revisó no fue el CONTROL sino el LUGAR: dónde se entregan los
   * folletos pertenece al flujo de creación del GRUPO, no a la
   * disponibilidad de la persona.
   *
   * Preguntarlo en el perfil generaba un dato que nadie consultaba y que
   * quedaba viejo: la sede del grupo cambia y la respuesta del dirigente no.
   *
   * Los otros dos bloques de este archivo SIGUEN valiendo: la columna
   * conserva lo ya contestado, el endpoint la sigue validando y el reporte
   * la sigue mostrando. Lo único que desapareció es la pregunta.
   */
  it('ya no se le pide al dirigente en su perfil', () => {
    expect(PANTALLA).not.toContain('id="folleto-loc"')
    expect(PANTALLA).not.toContain('¿Dónde te dejamos los folletos?')
  })

  it('pero el dato ya guardado NO se borra', () => {
    // La columna se conserva: quien la había contestado sigue apareciendo
    // en el reporte de folletos.
    expect(QUERIES).toContain('folleto_location')
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
