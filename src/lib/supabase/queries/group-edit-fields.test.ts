// La pantalla de EDITAR un grupo no lee el detalle: toma el grupo de la LISTA
// (useStudies('groups') → groups.find(g => g.id === id)) y con eso inicializa
// sus useState.
//
// Consecuencia, y por eso este test existe: si un campo que el formulario
// ESCRIBE no viene en LIST_GROUP_SELECT, el input arranca vacío aunque la base
// tenga el dato, y al guardar se manda null. No es que no guarde — BORRA lo que
// había, sin ningún error a la vista.
//
// Pasó el 2026-08-24 con la ventana de matrícula (enrollment_start_date /
// enrollment_end_date): faltaban en el select, y editar un grupo por cualquier
// motivo le borraba las fechas. Solo 15 de 2.185 grupos las conservaban.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const QUERIES = readFileSync('src/lib/supabase/queries/studies.ts', 'utf8')
const FORM = readFileSync('src/app/(admin)/estudios/grupos/[id]/editar/page.tsx', 'utf8')

/** El contenido del template literal asignado a `nombre`. */
function selectDe(nombre: string): string {
  const i = QUERIES.indexOf(`const ${nombre} = \``)
  expect(i, `no se encontró ${nombre}`).toBeGreaterThan(-1)
  const desde = QUERIES.indexOf('`', i) + 1
  return QUERIES.slice(desde, QUERIES.indexOf('`', desde))
}

/** Columnas que el formulario de edición manda en el body del PUT. */
function camposQueEscribeElForm(): string[] {
  const i = FORM.indexOf('JSON.stringify({')
  expect(i, 'no se encontró el body del PUT').toBeGreaterThan(-1)
  const cuerpo = FORM.slice(i, FORM.indexOf('}),', i))
  return [...new Set([...cuerpo.matchAll(/^\s{10}(\w+):/gm)].map(m => m[1]))]
}

describe('la lista trae todo lo que el formulario de edición escribe', () => {
  // Nombres de dominio que el adapter mapea desde otra columna: el form manda
  // el nombre de la COLUMNA y el select también, pero el objeto de dominio los
  // expone distinto. Se listan a mano porque el mapeo vive en el adapter.
  const EQUIVALENTES: Record<string, string> = {
    starts_at: 'starts_at',
    ends_at: 'ends_at',
    max_students: 'max_students',
  }

  const lista = selectDe('LIST_GROUP_SELECT')

  it('ningún campo escrito falta en LIST_GROUP_SELECT', () => {
    const faltantes = camposQueEscribeElForm()
      .map(c => EQUIVALENTES[c] ?? c)
      .filter(c => !new RegExp(`\\b${c}\\b`).test(lista))
    expect(faltantes).toEqual([])
  })

  it('la ventana de matrícula está, que es la que se perdió', () => {
    expect(lista).toContain('enrollment_start_date')
    expect(lista).toContain('enrollment_end_date')
  })

  it('el detalle también las trae', () => {
    const detalle = selectDe('GROUP_SELECT')
    expect(detalle).toContain('enrollment_start_date')
    expect(detalle).toContain('enrollment_end_date')
  })
})
