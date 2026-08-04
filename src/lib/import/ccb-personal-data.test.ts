import { describe, it, expect } from 'vitest'
import {
  normalizePhone, normalizeDoc, cleanText, cleanOccupation,
  parseNotaPanorama, similarity, bestMatch, splitServices, detectSede,
  type CatalogEntry,
} from './ccb-personal-data'

describe('normalizePhone', () => {
  it('CR: quita el espacio y deja 8 dígitos, como el resto del padrón', () => {
    expect(normalizePhone('8309 4310')).toEqual({ ok: true, value: '83094310', changed: 'espacios' })
    expect(normalizePhone('83094310')).toEqual({ ok: true, value: '83094310', changed: 'ninguno' })
  })

  it('acepta el 506 adelante y lo descarta', () => {
    expect(normalizePhone('+506 8309 4310')).toEqual({ ok: true, value: '83094310', changed: 'espacios' })
    expect(normalizePhone('506 8309 4310')).toEqual({ ok: true, value: '83094310', changed: 'espacios' })
  })

  it('NO destroza un internacional: pegarlo perdería el número', () => {
    // Del CSV real: hay 9 números españoles así.
    const r = normalizePhone('00 34 616 98 52 56')
    expect(r).toEqual({ ok: true, value: '00 34 616 98 52 56', changed: 'internacional' })
  })

  it('vacío no es un teléfono', () => {
    expect(normalizePhone('')).toEqual({ ok: false })
    expect(normalizePhone('   ')).toEqual({ ok: false })
    expect(normalizePhone(null)).toEqual({ ok: false })
  })
})

describe('normalizeDoc', () => {
  it('cédula CR de 9 dígitos', () => {
    expect(normalizeDoc('105760299')).toEqual({ ok: true, value: '105760299', kind: 'cr_9', changed: false })
  })

  it('quita guiones y espacios', () => {
    expect(normalizeDoc('1-1324-0329')).toEqual({ ok: true, value: '113240329', kind: 'cr_9', changed: true })
    expect(normalizeDoc('4 0195 0950')).toEqual({ ok: true, value: '401950950', kind: 'cr_9', changed: true })
  })

  it('DIMEX de 12 se reconoce como tal', () => {
    const r = normalizeDoc('117000652500')
    expect(r.ok && r.kind).toBe('dimex')
  })

  it('documento extranjero: se respeta tal cual, en mayúscula', () => {
    expect(normalizeDoc('Y5470880E')).toEqual({ ok: true, value: 'Y5470880E', kind: 'alfanumerico', changed: false })
    expect(normalizeDoc('ya6979335')).toEqual({ ok: true, value: 'YA6979335', kind: 'alfanumerico', changed: true })
  })

  it('numérico de otro largo se marca aparte, no se rechaza', () => {
    const r = normalizeDoc('1917335')
    expect(r.ok && r.kind).toBe('otro_numerico')
  })

  it('vacío', () => {
    expect(normalizeDoc('')).toEqual({ ok: false })
    expect(normalizeDoc('  -  ')).toEqual({ ok: false })
  })
})

describe('cleanText / cleanOccupation', () => {
  it('colapsa espacios', () => {
    expect(cleanText('  The   People  Beat ')).toBe('The People Beat')
  })

  it('vacío → null, para no pisar un dato bueno con nada', () => {
    expect(cleanText('')).toBeNull()
    expect(cleanText('   ')).toBeNull()
  })

  it('"0" en Dedicacion es basura del export, no una ocupación', () => {
    expect(cleanOccupation('0')).toBeNull()
    expect(cleanOccupation('Administración')).toBe('Administración')
    // Pero un "0" en otro campo sí es texto.
    expect(cleanText('0')).toBe('0')
  })
})

describe('parseNotaPanorama', () => {
  it('número con punto', () => {
    expect(parseNotaPanorama('92.3')).toEqual({ kind: 'numero', value: 92.3, excedeColumna: false })
  })

  it('coma decimal: 90,7 es 90.7 y no 907', () => {
    expect(parseNotaPanorama('90,7')).toEqual({ kind: 'numero', value: 90.7, excedeColumna: false })
  })

  it('marca las que NO caben en numeric(4,2)', () => {
    expect(parseNotaPanorama('100')).toEqual({ kind: 'numero', value: 100, excedeColumna: true })
    expect(parseNotaPanorama('105.2')).toEqual({ kind: 'numero', value: 105.2, excedeColumna: true })
    const r = parseNotaPanorama('99.99')
    expect(r.kind === 'numero' && r.excedeColumna).toBe(false)
  })

  it('textos conocidos', () => {
    expect(parseNotaPanorama('reprobo')).toEqual({ kind: 'reprobado' })
    expect(parseNotaPanorama('no hay registro de nota')).toEqual({ kind: 'sin_registro' })
  })

  it('un texto libre no se convierte en número', () => {
    expect(parseNotaPanorama('no hay info, dirigente')).toEqual({ kind: 'texto', value: 'no hay info, dirigente' })
  })

  it('vacío', () => {
    expect(parseNotaPanorama('')).toEqual({ kind: 'vacio' })
    expect(parseNotaPanorama(null)).toEqual({ kind: 'vacio' })
  })
})

