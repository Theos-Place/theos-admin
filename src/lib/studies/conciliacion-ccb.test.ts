import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  esColaDeReprueba, PLAN_POR_COLA, COLAS_SIN_PLAN, planDeCola,
  clasificar, fueraDelAlcance, ESTADOS_CONCILIABLES, PROPUESTA_SIN_RESPALDO,
} from './conciliacion-ccb'

describe('DAT-14 · qué fila del export cuenta', () => {
  it('las colas «Reprueba …» no son una aprobación', () => {
    expect(esColaDeReprueba('Reprueba Nivel 1 - 4')).toBe(true)
    expect(esColaDeReprueba('Reprueba Capacitación')).toBe(true)
  })

  it('pero «Religiones del Mundo» no empieza por reprueba', () => {
    // El filtro es por palabra, no por substring: un `includes('reprueba')`
    // mal escrito se comería colas legítimas sin que nadie lo note.
    expect(esColaDeReprueba('Religiones del Mundo')).toBe(false)
    expect(esColaDeReprueba('Nivel 1')).toBe(false)
  })

  it('aguanta el espacio de más que trae el export', () => {
    expect(esColaDeReprueba('  Reprueba Nivel 1 - 4')).toBe(true)
  })
})

describe('DAT-14 · cola → plan', () => {
  it('los cuatro niveles, que son el 60% del archivo', () => {
    expect(planDeCola('Nivel 1')).toBe('N1')
    expect(planDeCola('Nivel 4')).toBe('N4')
  })

  it('las que traen la ortografía de CCB se mapean igual', () => {
    // «Discipulos 3» sin tilde y «Desiciones» con la falta: tal cual vienen.
    expect(planDeCola('Discipulos 3')).toBe('DIS3')
    expect(planDeCola('Cómo Tomar Buenas Desiciones (Viviendo en Integri)')).toBe('CTBD')
    expect(planDeCola('¿Cómo interpretar la Biblia? (Hermenéutica)')).toBe('HER')
  })

  it('una cola que no conocemos devuelve null, NO un plan parecido', () => {
    // Adivinar acá le acredita a alguien un estudio que no llevó.
    expect(planDeCola('Nivel 5')).toBeNull()
    expect(planDeCola('Taller nuevo 2027')).toBeNull()
  })

  it('las dos colas que a propósito no tienen plan están declaradas', () => {
    // La pasantía es un estado del dirigente (DIR-8), no un estudio.
    expect(COLAS_SIN_PLAN).toContain('Pasantía como Dirigente')
    expect(COLAS_SIN_PLAN).toContain('Bienestar Integral')
    for (const c of COLAS_SIN_PLAN) expect(planDeCola(c)).toBeNull()
  })

  it('ningún código de plan se repite en dos colas', () => {
    const codigos = Object.values(PLAN_POR_COLA)
    expect(new Set(codigos).size).toBe(codigos.length)
  })
})

describe('DAT-14 · las casillas de la conciliación', () => {
  it('aprobado en el sistema y respaldado por CCB → ok', () => {
    expect(clasificar('completed', true)).toBe('ok')
  })

  it('el sistema reprueba y CCB aprobó → se revisa a mano', () => {
    expect(clasificar('reprobado', true)).toBe('resultado_distinto')
    expect(clasificar('en_revision', true)).toBe('resultado_distinto')
  })

  it('el sistema afirma algo y CCB no sabe nada → candidato a error de unión', () => {
    expect(clasificar('completed', false)).toBe('sin_respaldo')
    expect(clasificar('en_revision', false)).toBe('sin_respaldo')
  })

  it('CCB lo tiene y el sistema no → cierre que nunca se registró', () => {
    expect(clasificar(null, true)).toBe('cierre_no_registrado')
  })

  it('solo se concilian los estados que afirman un resultado', () => {
    // `enrolled` es presente, no resultado; `dropped`/`cancelada` ya son una
    // decisión tomada. Meterlos acá propondría cancelar gente estudiando.
    expect([...ESTADOS_CONCILIABLES]).toEqual(['completed', 'reprobado', 'en_revision'])
  })
})

describe('DAT-14 · «cancelada» no es «dropped»', () => {
  it('lo que se propone para una matrícula sin respaldo es cancelada', () => {
    // `dropped` dice «se salió» y es falso: nunca estuvo. El historial de
    // estudios es el expediente de una persona.
    expect(PROPUESTA_SIN_RESPALDO).toBe('cancelada')
    expect(PROPUESTA_SIN_RESPALDO).not.toBe('dropped')
  })
})

describe('DAT-14 · el corte del archivo', () => {
  const ULTIMA = '2026-09-16'

  it('una matrícula cerrada después de la última cola no se puede juzgar', () => {
    expect(fueraDelAlcance('2026-10-05', ULTIMA)).toBe(true)
  })

  it('una cerrada antes, sí', () => {
    expect(fueraDelAlcance('2026-09-15', ULTIMA)).toBe(false)
    expect(fueraDelAlcance('2019-03-01', ULTIMA)).toBe(false)
  })

  it('el mismo día entra', () => {
    expect(fueraDelAlcance(ULTIMA, ULTIMA)).toBe(false)
  })

  it('sin fecha de cierre NO se da por fuera de alcance', () => {
    // Las 19 sin fecha son del histórico viejo; regalarles el beneficio de
    // la duda por un null las sacaría de la revisión en silencio.
    expect(fueraDelAlcance(null, ULTIMA)).toBe(false)
  })

  it('compara como texto, sin construir Date', () => {
    // `new Date('2026-09-16')` es medianoche UTC y en Costa Rica sería el 15.
    expect(fueraDelAlcance('2026-09-16T23:00:00Z', ULTIMA)).toBe(false)
  })
})

/**
 * El script de conciliación no puede `require()` el .ts, así que lee
 * PLAN_POR_COLA de este archivo con un regex. Si alguien cambia el formato del
 * objeto —una entrada en varias líneas, comillas dobles—, el regex deja de
 * encontrarla y el script conciliaría de menos EN SILENCIO.
 */
describe('el script puede leer el mapeo de este archivo', () => {
  it('todas las entradas siguen el formato que el regex espera', () => {
    const src = readFileSync('src/lib/studies/conciliacion-ccb.ts', 'utf8')
    const bloque = src.match(/PLAN_POR_COLA[^=]*= \{([\s\S]*?)\n\}/)![1]
    const leidas = [...bloque.matchAll(/^\s*'([^']+)': '([A-Z0-9]+)',$/gm)]
    expect(leidas.length).toBe(Object.keys(PLAN_POR_COLA).length)
  })
})
