import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  RAZONES_INACTIVO, DETALLES_NO_EJERCE, SITUACIONES_CDEB,
  DISPONIBILIDADES, RAZONES_NO_DISPONIBLE, ESTADOS_BASE,
} from './estado-del-dirigente'

/**
 * DIR-8 · Los valores que acepta la BASE y los que conoce el MÓDULO tienen
 * que ser los mismos.
 *
 * Son dos listas escritas en dos lugares —los CHECK de la migración y las
 * constantes de TypeScript— y esa es la forma de bug que más veces apareció
 * en este repo. Si divergen, agregar una razón nueva compila, pasa los
 * tests, y revienta al guardar con un error de constraint que no dice nada.
 */
const MIGRACIONES = join(process.cwd(), 'supabase/migrations')

const sql = readdirSync(MIGRACIONES)
  .filter(f => f.includes('dir8_taxonomia'))
  .map(f => readFileSync(join(MIGRACIONES, f), 'utf8'))
  .join('\n')

describe('DIR-8 · la base conoce los mismos valores que el código', () => {
  it('existe la migración', () => {
    expect(sql.length, 'no se encontró la migración de la taxonomía').toBeGreaterThan(0)
  })

  const listas: Array<[string, readonly string[]]> = [
    ['estado_base', ESTADOS_BASE],
    ['razon_inactivo', RAZONES_INACTIVO],
    ['detalle_no_ejerce', DETALLES_NO_EJERCE],
    ['situacion_cdeb', SITUACIONES_CDEB],
    ['disponibilidad', DISPONIBILIDADES],
    ['razon_no_disponible', RAZONES_NO_DISPONIBLE],
  ]

  for (const [columna, valores] of listas) {
    it(`${columna}: los ${valores.length} valores están en el CHECK`, () => {
      for (const v of valores) {
        expect(sql, `falta '${v}' en el CHECK de ${columna}`).toContain(`'${v}'`)
      }
    })
  }

  it('la forma del estado se valida también en la base', () => {
    // No alcanza con validarlo en la app: un script, un import o una
    // corrección a mano escriben directo contra la tabla.
    expect(sql).toMatch(/study_leaders_forma_del_estado/)
  })

  it('la fecha de regreso queda amarrada a la pausa', () => {
    expect(sql).toMatch(/study_leaders_pausa_solo_en_pausa/)
  })

  it('la columna vieja queda marcada como obsoleta, no borrada', () => {
    // Borrarla de una rompería todo lo que todavía la lee. Queda con un
    // comment que dice desde cuándo y qué la reemplaza.
    expect(sql).toMatch(/comment on column public\.study_leaders\.availability_status/)
    expect(sql).toMatch(/OBSOLETA desde DIR-8/)
  })
})
