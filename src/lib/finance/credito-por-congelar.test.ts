import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  sirveParaElRubro, montoDelCredito, motivoQueImpideCongelar, vencimientoDelCredito,
  SALIDAS_DEL_CREDITO, puedeDevolverse, motivoQueImpideDevolver, cuerpoDelCredito,
  MESES_SIN_BLOQUE, puedeCongelar, ROLES_QUE_CONGELAN,
} from './credito-por-congelar'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('FIN-9 · el crédito vale lo PAGADO, no lo cobrado', () => {
  it('suma solo los pagos en estado paid', () => {
    /**
     * Es la fuente de error obvia: un cobro de ₡10.000 del que la persona
     * pagó ₡5.000 genera un crédito de ₡5.000. Congelar lo cobrado sería
     * regalarle ₡5.000 que nunca entraron.
     */
    expect(montoDelCredito([
      { amount: 5000, status: 'paid' },
      { amount: 5000, status: 'pending' },
    ])).toBe(5000)
  })

  it('varios tractos pagados se suman', () => {
    expect(montoDelCredito([
      { amount: 2500, status: 'paid' },
      { amount: 2500, status: 'paid' },
      { amount: 5000, status: 'cancelado' },
    ])).toBe(5000)
  })

  it('sin nada pagado no hay nada que congelar', () => {
    const m = motivoQueImpideCongelar({ estadoDeLaMatricula: 'enrolled', montoPagado: 0 })
    expect(m).toMatch(/no ha pagado nada/i)
    expect(m).toMatch(/retirarla/i)   // dice qué hacer en su lugar
  })

  it('una matrícula terminada o ya dada de baja, tampoco', () => {
    expect(motivoQueImpideCongelar({ estadoDeLaMatricula: 'completed', montoPagado: 5000 }))
      .toMatch(/ya aprobó/i)
    for (const e of ['dropped', 'cancelada']) {
      expect(motivoQueImpideCongelar({ estadoDeLaMatricula: e, montoPagado: 5000 }), e)
        .toMatch(/ya está dada de baja/i)
    }
  })

  it('con plata pagada y matrícula viva, se puede', () => {
    expect(motivoQueImpideCongelar({ estadoDeLaMatricula: 'enrolled', montoPagado: 5000 })).toBeNull()
    expect(motivoQueImpideCongelar({ estadoDeLaMatricula: 'pendiente_de_pago', montoPagado: 2500 })).toBeNull()
  })
})

describe('FIN-9 · dónde vale y hasta cuándo', () => {
  it('estudios y actividades, NO cualquier rubro', () => {
    // Un crédito que sirva para todo se vuelve plata suelta y la
    // contabilidad deja de poder seguirle el rastro (Meli).
    expect(sirveParaElRubro('study_plan')).toBe(true)
    expect(sirveParaElRubro('event')).toBe(true)
    for (const r of ['donacion', 'folletos', 'prematrimonial', null, undefined, '']) {
      expect(sirveParaElRubro(r), String(r)).toBe(false)
    }
  })

  it('vence al cerrar la matrícula del bloque SIGUIENTE', () => {
    // El plazo es un BLOQUE y no un número de días: de nada sirve un crédito
    // de 90 días si el estudio abre en 120.
    expect(vencimientoDelCredito({
      fechaDeCierreDelBloqueSiguiente: '2027-01-22', hoy: '2026-10-05',
    })).toBe('2027-01-22')
  })

  it('sin bloque siguiente se cae a un año, no a cero', () => {
    // Preferible que venza tarde a que venza sin que nadie lo sepa.
    expect(vencimientoDelCredito({ fechaDeCierreDelBloqueSiguiente: null, hoy: '2026-10-05' }))
      .toBe('2027-10-05')
    expect(MESES_SIN_BLOQUE).toBe(12)
  })

  it('un bloque que ya pasó no sirve de vencimiento', () => {
    // Si el cierre quedó atrás, el crédito nacería vencido.
    expect(vencimientoDelCredito({
      fechaDeCierreDelBloqueSiguiente: '2026-01-22', hoy: '2026-10-05',
    })).toBe('2027-10-05')
  })
})

