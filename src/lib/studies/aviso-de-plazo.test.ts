import { describe, it, expect } from 'vitest'
import {
  necesitaAviso, horasRestantes, textoDelAviso, textoDeLiberacion, HORAS_PARA_AVISAR,
} from './aviso-de-plazo'
import { HORAS_DE_GRACIA } from './enrollment-hold'

const base = { horas: 50, reviewStatus: null, yaAvisado: false }

describe('necesitaAviso', () => {
  it('avisa a las 24 horas, cuando quedan 48 y todavía se puede hacer algo', () => {
    expect(necesitaAviso({ ...base, horas: HORAS_PARA_AVISAR })).toBe(true)
  })

  it('NO avisa al matricularse', () => {
    // Ese aviso ya existió y se quitó con medición: 4 de 4 salían equivocados
    // porque la gente sube el comprobante en minutos.
    expect(necesitaAviso({ ...base, horas: 0 })).toBe(false)
    expect(necesitaAviso({ ...base, horas: 3 })).toBe(false)
    expect(necesitaAviso({ ...base, horas: HORAS_PARA_AVISAR - 0.1 })).toBe(false)
  })

  it('el aviso cae ANTES de la baja, o no sirve de nada', () => {
    // Las dos son constantes de negocio y se mueven: el aviso ya pasó de 48
    // a 24 (2026-10-12). Si alguien lo pone por encima del plazo de gracia,
    // la ventana queda vacía y NADIE recibe el aviso nunca — en silencio,
    // que es la peor forma de romperlo.
    expect(HORAS_PARA_AVISAR).toBeLessThan(HORAS_DE_GRACIA)
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
    expect(horasRestantes(24)).toBe(48)
    expect(horasRestantes(60)).toBe(12)
  })

  it('redondea hacia abajo: no promete más tiempo del que hay', () => {
    expect(horasRestantes(24.9)).toBe(47)
  })

  it('nunca es negativo', () => {
    expect(horasRestantes(100)).toBe(0)
  })
})

describe('los textos', () => {
  it('el aviso dice cuánto queda y qué pasa si no llega', () => {
    const t = textoDelAviso({ estudio: 'Nivel 3', horas: HORAS_PARA_AVISAR })
    // A las 24 de 72 quedan 48: el texto sale del cálculo, no de un literal.
    expect(t.body).toContain(`${HORAS_DE_GRACIA - HORAS_PARA_AVISAR} horas`)
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
