import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  puedeSolicitarDevolucion, PUEDEN_SOLICITAR_DEVOLUCION,
  PAGOS_DEVOLVIBLES, DEVOLUCIONES_VIVAS,
  motivoQueImpideSolicitar, validarJustificacion, razonDeLaSolicitud,
  JUSTIFICACION_MIN, JUSTIFICACION_MAX,
} from './solicitud-de-devolucion'
import { REFUND_FINANCE_ROLES } from '@/lib/auth/refunds-scope'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const RUTA = 'src/app/api/studies/refund-requests/route.ts'
const BOTON = 'src/components/studies/RequestRefundButton.tsx'

const m = (over: Partial<Parameters<typeof motivoQueImpideSolicitar>[0]> = {}) => ({
  enrollment_id: 'e1', pagosDevolvibles: 1, yaTieneDevolucion: false, ...over,
})

describe('DEV-2 · quién puede pedirla', () => {
  it('coordinación de estudios y de dirigentes, y admin', () => {
    for (const r of ['coordinador_estudios', 'coordinador_dirigentes', 'admin']) {
      expect(puedeSolicitarDevolucion([r]), r).toBe(true)
    }
  })

  it('es la MISMA lista que ya ve las devoluciones de estudios', () => {
    // Quien puede pedir tiene que poder seguir lo que pidió. Con una lista
    // aparte, alguien podría crear una solicitud que después no puede mirar.
    expect(PUEDEN_SOLICITAR_DEVOLUCION).toContain('coordinador_estudios')
    expect(PUEDEN_SOLICITAR_DEVOLUCION).toContain('coordinador_dirigentes')
  })

  it('finanzas NO está, y no es olvido', () => {
    // Ellos la crean desde el pago, que es su camino y tiene el monto a la
    // vista. `direccion` tampoco entra por acá.
    for (const r of REFUND_FINANCE_ROLES) {
      if (r === 'admin') continue
      expect(puedeSolicitarDevolucion([r]), r).toBe(false)
    }
  })

  it('nadie más', () => {
    for (const r of ['dirigente', 'miembro', 'reportes', 'solicitudes_estudio', 'forms']) {
      expect(puedeSolicitarDevolucion([r]), r).toBe(false)
    }
    expect(puedeSolicitarDevolucion([])).toBe(false)
    expect(puedeSolicitarDevolucion(null)).toBe(false)
    expect(puedeSolicitarDevolucion(undefined)).toBe(false)
  })
})

describe('DEV-2 · cuándo NO se puede pedir', () => {
  it('con un pago devolvible y sin devolución previa, sí', () => {
    expect(motivoQueImpideSolicitar(m())).toBeNull()
  })

  it('sin pago cobrado, no', () => {
    // Es el caso masivo: 36.843 matrículas en producción no tienen ninguno.
    expect(motivoQueImpideSolicitar(m({ pagosDevolvibles: 0 }))).toContain('no tiene ningún pago cobrado')
  })

  it('con más de un pago, tampoco: elegir cuál es de finanzas', () => {
    // No pasa hoy (medido el 2026-09-30: ninguna matrícula tiene dos), pero
    // si pasara, adivinar sería devolver el pago equivocado.
    expect(motivoQueImpideSolicitar(m({ pagosDevolvibles: 2 }))).toContain('más de un pago')
  })

  it('si ya hay una devolución en curso, tampoco', () => {
    expect(motivoQueImpideSolicitar(m({ yaTieneDevolucion: true }))).toContain('devolución en curso')
  })

  it('NINGÚN motivo menciona montos ni pagos concretos', () => {
    // Quien lee esto no tiene acceso a pagos. «El pago de ₡45.000 ya fue
    // devuelto» sería dárselo por la puerta de atrás.
    const motivos = [
      motivoQueImpideSolicitar(m({ pagosDevolvibles: 0 })),
      motivoQueImpideSolicitar(m({ pagosDevolvibles: 2 })),
      motivoQueImpideSolicitar(m({ yaTieneDevolucion: true })),
    ].join(' ')
    expect(motivos).not.toMatch(/₡|\$|\d{3,}/)
  })
})

