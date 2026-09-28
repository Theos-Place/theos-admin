import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DIAS_DE_ESTUDIO, esDiaDeEstudio } from './request-prefs'

const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * El formulario «Me interesa un estudio» ofrecía de lunes a viernes y se
 * comía el SÁBADO, que es un día en el que sí hay grupos (2 en el histórico,
 * 1 activo al 2026-09-28). Reportado por Floriana.
 */
describe('días que se ofrecen al pedir un estudio', () => {
  it('incluye sábado', () => {
    expect(DIAS_DE_ESTUDIO).toContain('Sábado')
  })

  it('no incluye domingo: nunca hubo un grupo un domingo', () => {
    // Cero en 2.100 grupos del histórico. Ofrecerlo sería prometer algo que
    // no existe.
    expect(DIAS_DE_ESTUDIO).not.toContain('Domingo')
  })

  it('son los seis, en orden de semana', () => {
    expect([...DIAS_DE_ESTUDIO]).toEqual([
      'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
    ])
    expect(esDiaDeEstudio('Sábado')).toBe(true)
    expect(esDiaDeEstudio('Domingo')).toBe(false)
  })
})

describe('cableado · la pantalla y el servidor usan la MISMA lista', () => {
  const PANTALLA = sinComentarios('src/components/studies/StudyRequestActions.tsx')
  const RUTA = sinComentarios('src/app/api/studies/requests/route.ts')

  it('ninguno de los dos escribe su propia lista de días', () => {
    // El servidor DESCARTA EN SILENCIO lo que no reconoce
    // (`.filter(d => DAYS.has(d))`). Con dos listas, agregar un día en el
    // formulario y olvidarse del servidor hace que la persona crea que pidió
    // sábado y la solicitud se guarde sin días: sin error y sin aviso.
    for (const [nombre, src] of [['pantalla', PANTALLA], ['ruta', RUTA]] as const) {
      expect(src, nombre).toContain('DIAS_DE_ESTUDIO')
      expect(src, nombre).not.toMatch(/\['Lunes',\s*'Martes'/)
    }
  })

  it('el tope de «hasta 2» sigue siendo 2, no el largo de la lista', () => {
    // Agregar sábado no debe agrandar cuántos días se pueden elegir.
    expect(PANTALLA).toContain("openModal === 'study_interest' ? 2 :")
  })
})
