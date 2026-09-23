import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

/**
 * QA-1/M1 · Nadie construye un `Date` a partir de una columna `date`.
 *
 * Este test es de CÓDIGO, no de cálculo: la regla es "qué no debe escribirse".
 * Existe porque el mismo error volvió tres veces con tres disfraces —el export
 * de cumpleaños (2026-09-21), los informes de donaciones (2026-09-22) y la
 * antigüedad de los empleados— y las tres veces se arregló solo donde había
 * salido.
 *
 * El mecanismo: `new Date('2026-01-01')` es medianoche UTC, que en Costa Rica
 * (UTC−6) son las 6 p.m. del 31 de diciembre. Cualquier `getMonth()`,
 * `getFullYear()` o `toLocaleDateString()` encima de eso sale corrido.
 *
 * Había DOS formas de esquivarlo —pegar 'T00:00:00' a mano, o los helpers de
 * `lib/format`— y esa es la razón de que la mitad de los sitios estuvieran
 * protegidos y la otra mitad no: no se veía cuál era la forma buena. Ahora hay
 * una sola: `lib/format` para mostrar, `lib/fecha/partes-de-fecha` para
 * comparar o agrupar.
 */

// Los nombres de columna `date` del esquema. No incluye los `timestamptz`
// (`paid_at`, `created_at`, `start_at`…), donde `new Date` es lo correcto:
// esos traen hora y zona, así que no hay nada que adivinar.
const COLUMNAS_DATE = [
  'donation_date', 'birth_date', 'start_date', 'end_date', 'due_date',
  'hire_date', 'payment_date',
]

describe('las columnas `date` no se convierten con new Date', () => {
  it('ni siquiera pegando T00:00:00, que era la otra forma', () => {
    const patron = COLUMNAS_DATE.map(c => `new Date\\([A-Za-z0-9_.?!]*\\.${c}\\b`).join('|')
    const salida = execSync(
      `grep -rEn '${patron}' src --include='*.ts' --include='*.tsx' || true`,
      { encoding: 'utf8', cwd: process.cwd() },
    ).trim()
    // El propio módulo documenta el bug en su comentario de cabecera: se salta.
    const lineas = salida
      ? salida.split('\n').filter(l => !l.startsWith('src/lib/fecha/partes-de-fecha.ts'))
      : []
    expect(lineas).toEqual([])
  })
})