describe('DEV-2 · los estados se leen de donde mandan', () => {
  it('los pagos devolvibles son los que acepta el RPC create_refund', () => {
    // Si acá dijera otra cosa, la pantalla ofrecería matrículas que el
    // servidor después rechaza con 409.
    expect([...PAGOS_DEVOLVIBLES].sort()).toEqual(['paid', 'partial_refund'].sort())
  })

  it('«viva» no incluye rechazada ni convertida en donación', () => {
    // Ese dinero ya no está en camino: pedir otra devolución no duplica nada.
    expect(DEVOLUCIONES_VIVAS).not.toContain('rejected')
    expect(DEVOLUCIONES_VIVAS).not.toContain('convertida_donacion')
    expect([...DEVOLUCIONES_VIVAS].sort()).toEqual(['completed', 'pending', 'processing'])
  })
})

describe('DEV-2 · la justificación es obligatoria', () => {
  it('vacía no sirve', () => {
    expect(validarJustificacion('')).toBeTruthy()
    expect(validarJustificacion('   ')).toBeTruthy()
    expect(validarJustificacion(null)).toBeTruthy()
  })

  it('muy corta tampoco', () => {
    expect(validarJustificacion('no vino')).toContain('muy corta')
    expect(validarJustificacion('x'.repeat(JUSTIFICACION_MIN - 1))).toBeTruthy()
  })

  it('justa, sí', () => {
    expect(validarJustificacion('x'.repeat(JUSTIFICACION_MIN))).toBeNull()
    expect(validarJustificacion('El grupo se canceló y no pudo pasarse a otro.')).toBeNull()
  })

  it('pasada de largo, no', () => {
    expect(validarJustificacion('x'.repeat(JUSTIFICACION_MAX + 1))).toBeTruthy()
    expect(validarJustificacion('x'.repeat(JUSTIFICACION_MAX))).toBeNull()
  })
})

describe('DEV-2 · la razón que le llega a finanzas dice quién pidió', () => {
  it('lleva el nombre, el estudio y la justificación', () => {
    const r = razonDeLaSolicitud({
      justificacion: 'El grupo se canceló.', solicitanteNombre: 'Ariana Rojas', estudio: 'Nivel 2',
    })
    expect(r).toContain('Ariana Rojas')
    expect(r).toContain('Nivel 2')
    expect(r).toContain('El grupo se canceló.')
  })

  it('sin estudio, no deja un separador colgando', () => {
    const r = razonDeLaSolicitud({ justificacion: 'Se pasó de bloque.', solicitanteNombre: 'Ari' })
    expect(r).not.toContain('· ·')
    expect(r.endsWith('Se pasó de bloque.')).toBe(true)
  })
})

/**
 * LO QUE MÁS IMPORTA DE DEV-2: quien pide NO VE PAGOS.
 *
 * Es el acuerdo entre Ari y María José, y es fácil de romper sin darse
 * cuenta: basta con devolver el objeto del pago «porque ya lo tenía a mano».
 */
describe('DEV-2 · nada de pagos viaja a quien pide', () => {
  const api = sinComentarios(RUTA)

  it('el endpoint no manda monto, método ni id de pago en la lista', () => {
    // El bloque que arma la respuesta del GET.
    const items = api.slice(api.indexOf('const items = matriculas.map'), api.indexOf('return NextResponse.json({ items })'))
    expect(items).not.toContain('amount')
    expect(items).not.toContain('payment_id')
    expect(items).not.toContain('method')
  })

  it('ni al crear: la respuesta es solo el id de la devolución', () => {
    expect(api).toContain('return NextResponse.json({ id: creada.id }, { status: 201 })')
  })

  it('el mensaje de "ya devuelto" no dice cuánto', () => {
    // `create_refund` devuelve `max` con el monto restante. Pasarlo tal cual
    // sería filtrar el dato por el mensaje de error.
    expect(api).not.toContain('creada.max')
    expect(api).toContain('Ese pago ya fue devuelto')
  })

  it('la pantalla tampoco pinta nada de pagos', () => {
    const b = sinComentarios(BOTON)
    for (const palabra of ['amount', 'monto', 'sinpe', 'formatCRC']) {
      expect(b.toLowerCase(), palabra).not.toContain(palabra.toLowerCase())
    }
  })
})

