import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { formatDate, formatMonthYear } from '@/lib/format'

/**
 * FECHAS SIN HORA · el bug que vuelve.
 *
 * Una columna `date` de Postgres llega al navegador como "2026-09-23", sin
 * hora. `new Date("2026-09-23")` NO es el 23 a medianoche local: es el 23 a
 * medianoche UTC, que en Costa Rica —UTC-6— es el 22 a las 6 p.m. Al pintarlo
 * con `toLocaleDateString` sale LA VÍSPERA.
 *
 * Ya pasó tres veces y las tres se arreglaron por separado:
 *   · 2026-09-21 — el export de servidores corría TODOS los cumpleaños un día.
 *   · 2026-10-07 — Floriana: la asistencia de su grupo salía un día antes del
 *     que ella había registrado.
 *   · el mismo día, buscando el anterior: el historial del dirigente y la
 *     línea de salarios, que solo muestran mes y año y por eso se corrían
 *     únicamente cuando la fecha caía un día 1 — invisibles hasta que alguien
 *     los midiera.
 *
 * `formatDate` y compañía arman la fecha en hora local y no se corren. Este
 * test cuida las pantallas donde ya mordió: no es una regla general sobre
 * `new Date`, es la lista de los lugares que lo sufrieron.
 */

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Las pantallas que pintan una columna DATE y ya salieron corridas. */
const PANTALLAS: Array<{ ruta: string; campo: string; columna: string }> = [
  {
    ruta: 'src/app/(admin)/estudios/grupos/[id]/page.tsx',
    campo: 's.date',
    columna: 'study_sessions.session_date',
  },
  {
    ruta: 'src/app/(admin)/estudios/dirigentes/[id]/page.tsx',
    campo: 'd',
    columna: 'study_groups.starts_at / ends_at',
  },
  {
    ruta: 'src/components/employees/SalaryTimeline.tsx',
    campo: 'item.date',
    columna: 'salary_changes.change_date',
  },
]

describe('fechas sin hora · la víspera no vuelve', () => {
  it('el helper NO se corre, y el atajo crudo SÍ — por eso existe el helper', () => {
    // Si algún día `new Date('2026-09-23')` dejara de correrse, este test
    // perdería sentido y hay que saberlo.
    const crudo = new Date('2026-09-23')
    expect(crudo.getUTCHours()).toBe(0)           // medianoche UTC, no local
    expect(formatDate('2026-09-23')).toContain('23')
    expect(formatDate('2026-09-23')).not.toContain('22')
    // El 1 de un mes es donde muerde cuando solo se ve mes y año.
    expect(formatMonthYear('2026-10-01')).toContain('oct')
    expect(formatMonthYear('2026-10-01')).not.toContain('sep')
  })

  for (const p of PANTALLAS) {
    it(`${p.ruta} pinta ${p.columna} con el helper, no con new Date`, () => {
      const src = sinComentarios(p.ruta)
      // El atajo exacto que causó el bug, sobre ese campo.
      const atajo = new RegExp(
        `new Date\\(\\s*${p.campo.replace('.', '\\.')}\\s*\\)\\s*\\.toLocaleDateString`,
      )
      expect(src, `volvió el atajo sobre ${p.campo}`).not.toMatch(atajo)
      expect(src).toMatch(/from '@\/lib\/format'/)
    })
  }
})
