import { describe, it, expect } from 'vitest'
import {
  allowsCdebRecommendation, allowsNoInfoOption, validateCdebRecommendation,
  sanitizeCdebRecommendation, CDEB_REC_VIEW_ROLES, CONVICTION_TOPICS,
  RECOMMENDATION_OPTIONS, type CdebRecommendationInput,
} from './cdeb-recommendation'
import { allowsCloseRecommendations } from './close-recommendations'

function complete(over: Partial<CdebRecommendationInput> = {}): CdebRecommendationInput {
  return {
    member_id: 'm1',
    convictions: [],
    testimony_score: '4',
    testimony_notes: 'Compartió su testimonio en el grupo.',
    passion_score: '4',
    passion_notes: 'Invitó a un compañero de trabajo.',
    bible_knowledge_score: '3',
    speech_score: '4',
    speech_notes: 'Se expresa con claridad.',
    committee_notes: 'Buen candidato.',
    recommendation: 'si_sin_reservas',
    ...over,
  }
}

describe('allowsCdebRecommendation (EST-9)', () => {
  it('solo DIS3 y Panorama', () => {
    expect(allowsCdebRecommendation('DIS3')).toBe(true)
    expect(allowsCdebRecommendation('PAN')).toBe(true)
    expect(allowsCdebRecommendation('DIS1')).toBe(false)
    expect(allowsCdebRecommendation('N4')).toBe(false)
    expect(allowsCdebRecommendation('PREMAT')).toBe(false)
    expect(allowsCdebRecommendation(null)).toBe(false)
  })

  it('en DIS3/PAN NO se muestra el bloque simple de EST-3 (nunca los dos juntos)', () => {
    // La página calcula: canRecommend = !isCdebSource && allowsCloseRecommendations
    for (const code of ['DIS3', 'PAN']) {
      const isCdeb = allowsCdebRecommendation(code)
      expect(isCdeb && !(!isCdeb && allowsCloseRecommendations(code))).toBe(true)
    }
    // N4 y DIS1 conservan el bloque simple
    expect(allowsCdebRecommendation('N4')).toBe(false)
    expect(allowsCloseRecommendations('N4')).toBe(true)
    expect(allowsCloseRecommendations('DIS1')).toBe(true)
  })
})

describe('allowsNoInfoOption (EST-9)', () => {
  it('la opción X ("sin información suficiente") es SOLO de Panorama', () => {
    expect(allowsNoInfoOption('PAN')).toBe(true)
    expect(allowsNoInfoOption('DIS3')).toBe(false)
  })

  it('en DIS3 la X no vale como calificación', () => {
    expect(validateCdebRecommendation(complete({ testimony_score: 'x' }), 'DIS3')).toMatch(/testimonio/i)
    expect(validateCdebRecommendation(complete({ testimony_score: 'x' }), 'PAN')).toBeNull()
  })

  it('la X nunca aplica a conocimiento bíblico ni expresión, ni en Panorama', () => {
    expect(validateCdebRecommendation(complete({ bible_knowledge_score: 'x' }), 'PAN')).toMatch(/conocimiento/i)
    expect(validateCdebRecommendation(complete({ speech_score: 'x' }), 'PAN')).toMatch(/expresión/i)
  })
})