describe('FIN-9 · la escalera', () => {
  it('son cuatro y EN ESE ORDEN', () => {
    /**
     * El orden no es decorativo: va de la opción que más mantiene a la
     * persona adentro a la que la deja afuera. Poner «devolución» primero
     * convierte la conversación en un trámite de reembolso, que es justo lo
     * que esto viene a evitar.
     */
    expect(SALIDAS_DEL_CREDITO.map(s => s.clave))
      .toEqual(['siguiente_bloque', 'donar_beca', 'otra_actividad', 'devolucion'])
  })

  it('cada una explica qué pasa, no solo cómo se llama', () => {
    for (const s of SALIDAS_DEL_CREDITO) {
      expect(s.que.length, s.clave).toBeGreaterThan(30)
    }
  })

  it('la devolución SOLO si Theos cerró el grupo', () => {
    // «Las deserciones no generan devolución» fue textual en la reunión.
    expect(puedeDevolverse({ theosCerroElGrupo: true })).toBe(true)
    expect(puedeDevolverse({ theosCerroElGrupo: false })).toBe(false)
    expect(motivoQueImpideDevolver({ theosCerroElGrupo: false })).toMatch(/Theos cerró el grupo/)
    expect(motivoQueImpideDevolver({ theosCerroElGrupo: true })).toBeNull()
  })
})

describe('FIN-9 · lo que lee la persona', () => {
  it('dice el monto, hasta cuándo, y que no tiene que hacer nada', () => {
    const c = cuerpoDelCredito({ monto: '₡5 000', estudio: 'Nivel 3', vence: '2027-01-22' })
    expect(c).toContain('₡5 000')
    expect(c).toContain('Nivel 3')
    expect(c).toContain('2027-01-22')
    expect(c).toMatch(/no tenés que hacer nada/i)
  })

  it('sin estudio sale igual, sin un «de» colgando', () => {
    const c = cuerpoDelCredito({ monto: '₡5 000', estudio: null, vence: '2027-01-22' })
    expect(c).not.toMatch(/\s{2,}/)
    expect(c).not.toMatch(/\bde\s+y\b/)
  })
})

describe('FIN-9 · el cableado', () => {
  it('el crédito NO es un cupón genérico: tiene dueño y pago de origen', () => {
    /**
     * Los cupones de hoy son `kind='generica'`: sin dueño y con código,
     * atados a un plan concreto. El crédito es al revés en las tres cosas,
     * y por eso hizo falta relajar los CHECK en vez de reusarlos.
     */
    const m = readFileSync('supabase/migrations/20261006180000_fin9_credito_por_congelar.sql', 'utf8')
    expect(m).toContain("kind in ('asignada', 'generica', 'credito')")
    expect(m).toContain("kind = 'credito'  and member_id is not null and code is null")
    expect(m).toContain('origin_payment_id is not null')
    expect(m).toContain("kind = 'credito' and entity_type is null")
  })

  it('se consume como una beca asignada, no como un cupón reutilizable', () => {
    // Con `kind === 'asignada'` el crédito habría caído en el INSERT de
    // redenciones y habría quedado usable más de una vez.
    const q = sinComentarios('src/lib/supabase/queries/scholarships.ts')
    expect(q).toContain("if (scholarship.kind !== 'generica') {")
  })

  it('la beca del destino manda; el crédito es el respaldo', () => {
    // Gastar el crédito teniendo beca sería quemarle plata suya pudiendo
    // usar el descuento.
    const q = sinComentarios('src/lib/supabase/queries/scholarships.ts')
    expect(q).toMatch(/findApplicableScholarship\([^)]*\)\s*\n?\s*\?\? await findCreditoVivo/)
  })

  it('congelar emite el crédito ANTES de dar de baja', () => {
    /**
     * Si se cae en el medio, el peor caso es alguien con crédito que sigue
     * en el grupo (visible, un clic) en vez de alguien dado de baja y sin su
     * plata (invisible hasta que reclame).
     */
    const q = sinComentarios('src/lib/supabase/queries/creditos.ts')
    const iCredito = q.indexOf("kind: 'credito'")
    const iBaja = q.indexOf('withdrawMember(')
    expect(iCredito).toBeGreaterThan(-1)
    expect(iBaja).toBeGreaterThan(iCredito)
  })

  it('solo los roles autorizados lo emiten, y el motivo es obligatorio', () => {
    // Muy manual a propósito: si «congelar» se vuelve un clic para
    // cualquiera, deja de ser la excepción que es.
    const r = sinComentarios('src/app/api/finance/creditos/route.ts')
    expect(r).toContain('const ROLES = ROLES_QUE_CONGELAN')
    expect(r).toContain('motivo: z.string().trim().min(10')
  })
})

