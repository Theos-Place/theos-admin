// Un embed entre `members` y una tabla que tiene MÁS DE UNA clave foránea a
// members revienta si no se nombra la FK: PostgREST no puede elegir y responde
// "Could not embed because more than one relationship was found".
//
// Pasó DOS VECES, y la segunda porque este test estaba mal pensado:
//
//  1. 2026-08-21 — la migración de FRM-4 agregó `recorded_by` a cinco tablas y
//     rompió los embeds `tabla → members`: detalle de grupo ("grupo no
//     encontrado"), análisis de estudios y dos notificadores de correo.
//  2. 2026-08-24 — la MISMA migración rompió la dirección contraria,
//     `members → study_enrollments`, y este test no la miraba. Resultado: el
//     listado de miembros entero en 500, y con él guardar listas y buscar por
//     nombre.
//
// La lección del segundo caso: la ambigüedad es del PAR de tablas, no de una
// dirección. Si members y X tienen dos FK entre sí, hay que nombrar la FK
// embebas X desde members o members desde X. Este test ahora mira las dos.
//
// Lo que este test NO puede ver, y hay que decirlo: asocia cada select con el
// `.from('tabla')` más cercano hacia arriba en el mismo archivo. Un select
// guardado en una constante lejos de su `.from()` queda fuera de su alcance.
// Ni el typecheck ni los tests de unidad validan el string del select, así que
// para esos casos la única red es correr la consulta de verdad.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/** Tablas con MÁS DE UNA FK a members. Se mantiene a mano A PROPÓSITO: quien
 *  agregue una FK nueva a members tiene que sumar la tabla acá, y al hacerlo el
 *  test le dice exactamente qué selects hay que desambiguar. */
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

const archivos = execSync("grep -rl 'from(' src --include='*.ts'", { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)

/** El contenido de `algo(...)`, respetando paréntesis anidados. */
function bloqueDe(sel: string, desde: number): string {
  let prof = 1, i = desde
  while (i < sel.length && prof > 0) {
    if (sel[i] === '(') prof++
    else if (sel[i] === ')') prof--
    i++
  }
  return sel.slice(desde, i)
}

/** Embeds bare (sin `!fk`) de `tabla` dentro de `sel`, con su offset. */
function embedsSinFk(sel: string, tabla: string): number[] {
  const re = new RegExp(`(?:\\w+:)?${tabla}\\(`, 'g')
  return [...sel.matchAll(re)].map(m => m.index!)
}

/** Tabla del `.from('x')` más cercano ANTES de `pos` en el archivo. */
function raizDe(txt: string, pos: number): string | null {
  const antes = txt.slice(0, pos)
  const froms = [...antes.matchAll(/\.from\(\s*['"]([\w]+)['"]/g)]
  return froms.length ? froms[froms.length - 1][1] : null
}

function linea(txt: string, pos: number): number {
  return txt.slice(0, pos).split('\n').length
}

describe('embeds entre members y sus tablas ambiguas', () => {
  // Dirección A: FROM tabla_ambigua → embebe members. El caso de 2026-08-21.
  it('embebiendo members desde una tabla ambigua, la FK va nombrada', () => {
    const malos: string[] = []
    for (const f of archivos) {
      const txt = readFileSync(f, 'utf8')
      for (const tl of txt.matchAll(/`[^`]*`/g)) {
        const sel = tl[0]
        if (!sel.includes('members(')) continue
        for (const tabla of TABLAS_AMBIGUAS) {
          // Anidado: tabla_ambigua( … members( … ) )
          for (const e of sel.matchAll(new RegExp(`(?:\\w+:)?${tabla}(?:![\\w!]+)?\\(`, 'g'))) {
            const bloque = bloqueDe(sel, e.index! + e[0].length)
            for (const mm of embedsSinFk(bloque, 'members')) {
              malos.push(`${f}:${linea(txt, tl.index! + e.index! + mm)} → ${tabla} embebe members sin FK`)
            }
          }
          // Raíz: .from('tabla_ambigua') y members( al primer nivel.
          if (raizDe(txt, tl.index!) !== tabla) continue
          for (const mm of embedsSinFk(sel, 'members')) {
            malos.push(`${f}:${linea(txt, tl.index! + mm)} → from(${tabla}) embebe members sin FK`)
          }
        }
      }
    }
    expect([...new Set(malos)]).toEqual([])
  })

  // Dirección B: FROM members → embebe la tabla ambigua. El caso de 2026-08-24,
  // el que se escapó. Un embed sin `!fk` acá tumba la pantalla entera.
  it('embebiendo una tabla ambigua desde members, la FK va nombrada', () => {
    const malos: string[] = []
    for (const f of archivos) {
      const txt = readFileSync(f, 'utf8')
      for (const tl of txt.matchAll(/`[^`]*`/g)) {
        const sel = tl[0]
        const desdeMembers = raizDe(txt, tl.index!) === 'members'
        for (const tabla of TABLAS_AMBIGUAS) {
          if (desdeMembers) {
            for (const mm of embedsSinFk(sel, tabla)) {
              malos.push(`${f}:${linea(txt, tl.index! + mm)} → from(members) embebe ${tabla} sin FK`)
            }
          }
          // Anidado: members( … tabla_ambigua( … ) )
          for (const e of sel.matchAll(/(?:\w+:)?members(?:![\w!]+)?\(/g)) {
            const bloque = bloqueDe(sel, e.index! + e[0].length)
            for (const mm of embedsSinFk(bloque, tabla)) {
              malos.push(`${f}:${linea(txt, tl.index! + e.index! + mm)} → members embebe ${tabla} sin FK`)
            }
          }
        }
      }
    }
    expect([...new Set(malos)]).toEqual([])
  })
})