describe('DEV-2 · escribe por el camino de finanzas, no por uno nuevo', () => {
  const api = sinComentarios(RUTA)

  it('usa createRefund, que es el RPC con lock y tope', () => {
    // Un insert propio en `refunds` habría duplicado el lock del pago, el
    // tope contra lo ya devuelto y el estampado del tipo.
    expect(api).toContain('createRefund({')
    expect(api).not.toContain(".from('refunds').insert")
  })

  it('el gate es el mismo módulo, en el GET y en el POST', () => {
    const veces = api.split('requireRoles(...PUEDEN_SOLICITAR_DEVOLUCION)').length - 1
    expect(veces).toBe(2)
  })

  it('valida el body con zod y responde la convención de la casa', () => {
    expect(api).toContain('z.treeifyError')
    expect(api).toContain("{ error: 'Datos inválidos'")
    expect(api).toContain('{ status: 201 }')
  })

  it('vuelve a comprobar el motivo en el POST, no solo en el GET', () => {
    // La pantalla deshabilita la opción, pero un POST directo la saltaría.
    const post = api.slice(api.indexOf('export async function POST'))
    expect(post).toContain('motivoQueImpideSolicitar({')
    expect(post).toContain('{ status: 409 }')
  })

  it('y deja rastro de quién la pidió', () => {
    expect(api).toContain("op: 'solicitud_devolucion_estudios'")
    expect(api).toContain('solicitante_member_id: auth.ctx.memberId')
  })
})

/**
 * EL «403 A /finanzas/pagos» QUE PIDE EL ÍTEM NO SE PUEDE AFIRMAR, y el motivo
 * vale más que el test: **`coordinador_estudios` ya tiene el permiso
 * `revision_pagos`**, que abre esa pantalla. Verificado en el navegador el
 * 2026-09-30 con la cuenta de estudios de staging: `/finanzas/pagos` responde
 * 200, y no por nada de DEV-2.
 *
 * O sea que la premisa del prompt —«NO se le da acceso a pagos»— describe algo
 * que hoy no es cierto. Quitarle ese permiso es una decisión de permisos
 * aparte, con su propio dry-run (8 personas con `coordinador_estudios`, 7 con
 * `coordinador_dirigentes`, 4 con `folletos`), y quedó anotada como FIN-14.
 *
 * Lo que SÍ se puede afirmar, y es lo que este archivo fija arriba, es que
 * ESTE camino no expone pagos: ni el endpoint ni la pantalla mandan monto,
 * método ni id de pago. Un test que afirmara el 403 estaría rojo desde el
 * primer día por algo que no construimos acá.
 */
describe('DEV-2 · la solicitud no depende de ver pagos', () => {
  it('quien pide elige una MATRÍCULA, no un pago', () => {
    const api = sinComentarios(RUTA)
    // El body de entrada: enrollment_id, nunca payment_id.
    expect(api).toContain('enrollment_id: z.string()')
    const cuerpo = api.slice(api.indexOf('const solicitud = z.object'), api.indexOf('})', api.indexOf('const solicitud = z.object')))
    expect(cuerpo).not.toContain('payment_id')
  })

  it('el pago lo resuelve el SERVIDOR a partir de la matrícula', () => {
    const api = sinComentarios(RUTA)
    expect(api).toContain('const paymentId = pagos[0]')
  })
})
