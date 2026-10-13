import { describe, it, expect } from 'vitest'
import { saldosAFavor, type MatriculaConPagos } from './saldo-a-favor'
import { montoDelBloque } from '@/lib/studies/corte-de-bloque'
import { modalidadDe } from '@/lib/studies/modalidad-de-bloques'

/**
 * El saldo a favor se calcula contra lo que cuesta SU matrícula, y eso
 * depende de la MODALIDAD del grupo.
 *
 * EL FALSO POSITIVO (encontrado el 2026-10-13). La pantalla restaba contra
 * `plan.cost`. En un N1 de BLOQUES la persona paga ₡5.000 —el par N1+N2— y
 * el plan de N1 vale ₡0, así que la resta daba ₡5.000 de crédito que no
 * existe. Eran 10 personas del N1 de Escazú, ₡50.000 en total, y
 * devolvérselos las habría dejado sin el N2 que ya pagaron.
 *
 * Es el falso positivo más caro posible: el error se ve como plata a favor
 * de alguien, que es justo lo que invita a actuar sobre él.
 */
const COSTOS = { N1: 0, N2: 5000, N3: 5000, N4: 5000 }

const fila = (o: Partial<MatriculaConPagos> & { pagado: number }): MatriculaConPagos => ({
  enrollment_id: 'e', member_id: 'm', member_name: 'Quien Sea',
  group_name: 'N1', costo: 0, currency: 'CRC', ...o,
})

describe('saldo a favor según la modalidad del grupo', () => {
  it('en BLOQUES, pagar ₡5.000 por el par no deja saldo', () => {
    const costo = montoDelBloque('N1', COSTOS, modalidadDe('bloques'))
    expect(costo).toBe(5000)
    expect(saldosAFavor([fila({ pagado: 5000, costo })])).toEqual([])
  })

  it('en LEGACY, pagar ₡5.000 por un N1 gratis SÍ deja ₡5.000', () => {
    // Es el caso de las cinco personas del bug del 3 al 5 de octubre.
    const costo = montoDelBloque('N1', COSTOS, modalidadDe('legacy'))
    expect(costo).toBe(0)
    expect(saldosAFavor([fila({ pagado: 5000, costo })])[0].saldo).toBe(5000)
  })

  it('el MISMO pago da saldos distintos según la modalidad', () => {
    // Si esto deja de ser cierto, alguien volvió a restar contra plan.cost.
    const enBloques = montoDelBloque('N1', COSTOS, modalidadDe('bloques'))
    const enLegacy = montoDelBloque('N1', COSTOS, modalidadDe('legacy'))
    expect(saldosAFavor([fila({ pagado: 5000, costo: enBloques })])).toHaveLength(0)
    expect(saldosAFavor([fila({ pagado: 5000, costo: enLegacy })])).toHaveLength(1)
  })

  it('y quien pagó de más en un bloque sigue apareciendo', () => {
    // El arreglo no puede esconder los saldos reales.
    const costo = montoDelBloque('N3', COSTOS, modalidadDe('bloques'))
    expect(costo).toBe(10000)
    expect(saldosAFavor([fila({ pagado: 15000, costo })])[0].saldo).toBe(5000)
  })
})