describe('validateCdebRecommendation (EST-9) — solo al ENVIAR', () => {
  it('recomendación completa pasa', () => {
    expect(validateCdebRecommendation(complete(), 'DIS3')).toBeNull()
  })

  it('las 4 escalas son obligatorias', () => {
    expect(validateCdebRecommendation(complete({ testimony_score: null }), 'DIS3')).toBeTruthy()
    expect(validateCdebRecommendation(complete({ passion_score: null }), 'DIS3')).toBeTruthy()
    expect(validateCdebRecommendation(complete({ bible_knowledge_score: null }), 'DIS3')).toBeTruthy()
    expect(validateCdebRecommendation(complete({ speech_score: null }), 'DIS3')).toBeTruthy()
  })

  it('los textos libres son obligatorios (aceptan "NA"); el de compromiso es opcional', () => {
    expect(validateCdebRecommendation(complete({ testimony_notes: '' }), 'DIS3')).toBeTruthy()
    expect(validateCdebRecommendation(complete({ passion_notes: '  ' }), 'DIS3')).toBeTruthy()
    expect(validateCdebRecommendation(complete({ speech_notes: '' }), 'DIS3')).toBeTruthy()
    expect(validateCdebRecommendation(complete({ committee_notes: '' }), 'DIS3')).toBeTruthy()
    // "NA" es respuesta válida
    expect(validateCdebRecommendation(complete({ testimony_notes: 'NA', passion_notes: 'NA' }), 'DIS3')).toBeNull()
    // compromiso vacío no bloquea
    expect(validateCdebRecommendation(complete({ commitment_notes: '' }), 'DIS3')).toBeNull()
  })

  it('convicciones POR EXCEPCIÓN: sin marcas no pide nada; marcada exige explicación', () => {
    expect(validateCdebRecommendation(complete({ convictions: [] }), 'DIS3')).toBeNull()
    const sinNota = complete({ convictions: [{ topic: 'mayordomia', stance: 'dudas' }] })
    expect(validateCdebRecommendation(sinNota, 'DIS3')).toMatch(/Mayordomía/)
    const conNota = complete({ convictions: [{ topic: 'mayordomia', stance: 'dudas', notes: 'Dudó al hablar de diezmo.' }] })
    expect(validateCdebRecommendation(conNota, 'DIS3')).toBeNull()
  })

  it('la recomendación final es obligatoria y del catálogo', () => {
    expect(validateCdebRecommendation(complete({ recommendation: null }), 'DIS3')).toBeTruthy()
    expect(validateCdebRecommendation(complete({ recommendation: 'quizas' }), 'DIS3')).toBeTruthy()
    for (const o of RECOMMENDATION_OPTIONS) {
      expect(validateCdebRecommendation(complete({ recommendation: o.value }), 'DIS3')).toBeNull()
    }
  })
})

describe('sanitizeCdebRecommendation (EST-9) — lo que se GUARDA', () => {
  it('descarta escalas y recomendación fuera de catálogo (borrador incluido)', () => {
    const r = sanitizeCdebRecommendation(complete({ testimony_score: '9', recommendation: 'raro' }), 'DIS3')
    expect(r.testimony_score).toBeNull()
    expect(r.recommendation).toBeNull()
  })

  it('la X se guarda en Panorama y se descarta en DIS3', () => {
    expect(sanitizeCdebRecommendation(complete({ passion_score: 'x' }), 'PAN').passion_score).toBe('x')
    expect(sanitizeCdebRecommendation(complete({ passion_score: 'x' }), 'DIS3').passion_score).toBeNull()
  })

  it('descarta convicciones con tema o postura inválidos', () => {
    const r = sanitizeCdebRecommendation(complete({
      convictions: [
        { topic: 'inventado', stance: 'dudas', notes: 'x' },
        { topic: 'mayordomia', stance: 'otra', notes: 'x' },
        { topic: 'salvacion_gracia', stance: 'contraria', notes: 'ok' },
      ],
    }), 'DIS3')
    expect(r.convictions).toEqual([{ topic: 'salvacion_gracia', stance: 'contraria', notes: 'ok' }])
  })

  it('recorta textos vacíos a null', () => {
    const r = sanitizeCdebRecommendation(complete({ commitment_notes: '   ' }), 'DIS3')
    expect(r.commitment_notes).toBeNull()
  })
})

describe('visibilidad (EST-9)', () => {
  it('solo comité de dirigentes, coord. estudios y admin — NI dirección NI el miembro', () => {
    expect(CDEB_REC_VIEW_ROLES).toEqual(['coordinador_dirigentes', 'coordinador_estudios', 'admin'])
    expect(CDEB_REC_VIEW_ROLES).not.toContain('direccion')
    expect(CDEB_REC_VIEW_ROLES).not.toContain('dirigente')
    expect(CDEB_REC_VIEW_ROLES).not.toContain('miembro')
  })
})

describe('catálogo de convicciones (EST-9)', () => {
  it('los 5 temas de la spec', () => {
    expect(CONVICTION_TOPICS.map(t => t.value)).toEqual([
      'sexualidad', 'mayordomia', 'autoridad_biblia', 'salvacion_gracia', 'identidad_genero',
    ])
  })
})
