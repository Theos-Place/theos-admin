import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ESTADOS_DE_INSCRIPCION } from './estados-de-inscripcion'

const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * Quien queda en `en_revision` no puede quedar atrapado.
 *
 * Ese estado lo deja el cierre cuando el dirigente no marca a alguien: la
 * persona queda ni aprobada ni reprobada. Hasta el 2026-09-28 `withdrawMember`
 * no lo aceptaba, así que «Quitar del grupo» devolvía NO_RETIRABLE y desde la
 * interfaz no se podía hacer NADA con esa persona — ni ponerle resultado ni
 * sacarla. Las de mayo llevaban cuatro meses así, y hubo que resolver cuatro
 * casos por SQL antes de encontrar el agujero.
 */
describe('quitar del grupo a alguien en «en revisión»', () => {
  const SRC = sinComentarios('src/lib/supabase/queries/studies.ts')
  const fn = SRC.slice(SRC.indexOf('export async function withdrawMember'))
  const cuerpo = fn.slice(0, 1200)

  it('withdrawMember acepta `en_revision`', () => {
    expect(cuerpo).toContain("'en_revision'")
  })

  it('y sigue aceptando los estados vivos de siempre', () => {
    for (const e of ['enrolled', 'pendiente_de_pago', 'waitlist']) {
      expect(cuerpo, e).toContain(`'${e}'`)
    }
  })

  it('NO acepta los que ya tienen desenlace', () => {
    // Sacar del grupo a alguien que ya aprobó o ya se retiró le reescribiría
    // el historial: eso se corrige en el cierre, no acá.
    const lista = /\.in\('status', \[([^\]]+)\]\)/.exec(cuerpo)?.[1] ?? ''
    for (const e of ['completed', 'reprobado', 'dropped', 'cancelada', 'transferred']) {
      expect(lista, e).not.toContain(`'${e}'`)
    }
  })

  it('cada estado de la lista existe de verdad', () => {
    // Un estado inventado acá no falla: simplemente nunca coincide, y la
    // acción se vuelve inútil en silencio. Es el mismo modo de falla que tuvo
    // el aviso de inicio con `withdrawn`.
    const lista = /\.in\('status', \[([^\]]+)\]\)/.exec(cuerpo)?.[1] ?? ''
    const nombres = [...lista.matchAll(/'([a-z_]+)'/g)].map(m => m[1])
    expect(nombres.length).toBeGreaterThan(3)
    for (const n of nombres) {
      expect(ESTADOS_DE_INSCRIPCION as readonly string[], n).toContain(n)
    }
  })
})
