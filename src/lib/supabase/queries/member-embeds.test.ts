// Un embed `members(...)` sin nombre de FK explícito revienta en cuanto la tabla
// tiene MÁS DE UNA clave foránea a members: PostgREST no puede elegir y responde
// "Could not embed because more than one relationship was found".
//
// Pasó de verdad el 2026-08-21: la migración de FRM-4 agregó `recorded_by` a
// cinco tablas, y eso rompió el detalle de grupo ("grupo no encontrado"), el
// análisis de estudios y dos notificadores de correo. No lo detectó ningún test
// porque los de unidad no tocan la base, y el typecheck no valida el string del
// select. Este test cierra ese hueco: es estático y mira el string.
//
// La lista de abajo se mantiene a mano A PROPÓSITO. Si alguien agrega una FK
// nueva a members, tiene que sumar la tabla acá — y al hacerlo el test le va a
// decir exactamente qué selects hay que desambiguar.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/** Tablas con MÁS DE UNA FK a members: sus embeds deben nombrar la FK. */
const TABLAS_AMBIGUAS = [
  'study_enrollments',    // member_id + recorded_by
  'form_responses',       // member_id + recorded_by
  'event_registrations',  // member_id + recorded_by
  'study_requests',       // member_id + recorded_by + reviewed_by
  'finance_requests',     // member_id + recorded_by + reviewed_by
  'study_groups',         // leader_id + co_leader_id + feedback_released_by
  'leader_evaluations',   // leader_id + member_id + co_leader_id + hidden_by
  'payments',             // member_id + recorded_by + …
] as const

describe('embeds a members con la FK nombrada', () => {
  const archivos = execSync("grep -rl 'members(' src --include='*.ts'", { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)

  /** El contenido del embed `tabla(...)`, respetando paréntesis anidados. */
  function bloqueDe(sel: string, desde: number): string {
    let prof = 1, i = desde
    while (i < sel.length && prof > 0) {
      if (sel[i] === '(') prof++
      else if (sel[i] === ')') prof--
      i++
    }
    return sel.slice(desde, i)
  }

  it('ninguna tabla con varias FK a members embebe members sin nombrarla', () => {
    const malos: string[] = []
    for (const f of archivos) {
      const txt = readFileSync(f, 'utf8')
      for (const tl of txt.matchAll(/`[^`]*`/g)) {
        const sel = tl[0]
        if (!sel.includes('members(')) continue
        for (const tabla of TABLAS_AMBIGUAS) {
          const re = new RegExp(`(?:\\w+:)?${tabla}(?:![\\w!]+)?\\(`, 'g')
          for (const e of sel.matchAll(re)) {
            const bloque = bloqueDe(sel, e.index! + e[0].length)
            // `members!algo(` está bien; `members(` pelado, no.
            for (const mm of bloque.matchAll(/(?:\w+:)?members\(/g)) {
              const linea = txt.slice(0, tl.index! + e.index! + mm.index!).split('\n').length
              malos.push(`${f}:${linea} → ${tabla} embebe ${mm[0]} sin FK`)
            }
          }
        }
      }
    }
    expect(malos).toEqual([])
  })
})
