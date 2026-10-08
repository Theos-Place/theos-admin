import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FUENTES_DINAMICAS } from './fuentes-dinamicas'

/**
 * LA LISTA DE FUENTES ESTÁ EN DOS LUGARES, Y ESTÁ BIEN QUE ASÍ SEA.
 *
 * La base la protege con un CHECK y el código la resuelve. Quitar el CHECK
 * sería peor: un `options_source` mal escrito —'talleres ' con espacio,
 * 'Talleres' con mayúscula— se guardaría sin protestar y el desplegable
 * saldría VACÍO en producción, sin un error que lo delate.
 *
 * Lo que no puede pasar es que se separen. Agregar una fuente al código sin
 * la migración revienta el insert —pasó el 2026-10-08 al crear la encuesta de
 * talleres—, y agregarla a la base sin el código deja un desplegable que
 * nadie llena. Este test falla en los dos casos.
 */
const MIGRACIONES = 'supabase/migrations'

/** El CHECK vigente: el de la migración más nueva que lo toca. */
function fuentesDelCheck(): string[] {
  const archivos = readdirSync(MIGRACIONES).filter(n => n.endsWith('.sql')).sort()
  let ultimo: string | null = null
  for (const n of archivos) {
    const sql = readFileSync(join(MIGRACIONES, n), 'utf8')
    if (/form_fields_options_source_check/.test(sql)) ultimo = sql
  }
  expect(ultimo, 'ninguna migración define el CHECK').not.toBeNull()
  // Lo que va dentro del `in (...)` o del `= '...'` del último `add constraint`.
  const add = ultimo!.slice(ultimo!.lastIndexOf('add constraint'))
  return [...add.matchAll(/'([a-z_]+)'/g)].map(m => m[1])
    .filter(v => v !== 'form_fields_options_source_check')
}

describe('el CHECK de la base y el código dicen lo mismo', () => {
  it('cada fuente del código está permitida en la base', () => {
    const enLaBase = fuentesDelCheck()
    for (const f of FUENTES_DINAMICAS) {
      expect(enLaBase, `falta la migración para '${f}'`).toContain(f)
    }
  })

  it('y cada fuente de la base la sabe resolver el código', () => {
    // Si no, queda un desplegable que nadie llena y sale vacío.
    const enElCodigo = [...FUENTES_DINAMICAS] as string[]
    for (const f of fuentesDelCheck()) {
      expect(enElCodigo, `la base permite '${f}' y el código no lo resuelve`).toContain(f)
    }
  })

  it('el resolvedor atiende las dos, no solo la vieja', () => {
    const q = readFileSync('src/lib/supabase/queries/forms.ts', 'utf8')
    const fn = q.slice(q.indexOf('export async function resolveDynamicOptions'))
    for (const f of FUENTES_DINAMICAS) expect(fn, f).toContain(`'${f}'`)
    // Y el filtro usa el guard, no una comparación suelta que se olvide una.
    expect(fn).toContain('esFuenteDinamica(fuente(f))')
  })
})
