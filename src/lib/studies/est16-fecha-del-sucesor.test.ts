import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * EST-16 parte 1 · La fecha elegida en el cierre tiene que LLEGAR al grupo
 * sucesor y a los correos.
 *
 * La regla pura ya está probada en successor-dates.test.ts. Lo que este archivo
 * cuida es el cable: que la pantalla la mande, que la ruta la valide antes de
 * cerrar nada, y que llegue hasta la creación del grupo. Un cable cortado no lo
 * atrapa ningún test de módulo puro — el cierre igual funciona, y la fecha
 * simplemente se ignora en silencio.
 *
 * Se leen los archivos SIN comentarios a propósito: un guard que se satisface
 * con la palabra que aparece en su propia explicación no guarda nada. Ya pasó
 * dos veces en este repo.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const PANTALLA = 'src/app/(admin)/estudios/grupos/[id]/cierre/page.tsx'
const RUTA = 'src/app/api/studies/groups/[id]/close/route.ts'
const MATRICULA = 'src/lib/supabase/queries/payments.ts'

describe('EST-16 · la fecha del sucesor viaja de punta a punta', () => {
  it('la pantalla de cierre manda successor_starts_at', () => {
    const src = sinComentarios(PANTALLA)
    expect(src).toContain('successor_starts_at')
    expect(src).toContain('type="date"')
  })

  it('la pantalla no deja cerrar con una fecha imposible', () => {
    const src = sinComentarios(PANTALLA)
    expect(src).toContain('motivoParaRechazarInicio')
    // El botón de cerrar tiene que mirar ese faltante, no solo pintarlo en rojo.
    expect(src).toMatch(/disabled=\{[^}]*faltaInicioSucesor/)
  })

  it('la ruta valida la fecha ANTES de cerrar el grupo', () => {
    const src = sinComentarios(RUTA)
    const validacion = src.indexOf('motivoParaRechazarInicio')
    const cierre = src.indexOf('await closeGroup(')
    expect(validacion).toBeGreaterThan(-1)
    expect(cierre).toBeGreaterThan(-1)
    // El cierre es irreversible: validar después sería pedir un dato que ya no
    // se puede volver a pedir.
    expect(validacion).toBeLessThan(cierre)
  })

  it('la ruta se la pasa a la matrícula automática, también en la reconciliación', () => {
    const src = sinComentarios(RUTA)
    const llamadas = src.match(/autoEnrollApprovedToNextLevel\([^)]*\)/g) ?? []
    expect(llamadas.length).toBe(2)
    for (const l of llamadas) expect(l).toContain('inicioElegido')
  })

  it('la matrícula automática se la pasa al cálculo de fechas del sucesor', () => {
    const src = sinComentarios(MATRICULA)
    expect(src).toMatch(/fechasDelSucesor\(\{[\s\S]*?inicioElegido[\s\S]*?\}\)/)
  })
})