describe('FIN-9 · quién puede congelar', () => {
  it('finanzas y quien lleva los estudios', () => {
    // Pedido explícito de Floriana el 2026-10-06.
    expect(puedeCongelar(['finanzas'])).toBe(true)
    expect(puedeCongelar(['coordinador_estudios'])).toBe(true)
    expect(puedeCongelar(['admin'])).toBe(true)
  })

  it('DIRECCIÓN no: la primera versión la incluía y se sacó a propósito', () => {
    expect(ROLES_QUE_CONGELAN).not.toContain('direccion')
    expect(puedeCongelar(['direccion'])).toBe(false)
  })

  it('nadie más, y menos la propia persona', () => {
    // No hay autoservicio: si «congelar» se vuelve un clic para cualquiera,
    // deja de ser la excepción que es y se come la matrícula normal.
    for (const r of ['miembro', 'dirigente', 'comunicaciones', 'encargado_eventos']) {
      expect(puedeCongelar([r]), r).toBe(false)
    }
    expect(puedeCongelar([])).toBe(false)
  })

  it('la pantalla y el endpoint preguntan por la MISMA lista', () => {
    /**
     * Escrita en los dos lados se separa, y entonces aparece un botón que al
     * tocarlo da 403 — que es exactamente el bug de UX-7.
     */
    const ep = sinComentarios('src/app/api/finance/creditos/route.ts')
    const ui = sinComentarios('src/app/(admin)/miembros/[id]/_components/MemberParticipationTab.tsx')
    expect(ep).toContain('const ROLES = ROLES_QUE_CONGELAN')
    expect(ui).toContain('puedeCongelar(roles ?? [])')
    // Y nadie se quedó con la lista vieja escrita a mano.
    expect(ep).not.toContain("['finanzas', 'direccion']")
  })

  it('el botón vive en la FILA del estudio, no en la persona', () => {
    // Congelar es por MATRÍCULA: alguien con dos estudios puede congelar uno
    // y seguir en el otro.
    const ui = sinComentarios('src/app/(admin)/miembros/[id]/_components/MemberParticipationTab.tsx')
    expect(ui).toContain('enrollmentId={row.enrollmentId}')
    expect(ui).toContain('<CongelarMatriculaButton')
  })

  it('no se ofrece sobre una matrícula terminada o dada de baja', () => {
    // El endpoint también lo frena, pero un botón que siempre falla no
    // debería estar.
    const ui = sinComentarios('src/app/(admin)/miembros/[id]/_components/MemberParticipationTab.tsx')
    expect(ui).toContain("!['completed', 'dropped', 'cancelada'].includes(row.rawStatus)")
  })

  it('el monto se MUESTRA antes de confirmar', () => {
    // Es por lo PAGADO y casi nunca coincide con lo cobrado: un botón que
    // congela a ciegas sería adivinar con la plata de otro.
    const b = sinComentarios('src/components/finance/CongelarMatriculaButton.tsx')
    expect(b).toContain('/api/finance/creditos?enrollment_id=')
    expect(b).toContain('formatMoney(ctx.montoPagado, ctx.currency)')
  })
})
