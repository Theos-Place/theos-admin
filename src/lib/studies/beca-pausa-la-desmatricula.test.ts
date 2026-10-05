import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { reservaExpirada, HORAS_DE_GRACIA } from '@/lib/studies/enrollment-hold'

/** Una reserva que YA pasó la ventana: lo único que la salva es una excepción. */
const vencida = (extra: Record<string, unknown> = {}) => ({
  status: 'pendiente_de_pago',
  reviewStatus: null,
  creadaEn: '2026-10-01T00:00:00.000Z',
  ahora: new Date('2026-10-06T00:00:00.000Z'), // 5 días después
  ...extra,
})

describe('la beca pausa la desmatrícula automática', () => {
  it('sin beca, la reserva vencida se suelta — eso no cambia', () => {
    expect(reservaExpirada(vencida())).toBe(true)
  })

  it('con beca APROBADA no se suelta', () => {
    /**
     * EL CASO (2026-10-06). Lulu Quesada pidió beca para HER, se la
     * aprobaron al 100% y el cron la sacó del grupo DOS VECES diciendo «sin
     * comprobante por más de 72 horas». Con una beca total no hay nada que
     * subir: no abandonó el flujo, el flujo le pidió algo que no existe.
     */
    expect(reservaExpirada(vencida({ conBecaAprobada: true }))).toBe(false)
  })

  it('da igual si la beca es total o parcial, y si ya se aplicó', () => {
    // Las tres becas afectadas en producción tenían `is_used = false`:
    // aplicarla es un paso administrativo y nadie debería perder el cupo
    // porque ese paso esté pendiente. La bandera no distingue, a propósito.
    expect(reservaExpirada(vencida({ conBecaAprobada: true }))).toBe(false)
  })

  it('con la solicitud TODAVÍA en revisión tampoco se suelta', () => {
    // Meli aprueba la última semana de matrícula a propósito (BEC-5). Un
    // barrido de 72 horas desmatricularía a casi todo el que pida beca.
    expect(reservaExpirada(vencida({ conSolicitudDeBecaPendiente: true }))).toBe(false)
  })

  it('resuelta la solicitud y sin beca, el reloj corre de nuevo', () => {
    // Una beca revocada o una solicitud rechazada dejan de poner las
    // banderas, así que la condición se cumple sola.
    expect(reservaExpirada(vencida({
      conBecaAprobada: false, conSolicitudDeBecaPendiente: false,
    }))).toBe(true)
  })

  it('la beca no resucita una reserva que no estaba vencida', () => {
    const fresca = { ...vencida({ conBecaAprobada: true }), ahora: new Date('2026-10-01T01:00:00.000Z') }
    expect(reservaExpirada(fresca)).toBe(false)
  })

  it('y no pisa las salidas que ya existían', () => {
    expect(reservaExpirada(vencida({ reviewStatus: 'en_revision' }))).toBe(false)
    expect(reservaExpirada(vencida({ conPlanDePagos: true }))).toBe(false)
    expect(HORAS_DE_GRACIA).toBe(72)
  })
})

describe('el barrido trae el dato de la beca', () => {
  const sinComentarios = (ruta: string): string =>
    readFileSync(ruta, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
  const QUERY = 'src/lib/supabase/queries/studies.ts'

  it('busca becas y solicitudes, y se las pasa a la regla', () => {
    // Sin esto la bandera nunca se enciende y la regla nueva es decorativa.
    const src = sinComentarios(QUERY)
    expect(src).toMatch(/from\('scholarships'\)[\s\S]{0,120}in\('status', \['active', 'used'\]\)/)
    expect(src).toMatch(/eq\('request_type', 'scholarship'\)[\s\S]{0,120}in\('status', \['open', 'in_review', 'por_modificar'\]\)/)
    expect(src).toContain('conBecaAprobada:')
    expect(src).toContain('conSolicitudDeBecaPendiente:')
  })

  it('una beca REVOCADA no pausa nada', () => {
    // 'revoked' queda fuera del `in`, a propósito: ahí el reloj corre.
    const src = sinComentarios(QUERY)
    expect(src).not.toMatch(/in\('status', \['active', 'used', 'revoked'\]\)/)
  })

  it('las busca en DOS consultas, no una por persona', () => {
    // El barrido corre sobre todas las matrículas pendientes del sistema.
    const src = sinComentarios(QUERY)
    expect(src).toMatch(/await Promise\.all\(\[\s*\n\s*supabase\.from\('scholarships'\)/)
  })
})
