import { describe, it, expect } from 'vitest'
import {
  VACANCY_STATES, VACANCY_STATE_LABEL, VACANCY_STATE_BADGE, VACANCY_STATE_HELP,
  isVacancyState, ESTADO_INICIAL,
} from './vacancy-states'

/**
 * El vocabulario lo renombró SRV-15 (migración 20260926090000). Antes eran
 * cinco nombres —creado, enviado_lider, aprobado, denegado, cerrada— con dos
 * problemas: 'enviado_lider' era un paso que nunca se usó (cero filas en las
 * dos bases), y 'cerrada' significaba lo mismo que «ya no está publicada».
 */
describe('vacancy-states · el ciclo de SRV-15', () => {
  it('son los tres del ciclo más «denegado»', () => {
    expect(VACANCY_STATES).toEqual([
      'lista_para_publicar', 'publicada', 'despublicada', 'denegado',
    ])
  })

  it('toda solicitud entra «lista para publicar»: nada se publica solo', () => {
    expect(ESTADO_INICIAL).toBe('lista_para_publicar')
  })

  it('los nombres viejos ya no son estados válidos', () => {
    // Si una fila quedara con uno —por un script o un rollback a medias—, el
    // sistema tiene que tratarla como desconocida y no como publicable.
    for (const viejo of ['creado', 'enviado_lider', 'aprobado', 'cerrada']) {
      expect(isVacancyState(viejo), viejo).toBe(false)
    }
  })

  it('ni los legacy que ya había absorbido la migración de julio', () => {
    for (const legacy of ['draft', 'published', 'filled', 'closed']) {
      expect(isVacancyState(legacy), legacy).toBe(false)
    }
  })

  it('cada estado tiene etiqueta, explicación y badge', () => {
    // La explicación no es decoración: «lista para publicar» y «publicada» se
    // parecen en el texto y no en las consecuencias — solo la segunda se ve
    // desde afuera.
    for (const s of VACANCY_STATES) {
      expect(VACANCY_STATE_LABEL[s], s).toBeTruthy()
      expect(VACANCY_STATE_HELP[s], s).toBeTruthy()
      expect(VACANCY_STATE_BADGE[s], s).toBeTruthy()
    }
  })
})
