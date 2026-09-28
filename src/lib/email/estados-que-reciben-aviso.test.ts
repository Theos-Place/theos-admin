import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ESTADOS_DE_INSCRIPCION, sigueEnElGrupo, esEstadoDeInscripcion, RECIBEN_EL_AVISO,
} from '@/lib/studies/estados-de-inscripcion'

const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * El aviso «tu capacitación está por comenzar» le llegó a gente que ya no
 * estaba en el grupo, y el motivo fue un estado inventado: el filtro decía
 * `!== 'withdrawn'` y `withdrawn` NO EXISTE en esta base (el retiro es
 * `dropped`). Un filtro que excluye un valor imposible no excluye nada.
 *
 * Estas pruebas atacan esa clase de error, no el caso: que ningún estado que
 * se nombre sea inventado, y que ninguno real entre sin que alguien lo decida.
 */
describe('avisos de inicio · el filtro no puede nombrar estados que no existen', () => {
  it('todos los que reciben son estados REALES de la base', () => {
    // Es la prueba que faltaba: con ella, `withdrawn` se cae al instante.
    for (const e of RECIBEN_EL_AVISO) {
      expect(esEstadoDeInscripcion(e), `«${e}» no es un estado real`).toBe(true)
    }
  })

  it('reciben exactamente los dos que se decidieron: matriculada y pendiente de pago', () => {
    // Reglas de Floriana, 2026-09-28. `pendiente_de_pago` SÍ, porque la
    // matrícula es efectiva de inmediato y el pago va por un carril aparte.
    expect([...RECIBEN_EL_AVISO].sort()).toEqual(['enrolled', 'pendiente_de_pago'])
  })

  it('NO reciben los que ya no están en el grupo', () => {
    for (const e of ['dropped', 'cancelada', 'transferred', 'completed', 'reprobado', 'en_revision']) {
      expect(RECIBEN_EL_AVISO.has(e), e).toBe(false)
    }
  })

  it('quien se pasó de grupo queda fuera ACÁ, y le llega por su grupo nuevo', () => {
    // La transferencia crea una inscripción `enrolled` en el destino, así que
    // no hace falta nada más. Verificado con los cinco casos de setiembre:
    // recibieron dos correos, el del grupo nuevo y el del viejo que sobraba.
    expect(RECIBEN_EL_AVISO.has('transferred')).toBe(false)
    expect(RECIBEN_EL_AVISO.has('enrolled')).toBe(true)
  })

  it('la lista de estados es la que se MIDIÓ, no una que se fue achicando', () => {
    // Sin esto, borrar un estado de la lista hace que el test de abajo itere
    // menos y pase igual — probado con un cebo, que no mordió. Se nombran los
    // ocho que existen en producción (medidos el 2026-09-28, 36.056 filas).
    expect([...ESTADOS_DE_INSCRIPCION].sort()).toEqual([
      'cancelada', 'completed', 'dropped', 'en_revision',
      'enrolled', 'pendiente_de_pago', 'reprobado', 'transferred',
    ])
  })

  it('cada estado REAL está decidido: ninguno queda sin clasificar', () => {
    // Si mañana aparece un estado nuevo, este test falla y alguien tiene que
    // decir si recibe o no. Con una lista negra habría entrado solo.
    for (const e of ESTADOS_DE_INSCRIPCION) {
      expect(typeof RECIBEN_EL_AVISO.has(e), e).toBe('boolean')
      expect(RECIBEN_EL_AVISO.has(e), e).toBe(sigueEnElGrupo(e))
    }
  })
})

describe('avisos de inicio · cableado', () => {
  const SRC = sinComentarios('src/lib/email/study-start-notify.ts')

  it('el envío filtra con la lista blanca, no con una negación', () => {
    expect(SRC).toContain('RECIBEN_EL_AVISO.has(e.status)')
    // Una negación deja entrar por omisión todo lo que no se nombró: es
    // exactamente cómo se coló esto.
    expect(SRC).not.toMatch(/status !== '[a-z_]+'/)
  })

  it('el estado inventado no vuelve a aparecer en ningún lado del envío', () => {
    expect(SRC).not.toContain('withdrawn')
  })
})
