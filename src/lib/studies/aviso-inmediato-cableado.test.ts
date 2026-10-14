import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { TIPO_AVISO } from './aviso-de-plazo'

/**
 * MAT-4 · Los DOS avisos de una matrícula a medias, y que no se pisen.
 *
 *   · AL MOMENTO  (`matricula_apartada`)  — «te apartamos el campo, falta
 *     el comprobante». Lo dispara la matrícula misma.
 *   · A LAS 24 h  (`matricula_por_vencer`) — «se te vence». Lo manda el cron.
 *
 * POR QUÉ HACEN FALTA LOS DOS: el cron corre una vez al día a las 10:00, así
 * que quien se matricula a las 10:15 cumple las 24 horas quince minutos
 * después de que pase y su primer correo llega casi 48 horas tarde, con el
 * plazo medio consumido. Medido el 2026-10-13: los cuatro de «N1 — Escazú»
 * llevaban 32 horas sin recibir nada y les quedaban 40.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const QUERIES = sinComentarios('src/lib/supabase/queries/studies.ts')
const MODULO = sinComentarios('src/lib/supabase/queries/aviso-matricula-apartada.ts')

describe('los dos avisos son distintos y no se pisan', () => {
  it('tienen tipos distintos', () => {
    // Si compartieran tipo, el dedupe de uno silenciaría al otro.
    expect(MODULO).toContain("TIPO_APARTADA = 'matricula_apartada'")
    expect(TIPO_AVISO).toBe('matricula_por_vencer')
  })

  it('el de 24 h sigue mirando SOLO su propio tipo para el dedupe', () => {
    expect(QUERIES).toContain("eq('type', TIPO_AVISO)")
  })
})

describe('el aviso temprano NO sale al matricularse', () => {
  /**
   * LA CORRECCIÓN DE FLORIANA (2026-10-13). La primera versión lo disparaba
   * dentro de `enrollMember`, o sea en el instante de matricularse. En el
   * flujo normal la persona se matricula y sube el comprobante seguido, así
   * que ese correo le habría llegado también a quien hizo todo bien treinta
   * segundos después. Es el mismo error por el que se quitó el aviso del
   * 2026-09-01.
   */
  it('`enrollMember` no manda ningún aviso de matrícula apartada', () => {
    expect(QUERIES).not.toContain('avisarMatriculaApartada')
  })

  it('sale después de un rato sin comprobante, desde el barrido', () => {
    expect(MODULO).toContain('MINUTOS_PARA_AVISAR')
    expect(MODULO).toMatch(/MINUTOS_PARA_AVISAR = \d+/)
  })

  it('y no le sale a quien ya subió algo o tiene plan de pagos', () => {
    expect(MODULO).toContain('p.review_status')
    expect(MODULO).toContain('p.payment_plan_id')
  })

  it('registra la campanita ANTES del correo', () => {
    // La campanita es el registro de que ya se avisó. Al revés, si fallara
    // la campanita después de un correo enviado, se mandarían dos.
    const iCampanita = MODULO.indexOf("from('internal_notifications').insert")
    const iCorreo = MODULO.indexOf('sendSystemEmail')
    expect(iCampanita).toBeGreaterThan(-1)
    expect(iCorreo).toBeGreaterThan(iCampanita)
  })

  it('avisa UNA sola vez por matrícula', () => {
    expect(MODULO).toContain("eq('type', TIPO_APARTADA)")
    expect(MODULO).toMatch(/if \(yaHay\) return/)
  })

  it('sin correo en la ficha, la campanita igual queda', () => {
    expect(MODULO).toMatch(/if \(!input\.correo\) return \{ ok: true/)
  })
})