describe('similarity', () => {
  it('igual tras normalizar = 1 (tildes incluidas)', () => {
    expect(similarity('Oracion', 'Oración')).toBe(1)
    expect(similarity('COCINA', 'cocina')).toBe(1)
  })

  it('variantes del mismo puesto puntúan alto', () => {
    expect(similarity('Dirigente Estudio', 'Dirigente de Estudio')).toBeGreaterThan(0.8)
  })

  it('cosas distintas puntúan bajo', () => {
    expect(similarity('Cocina', 'Worship')).toBeLessThan(0.2)
  })
})

describe('splitServices', () => {
  it('separa celdas multi-valor', () => {
    expect(splitServices('Worship, Oración')).toEqual(['Worship', 'Oración'])
    expect(splitServices('Encargado Comite Planificación, Charlista, Comité Dirección'))
      .toEqual(['Encargado Comite Planificación', 'Charlista', 'Comité Dirección'])
  })

  it('vacío no genera items fantasma', () => {
    expect(splitServices('')).toEqual([])
    expect(splitServices(', ,')).toEqual([])
    expect(splitServices(null)).toEqual([])
  })
})

describe('detectSede', () => {
  const sedes = ['Oeste SJ', 'Antares', 'Escazú', 'Este SJ', 'Heredia']

  it('encuentra la sede mencionada', () => {
    expect(detectSede('Cocina Antares', sedes)).toBe('Antares')
    expect(detectSede('Comidas Escazú', sedes)).toBe('Escazú')
  })

  it('no confunde "este" dentro de "oeste"', () => {
    expect(detectSede('Bienvenida Oeste', sedes)).not.toBe('Este SJ')
  })

  it('null cuando el texto no menciona sede', () => {
    expect(detectSede('Oración', sedes)).toBeNull()
  })
})

describe('bestMatch', () => {
  const catalog: CatalogEntry[] = [
    { id: '1', label: 'Colaborador', kind: 'puesto', area: 'Comité de Oración' },
    { id: '2', label: 'Colaborador de Comida', kind: 'puesto', area: 'Comité de Cocina' },
    { id: '3', label: 'Dirigente de Estudio', kind: 'puesto', area: 'Estudios' },
    { id: '4', label: 'Comité de Oración', kind: 'comite', area: null },
  ]

  it('pega la variante sin tilde con el catálogo', () => {
    const m = bestMatch('Oracion', catalog)
    // Contenida como palabra completa: sube a 0.85 aunque el label sea más largo.
    expect(m.score).toBeGreaterThanOrEqual(0.85)
    expect(m.entry?.label).toContain('Oración')
  })

  it('"Dirigente Estudio" cae en "Dirigente de Estudio"', () => {
    expect(bestMatch('Dirigente Estudio', catalog).entry?.id).toBe('3')
  })

  it('catálogo vacío no revienta: devuelve score 0', () => {
    expect(bestMatch('lo que sea', [])).toEqual({ entry: null, score: 0 })
  })
})

describe('similarity: el piso por palabra contenida', () => {
  it('una palabra completa dentro de un label largo no se hunde', () => {
    // Con Dice puro esto daba 0.60 y quedaba mezclado con el ruido.
    expect(similarity('Oracion', 'Comité de Oración')).toBeGreaterThanOrEqual(0.85)
    expect(similarity('Cocina', 'Colaborador de Cocina')).toBeGreaterThanOrEqual(0.85)
  })

  it('NO aplica a fragmentos cortos: "de" no vuelve todo un match', () => {
    expect(similarity('de', 'Colaborador de Cocina')).toBeLessThan(0.5)
  })

  it('una palabra que aparece a medias no gana el piso', () => {
    expect(similarity('cina', 'Colaborador de Cocina')).toBeLessThan(0.85)
  })
})

describe('bestMatch: nunca sugiere con score 0', () => {
  const catalog: CatalogEntry[] = [
    { id: '1', label: 'Logística', kind: 'puesto', area: 'Sede Heredia' },
    { id: '2', label: 'Anfitrión', kind: 'puesto', area: 'Sede Alajuela' },
  ]

  it('sin nada parecido devuelve entry null, no el primero del catálogo', () => {
    const m = bestMatch('zzzz', catalog)
    expect(m.score).toBe(0)
    expect(m.entry).toBeNull()
  })
})
