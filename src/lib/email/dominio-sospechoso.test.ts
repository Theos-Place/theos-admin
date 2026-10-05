import { describe, it, expect } from 'vitest'
import {
  correoSugerido, avisoDeDominio, dominioDe, DOMINIOS_MAL_ESCRITOS,
} from '@/lib/email/dominio-sospechoso'

describe('dominios de correo mal escritos', () => {
  it('el caso que lo motivó: hotmal.com', () => {
    // Diego Alfaro Cardozo. Su correo rebotaba contra un dominio que no
    // existe y de este lado todo se veía normal.
    expect(correoSugerido('diego-alfaro@hotmal.com')).toBe('diego-alfaro@hotmail.com')
  })

  it('los demás dedazos que hay en producción', () => {
    const casos: Array<[string, string]> = [
      ['x@gmai.com', 'x@gmail.com'],
      ['x@gmial.com', 'x@gmail.com'],
      ['x@gamil.com', 'x@gmail.com'],
      ['x@hormail.com', 'x@hotmail.com'],
      ['x@gmail.con', 'x@gmail.com'],
      ['x@gmail.co', 'x@gmail.com'],
      ['x@outlok.com', 'x@outlook.com'],
    ]
    for (const [malo, bueno] of casos) expect(correoSugerido(malo), malo).toBe(bueno)
  })

  it('devuelve el correo ENTERO, no solo el dominio', () => {
    // Para que la pantalla lo ofrezca tal cual: reescribirlo a mano es donde
    // se mete el siguiente dedazo.
    expect(correoSugerido('nombre.apellido+etiqueta@gmai.com'))
      .toBe('nombre.apellido+etiqueta@gmail.com')
  })

  it('un dominio bueno no sugiere nada', () => {
    for (const ok of ['x@gmail.com', 'x@hotmail.com', 'x@theosplace.org', 'x@empresa.cr']) {
      expect(correoSugerido(ok), ok).toBeNull()
    }
  })

  it('no bloquea un dominio raro pero legítimo', () => {
    // Existen correos de empresa poco comunes; bloquearlos sería peor que el
    // problema. La lista es de dedazos conocidos, no una lista blanca.
    expect(correoSugerido('persona@bufete-rojas-y-asociados.cr')).toBeNull()
  })

  it('lo que no es un correo no revienta', () => {
    for (const basura of [null, undefined, '', 'sinarroba', 'a@b@c']) {
      expect(correoSugerido(basura as string | null)).toBeNull()
    }
    expect(dominioDe('sinarroba')).toBe('')
  })

  it('no distingue mayúsculas', () => {
    expect(correoSugerido('Diego-Alfaro@HOTMAL.COM')).toBe('Diego-Alfaro@hotmail.com')
  })

  it('el aviso es una pregunta, no una orden', () => {
    expect(avisoDeDominio('x@gmai.com')).toBe('¿Quisiste decir x@gmail.com?')
    expect(avisoDeDominio('x@gmail.com')).toBe('')
  })

  it('ningún dedazo apunta a otro dedazo', () => {
    // Sugerir un dominio que también está mal sería un ciclo absurdo.
    for (const [malo, bueno] of Object.entries(DOMINIOS_MAL_ESCRITOS)) {
      expect(DOMINIOS_MAL_ESCRITOS[bueno], `${malo} → ${bueno}`).toBeUndefined()
    }
  })
})
