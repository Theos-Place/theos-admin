import { describe, it, expect } from 'vitest'
import {
  necesitaAviso, horasRestantes, textoDelAviso, textoDeLiberacion, HORAS_PARA_AVISAR,
} from './aviso-de-plazo'
import { HORAS_DE_GRACIA } from './enrollment-hold'

const base = { horas: 50, reviewStatus: null, yaAvisado: false }

describe('necesitaAviso', () => {
  it('avisa a las 48 horas, cuando quedan 24 y todavía se puede hacer algo', () => {
    expect(necesitaAviso({ ...base, horas: HORAS_PARA_AVISAR })).toBe(true)
  })

  it('NO avisa al matricularse', () => {
    // Ese aviso ya existió y se quitó con medición: 4 de 4 salían equivocados
    // porque la gente sube el comprobante en minutos.
    expect(necesitaAviso({ ...base, horas: 0 })).toBe(false)
    expect(necesitaAviso({ ...base, horas: 3 })).toBe(false)
    expect(necesitaAviso({ ...base, horas: 47.9 })).toBe(false)
  })

  it('pasado el plazo ya no avisa: eso es una baja, no un aviso', () => {
    expect(necesitaAviso({ ...base, horas: HORAS_DE_GRACIA })).toBe(false)
    expect(necesitaAviso({ ...base, horas: 200 })).toBe(false)
  })

  it('quien ya subió comprobante no recibe nada', () => {
    for (const r of ['en_revision', 'aprobado', 'rechazado']) {
      expect(necesitaAviso({ ...base, reviewStatus: r }), r).toBe(false)
    }
  })

  it('con plan de pagos tampoco: no se le va a soltar el cupo', () => {
    expect(necesitaAviso({ ...base, conPlanDePagos: true })).toBe(false)
  })

  it('se avisa UNA vez, no todos los días', () => {
    // El barrido corre a diario y la ventana dura 24 horas: sin esto, dos avisos.
    expect(necesitaAviso({ ...base, yaAvisado: true })).toBe(false)
  })
})

describe('horasRestantes', () => {
  it('cuenta lo que falta para el plazo', () => {
    expect(horasRestantes(48)).toBe(24)
    expect(horasRestantes(60)).toBe(12)
  })

  it('redondea hacia abajo: no promete más tiempo del que hay', () => {
    expect(horasRestantes(48.9)).toBe(23)
  })

  it('nunca es negativo', () => {
    expect(horasRestantes(100)).toBe(0)
  })
})

describe('los textos', () => {
  it('el aviso dice cuánto queda y qué pasa si no llega', () => {
    const t = textoDelAviso({ estudio: 'Nivel 3', horas: 48 })
    expect(t.body).toContain('24 horas')
    expect(t.body).toContain('Nivel 3')
    expect(t.body).toMatch(/libera/i)
  })

  it('el de liberación explica que se puede volver', () => {
    const t = textoDeLiberacion({ estudio: 'Nivel 3' })
    expect(t.body).toContain(String(HORAS_DE_GRACIA))
    expect(t.body).toMatch(/volver a matricularte/i)
  })

  it('los textos siguen el plazo, no lo repiten a mano', () => {
    // Si mañana el plazo cambia, los mensajes cambian solos.
    expect(textoDeLiberacion({ estudio: 'X' }).body).toContain('72')
  })
})
