import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  inicioDeLaVentana, mesDeLaVentana, subtituloDeDonantes, explicacionDeDonantes,
  criterioDeDonantes, MESES_DE_VENTANA,
} from './ventana-de-donante'

// PAR-1 (2026-09-23): la ventana pasó de 6 meses a 3. Los casos se escriben
// contra la constante y no contra el número, así que cambiarla vuelve a fallar
// acá si alguna fecha deja de cuadrar — que es lo que uno quiere de un test de
// regla.
const RETROCESO = MESES_DE_VENTANA - 1

describe('ventana de donante activo', () => {
  it('cuenta el mes actual como uno de los tres', () => {
    // 16-set-2026 con ventana de 3: set, ago, jul → arranca el 1 de julio.
    expect(MESES_DE_VENTANA).toBe(3)
    expect(inicioDeLaVentana(new Date('2026-09-16T23:27:00Z'))).toBe('2026-07-01')
    expect(mesDeLaVentana(new Date('2026-09-16T23:27:00Z'))).toBe('julio de 2026')
  })

  it('cruza bien el cambio de año', () => {
    expect(inicioDeLaVentana(new Date('2027-02-10T12:00:00Z'))).toBe('2026-12-01')
    expect(mesDeLaVentana(new Date('2027-01-05T12:00:00Z'))).toBe('noviembre de 2026')
  })

  it('el primer día del mes ya cuenta el mes nuevo', () => {
    expect(inicioDeLaVentana(new Date('2026-10-01T00:00:00Z'))).toBe('2026-08-01')
  })

  it('el último instante del mes todavía es el mes viejo', () => {
    expect(inicioDeLaVentana(new Date('2026-09-30T23:59:59Z'))).toBe('2026-07-01')
  })

  it('SE CALCULA EN UTC, igual que la base', () => {
    // 30-set 20:00 en Costa Rica son las 02:00 del 1-oct en UTC. La base ya
    // movió su ventana; si acá usáramos la fecha de Costa Rica el texto
    // contradiría al número durante seis horas cada mes.
    expect(inicioDeLaVentana(new Date('2026-10-01T02:00:00Z'))).toBe('2026-08-01')
  })

  it('el subtítulo entra en la tarjeta, como los otros', () => {
    const s = subtituloDeDonantes(new Date('2026-09-16T12:00:00Z'))
    expect(s).toBe('Donaron desde julio de 2026')
    expect(s.length).toBeLessThan(40)
  })

  it('la explicación larga dice la regla completa', () => {
    expect(explicacionDeDonantes(new Date('2026-09-16T12:00:00Z')))
      .toBe('Donaron al menos una vez desde julio de 2026: los últimos 3 meses, contando el actual.')
  })

  it('el criterio corto también sale de la constante', () => {
    // Existía escrito a mano en la pantalla de finanzas; ahí estaba el cuarto
    // lugar donde había que acordarse de cambiar el número.
    expect(criterioDeDonantes()).toBe('Donaron en los últimos 3 meses, contando el actual')
  })

  it('setiembre se escribe como en Costa Rica', () => {
    // 'septiembre' con p es lo que devuelve toLocaleDateString; acá va sin ella.
    expect(mesDeLaVentana(new Date('2026-11-10T12:00:00Z'))).toContain('setiembre')
  })
})

/**
 * PAR-1 · El SQL y el TypeScript no se pueden separar sin que esto falle.
 *
 * Quien marca `is_donor` es `refresh_donor_flags()` en Postgres; el texto de las
 * pantallas sale de este módulo. Un `.sql` no puede importar TypeScript, así que
 * el número está en los dos lados por necesidad. Lo que NO tiene por qué pasar
 * es que se desincronicen en silencio: hasta hoy vivía en cuatro lugares y
 * cambiarlo era acordarse de los cuatro.
 *
 * Se lee la migración MÁS NUEVA que toque estas funciones, no una fija: la
 * próxima vez que la regla cambie habrá otra migración y este test tiene que
 * mirar esa.
 */
describe('la ventana del SQL coincide con la del código', () => {
  const DIR = 'supabase/migrations'

  const ultimaQueDefine = (fn: string): string | null => {
    const archivos = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort().reverse()
    for (const f of archivos) {
      const sql = readFileSync(join(DIR, f), 'utf8')
      if (new RegExp(`(create or replace function|CREATE OR REPLACE FUNCTION)\\s+public\\.${fn}\\b`).test(sql)) return sql
    }
    return null
  }

  for (const fn of ['refresh_donor_flags', 'set_donor_on_donation']) {
    it(`${fn} usa INTERVAL '${MESES_DE_VENTANA - 1} months'`, () => {
      const sql = ultimaQueDefine(fn)
      expect(sql, `ninguna migración define public.${fn}`).not.toBeNull()
      const intervalos = [...sql!.matchAll(/INTERVAL\s+'(\d+)\s+months?'/gi)].map(m => Number(m[1]))
      expect(intervalos.length, 'la función debería usar un INTERVAL de meses').toBeGreaterThan(0)
      for (const meses of intervalos) {
        expect(meses, `el SQL retrocede ${meses} meses y el código ${RETROCESO}`).toBe(RETROCESO)
      }
    })
  }
})
