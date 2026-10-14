/**
 * PAG-5 · Un solo comprobante para varios cobros pendientes.
 *
 * El pedido original decía «se implementa JUNTO con FIN-5 (Tilopay), no
 * antes». Floriana lo desatoró el 2026-10-13: no hace falta la pasarela para
 * resolver el problema real, que es que alguien con tres cobros pendientes
 * hace UNA transferencia y hoy tiene que subir el mismo comprobante tres
 * veces — y a la tercera, FIN-6 se lo bloquea, con razón.
 *
 * Acá vive lo que decide qué selección es válida y cuánto suma. La pantalla no
 * repite ninguna de estas reglas: si las repitiera, en un mes dirían cosas
 * distintas (es el error que se repitió todo el día 2026-10-12 con los
 * permisos de eventos y con el adaptador de dirigentes).
 *
 * Módulo PURO.
 */

/** Lo mínimo que hay que saber de un cobro para decidir si entra. */
export type CobroSeleccionable = {
  id: string
  amount: number
  currency: string
  /** El mismo `queue_status` que ya calcula `computeQueueStatus`. */
  queue_status: string
  member_id?: string | null
}

/**
 * Cuántos cobros se pueden juntar en un comprobante.
 *
 * No es una regla de negocio sino un tope: cada cobro del grupo dispara un
 * `approve_payment`, y una selección sin techo es una forma barata de poner
 * la base a trabajar desde un botón público. Nadie tiene 25 cobros abiertos;
 * si alguna vez pasa, el mensaje lo dice en vez de fallar raro.
 */
export const MAXIMO_POR_COMPROBANTE = 25

/**
 * SOLO los cobros pendientes.
 *
 * `en_revision` queda afuera a propósito: ya tiene un comprobante encima y
 * meterlo en otro es la forma de que el mismo dinero quede contado dos veces
 * —el bug de FIN-6 entrando por la puerta nueva—. Los cerrados tampoco, por
 * razones obvias.
 */
export const sePuedeIncluir = (c: CobroSeleccionable): boolean =>
  c.queue_status === 'pendiente'

export type Rechazo =
  | { code: 'ninguno'; mensaje: string }
  | { code: 'uno_solo'; mensaje: string }
  | { code: 'demasiados'; mensaje: string }
  | { code: 'no_pendiente'; mensaje: string }
  | { code: 'monedas_mezcladas'; mensaje: string }
  | { code: 'otra_persona'; mensaje: string }

export type Veredicto =
  | { ok: true; total: number; currency: string; ids: string[] }
  | { ok: false; error: Rechazo }

/**
 * ¿Se puede cubrir esta selección con un solo comprobante, y por cuánto?
 *
 * @param cobros   los cobros seleccionados, ya resueltos contra la base.
 * @param duenoId  de quién tienen que ser. Un comprobante es UNA transferencia
 *                 hecha por UNA persona; juntar cobros de dos fichas distintas
 *                 es el caso «familia pagando junta», que hoy se resuelve
 *                 subiendo el comprobante en cada ficha y que FIN-6 permite a
 *                 propósito. Mezclarlo acá volvería ambiguo de quién es el
 *                 dinero.
 */
export function evaluarSeleccion(
  cobros: readonly CobroSeleccionable[],
  duenoId: string,
): Veredicto {
  if (cobros.length === 0) {
    return { ok: false, error: { code: 'ninguno', mensaje: 'Elegí al menos dos cobros.' } }
  }
  if (cobros.length === 1) {
    return {
      ok: false,
      error: {
        code: 'uno_solo',
        mensaje: 'Para un solo cobro usá el botón de pago de ese cobro.',
      },
    }
  }
  if (cobros.length > MAXIMO_POR_COMPROBANTE) {
    return {
      ok: false,
      error: {
        code: 'demasiados',
        mensaje: `No se pueden juntar más de ${MAXIMO_POR_COMPROBANTE} cobros en un comprobante.`,
      },
    }
  }

  const ajeno = cobros.find(c => c.member_id && c.member_id !== duenoId)
  if (ajeno) {
    return {
      ok: false,
      error: {
        code: 'otra_persona',
        mensaje: 'Todos los cobros tienen que ser de la misma persona. '
          + 'Si están pagando juntos, subí el comprobante en cada ficha.',
      },
    }
  }

  const noPendiente = cobros.find(c => !sePuedeIncluir(c))
  if (noPendiente) {
    return {
      ok: false,
      error: {
        code: 'no_pendiente',
        mensaje: 'Uno de los cobros ya no está pendiente: puede que ya se haya pagado '
          + 'o que su comprobante esté en revisión. Recargá la página.',
      },
    }
  }

  // INT-3 · Nunca se suman dos monedas. Un total de «₡30.000 + $20» no existe.
  const monedas = [...new Set(cobros.map(c => c.currency || 'CRC'))]
  if (monedas.length > 1) {
    return {
      ok: false,
      error: {
        code: 'monedas_mezcladas',
        mensaje: `Esos cobros están en monedas distintas (${monedas.join(', ')}). `
          + 'Pagá por separado los de cada moneda.',
      },
    }
  }

  return {
    ok: true,
    // Redondeo al colón: los montos vienen de `numeric` y sumar flotantes
    // deja 29999.999999 en el mensaje que lee la persona.
    total: Math.round(cobros.reduce((a, c) => a + Number(c.amount || 0), 0) * 100) / 100,
    currency: monedas[0],
    ids: cobros.map(c => c.id),
  }
}

/** ¿Vale la pena ofrecer el modo «pagar varios»? Con un solo pendiente, no. */
export const ofrecerPagoJunto = (cobros: readonly CobroSeleccionable[]): boolean =>
  cobros.filter(sePuedeIncluir).length >= 2

/**
 * Qué referencias están de verdad repetidas, ahora que una puede cubrir
 * varios cobros a propósito.
 *
 * La cola de revisión marca con una banderita las referencias que aparecen en
 * más de un pago. Sin esto, un comprobante PAG-5 que cubre tres cobros
 * encendería la banderita en los tres — y una alarma que suena cuando todo
 * está bien es peor que no tenerla: en dos semanas nadie la mira.
 *
 * La regla: los pagos que comparten `comprobante_grupo` cuentan como UNO.
 */
export function referenciasRepetidas(
  filas: ReadonlyArray<{ reference_code: string | null; comprobante_grupo?: string | null }>,
): Set<string> {
  const porRef = new Map<string, Set<string>>()
  filas.forEach((f, i) => {
    const ref = f.reference_code?.trim()
    if (!ref) return
    if (!porRef.has(ref)) porRef.set(ref, new Set())
    // Un pago suelto cuenta por sí mismo —por eso la posición, que es única—;
    // los de un mismo grupo cuentan todos por el grupo.
    porRef.get(ref)!.add(f.comprobante_grupo ?? `suelto:${i}`)
  })
  const repes = new Set<string>()
  for (const [ref, unidades] of porRef) if (unidades.size > 1) repes.add(ref)
  return repes
}
