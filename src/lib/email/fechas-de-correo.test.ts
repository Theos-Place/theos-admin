import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fechaCR } from '@/lib/fecha-cr'

/**
 * Guardián del bug del 2026-09-10: a Sonia Arias le llegó su confirmación de
 * matrícula diciendo que el grupo empezaba el 28 de setiembre. Empezaba el 29,
 * que es martes — el día del grupo.
 *
 * La causa era que cada plantilla tenía su propia línea de formateo, y una de
 * las tres convertía una fecha SIN hora a zona de Costa Rica, corriéndola un
 * día para atrás. Dos ya estaban parchadas a mano; la tercera no.
 */
const CORREOS_CON_FECHAS_DE_GRUPO = [
  'src/lib/email/enrollment-notify.ts',
  'src/lib/email/close-reminder-notify.ts',
  'src/lib/email/study-start-notify.ts',
]

describe('las fechas de grupo en los correos', () => {
  it('el caso de Sonia: 2026-09-29 se lee como 29, y es martes', () => {
    const texto = fechaCR('2026-09-29', 'larga-2d')
    expect(texto).toBe('29 de septiembre de 2026')
    const [a, m, d] = '2026-09-29'.split('-').map(Number)
    expect(new Date(Date.UTC(a, m - 1, d)).getUTCDay()).toBe(2) // martes
  })

  it('ninguna plantilla de grupo vuelve a formatear la fecha por su cuenta', () => {
    const culpables = CORREOS_CON_FECHAS_DE_GRUPO.filter(f => {
      const src = readFileSync(f, 'utf8')
      // Una conversión a zona CR sobre una fecha de grupo es justo el error.
      return /toLocaleDateString\([^)]*America\/Costa_Rica/.test(src)
    })
    expect(culpables).toEqual([])
  })

  it('todas pasan por el helper compartido', () => {
    for (const f of CORREOS_CON_FECHAS_DE_GRUPO) {
      expect(readFileSync(f, 'utf8')).toContain("from '@/lib/fecha-cr'")
    }
  })
})
