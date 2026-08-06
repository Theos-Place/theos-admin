// PRE-10 · El wizard prematrimonial pasó de 4 pasos a 3: se quitó la pregunta
// del oficiante (Theos dejó de dirigir ceremonias) y el paso "La ceremonia"
// —que quedaba solo con la fecha— se fusionó con el de logística.
//
// Es un guard de pantalla, así que se verifica sobre el archivo: lo que importa
// es que la regla de la fecha NO se haya perdido en la mudanza.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CEREMONY_DATE_QUESTION } from './premat-background'

const WIZARD = 'src/app/(admin)/matricula/prematrimonial/page.tsx'
const src = readFileSync(WIZARD, 'utf8')

describe('el oficiante salió del wizard', () => {
  it('no queda la lista de oficiantes ni el estado', () => {
    expect(src).not.toContain('OFFICIANTS')
    expect(src).not.toContain('setOfficiant')
    expect(src).not.toMatch(/¿Quién te gustaría que dirigiera la ceremonia\?/)
  })

  it('no viaja en el payload de la solicitud', () => {
    expect(src).not.toMatch(/officiant:/)
  })

  it('el placeholder de comentarios ya no lo menciona', () => {
    expect(src).not.toMatch(/especificá acá para solicitar autorización/)
    expect(src).toContain('Comentarios adicionales (opcional)')
  })
})

describe('el wizard quedó en 3 pasos', () => {
  it('el indicador dice "de 3"', () => {
    expect(src).toContain('Paso {step} de 3')
  })

  it('el último paso es el 3 y ahí está el botón de enviar', () => {
    expect(src).toContain('{step === 3 && (')
    expect(src).not.toContain('{step === 4 && (')
    expect(src).toContain('{step < 3 ? (')
  })

  it('las validaciones siguen en su paso: pareja en el 1, antecedentes en el 2', () => {
    expect(src).toMatch(/step === 1 && \(!spouse/)
    expect(src).toMatch(/step === 2 && backgroundError !== null/)
  })
})

describe('la regla de la boda sobrevivió a la mudanza', () => {
  it('la pregunta se sigue usando desde su fuente, no copiada', () => {
    expect(src).toContain('{CEREMONY_DATE_QUESTION}')
    // Y la fuente sigue diciendo lo de los 6 meses (PRE-3/PRE-9).
    expect(CEREMONY_DATE_QUESTION).toMatch(/6 meses antes/)
  })

  it('el mínimo de la fecha y el checkbox siguen ahí', () => {
    expect(src).toContain('min={minWeddingDate}')
    expect(src).toContain('Fecha ya definida')
  })

  it('la fecha vive ahora en el paso 2, no en uno propio', () => {
    const paso2 = src.slice(src.indexOf('{step === 2 && ('), src.indexOf('{step === 3 && ('))
    expect(paso2).toContain('{CEREMONY_DATE_QUESTION}')
    expect(paso2).toContain('minWeddingDate')
  })
})

describe('los datos históricos no se tocan', () => {
  it('la cola sigue mostrando el oficiante de las solicitudes viejas', () => {
    const cola = readFileSync('src/components/studies/PrematrimonialQueue.tsx', 'utf8')
    expect(cola).toContain('r.officiant')
  })
})
