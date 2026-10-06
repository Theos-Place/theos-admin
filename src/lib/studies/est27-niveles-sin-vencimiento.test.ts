import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esNivel, excepcionVigente } from './exception-scope'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('EST-27 · una excepción de NIVEL no vence', () => {
  const AYER = { cierreMatricula: '2026-09-13', hoy: '2026-10-06', status: 'active' }

  it('el caso real: el bloque cerró hace un mes y la excepción SIGUE viva', () => {
    /**
     * Tres excepciones de Nivel 1 estaban muertas sin que nadie lo supiera
     * —Jose Fabio Quesada por edad, Kenneth Campos y Kristal Monge para
     * repetir— porque el «Bloque 3 2026» cerró el 13 de setiembre.
     */
    for (const code of ['N1', 'N2', 'N3', 'N4']) {
      expect(excepcionVigente({ ...AYER, planCode: code }), code).toBe(true)
    }
  })

  it('en CAPACITACIONES el bloque sigue mandando', () => {
    // Ahí el bloque SÍ es la unidad real: la regla nueva es solo para
    // niveles, no se barre parejo.
    for (const code of ['SCJ', 'DIS1', 'EVM', 'CDEB', 'PAN', 'HER']) {
      expect(excepcionVigente({ ...AYER, planCode: code }), code).toBe(false)
    }
  })

  it('el día del cierre TODAVÍA vale, también en capacitaciones', () => {
    expect(excepcionVigente({
      status: 'active', cierreMatricula: '2026-10-06', hoy: '2026-10-06', planCode: 'SCJ',
    })).toBe(true)
  })

  it('usada o revocada no sirve, ni siquiera siendo nivel', () => {
    // La excepción de nivel es de UN SOLO USO: al matricularse queda `used`.
    for (const status of ['used', 'revoked']) {
      expect(excepcionVigente({ ...AYER, status, planCode: 'N1' }), status).toBe(false)
    }
  })

  it('sin bloque no vence nada, como siempre', () => {
    expect(excepcionVigente({
      status: 'active', cierreMatricula: null, hoy: '2026-10-06', planCode: 'SCJ',
    })).toBe(true)
  })

  it('`planCode` es OBLIGATORIO, sin valor por omisión', () => {
    // Un default convertiría de nuevo a los niveles en capacitaciones, que es
    // exactamente el bug. El compilador lo impide; esto lo deja escrito.
    const src = readFileSync('src/lib/studies/exception-scope.ts', 'utf8')
    expect(src).toContain('planCode: string | null | undefined')
    expect(src).not.toMatch(/planCode[^\n]*=\s*(null|''|undefined)/)
  })

  it('reconoce los cuatro niveles y nada más', () => {
    for (const c of ['N1', 'N2', 'N3', 'N4']) expect(esNivel(c), c).toBe(true)
    for (const c of ['N5', 'N0', 'DIS1', 'PREMAT', 'CDEB', null, '', 'n1 ']) {
      expect(esNivel(c), String(c)).toBe(false)
    }
  })
})

describe('EST-27 · el cableado', () => {
  const Q = sinComentarios('src/lib/supabase/queries/study-exceptions.ts')

  it('una excepción de nivel NO se cuelga de un bloque al crearse', () => {
    expect(Q).toContain('const esDeNivel = esNivel(')
    expect(Q).toContain('const { data: bloque } = esDeNivel')
  })

  it('los tres lugares que evalúan la vigencia pasan el código del plan', () => {
    // Si uno se olvida, la excepción vive en una pantalla y muere en otra.
    const llamadas = Q.match(/excepcionVigente\(/g) ?? []
    const conCodigo = Q.match(/planCode:/g) ?? []
    expect(llamadas.length).toBeGreaterThanOrEqual(3)
    expect(conCodigo.length).toBe(llamadas.length)
  })

  it('la migración limpia SOLO los niveles', () => {
    const m = readFileSync('supabase/migrations/20261006200000_est23_niveles_sin_vencimiento.sql', 'utf8')
    expect(m).toContain("p.code ~ '^N[1-4]$'")
    expect(m).toContain('set bloque_id = null')
    // Y no toca las de capacitaciones.
    expect(m).not.toMatch(/update[\s\S]*set bloque_id = null[\s\S]*;[\s\S]*update/i)
  })

  it('al matricularse queda USADA: un solo uso', () => {
    expect(Q).toContain("update({ status: 'used' })")
    const enroll = sinComentarios('src/lib/supabase/queries/studies.ts')
    expect(enroll).toContain('markExceptionUsed(memberId, plan.id)')
  })
})
