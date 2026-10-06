/**
 * FIN-9 · «Congelar matrícula»: quitar la matrícula y dejarle el dinero
 * guardado a la persona como CRÉDITO.
 *
 * Decidido con Meli el 2026-09-29. Reemplaza el diseño de «saldos a favor»,
 * que quedó descartado.
 *
 * QUÉ PROBLEMA RESUELVE. Alguien paga un estudio y a mitad de camino no
 * puede seguir —trabajo, salud, un viaje—. Hoy eso termina en una de dos:
 * se le devuelve la plata (y Theos pierde a la persona) o se le dice que la
 * perdió (y Theos pierde a la persona igual). El crédito es la tercera:
 * la plata se queda, esperándola para el bloque siguiente.
 *
 * POR QUÉ NO ES UN CUPÓN GENÉRICO, que es lo que había. Los cupones de hoy
 * son `kind='generica'`: SIN dueño y CON código, atados a un plan o un
 * evento concreto. Este es al revés en las tres cosas —tiene dueño, no tiene
 * código y no está atado a un destino— porque no es una promoción: es plata
 * que esa persona ya pagó.
 *
 * MUY MANUAL, Y A PROPÓSITO. Solo finanzas lo emite, caso por caso y después
 * de hablar con la persona. No hay botón de autoservicio ni se promociona:
 * si «congelar» se vuelve un clic, deja de ser la excepción que es.
 *
 * CONTABLEMENTE ES UNA RECLASIFICACIÓN, no un ingreso nuevo: la plata ya
 * entró en un rubro y va a salir en otro. Por eso cada crédito guarda de
 * qué pago nació, y por eso existe el reporte de reclasificaciones.
 *
 * Módulo PURO.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 1 · DÓNDE SE PUEDE USAR
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Los rubros donde el crédito vale: estudios y actividades grandes.
 *
 * NO es «cualquier cosa», y la restricción es de Meli: un crédito que sirva
 * para todo se vuelve plata suelta en el sistema y la contabilidad deja de
 * poder seguirle el rastro. Estudios y campamentos son donde de verdad pasa
 * el caso de «pagué y no pude ir».
 */
export const RUBROS_DEL_CREDITO = ['study_plan', 'event'] as const
export type RubroDelCredito = (typeof RUBROS_DEL_CREDITO)[number]

export function sirveParaElRubro(entityType: string | null | undefined): boolean {
  return !!entityType && (RUBROS_DEL_CREDITO as readonly string[]).includes(entityType)
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2 · CUÁNTO SE CONGELA
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * El crédito vale lo PAGADO, no lo cobrado.
 *
 * La diferencia importa y es la fuente de error obvia: un cobro de ₡10.000
 * del que la persona pagó ₡5.000 genera un crédito de ₡5.000. Congelar lo
 * cobrado sería regalarle ₡5.000 que nunca entraron.
 */
export function montoDelCredito(pagos: ReadonlyArray<{ amount: number; status: string }>): number {
  return pagos
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + (Number(p.amount) || 0), 0)
}

/** Sin plata pagada no hay nada que congelar. */
export function motivoQueImpideCongelar(input: {
  estadoDeLaMatricula: string
  montoPagado: number
}): string | null {
  if (input.montoPagado <= 0) {
    return 'Esta persona no ha pagado nada: no hay monto que congelar. '
      + 'Si se va, lo que corresponde es retirarla y anular el cobro.'
  }
  if (input.estadoDeLaMatricula === 'completed') {
    return 'Ya aprobó el estudio: no se puede congelar una matrícula terminada.'
  }
  if (['dropped', 'cancelada'].includes(input.estadoDeLaMatricula)) {
    return 'Esta matrícula ya está dada de baja.'
  }
  return null
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · HASTA CUÁNDO VALE
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * UN BLOQUE para volver a matricularse (Meli, 2026-09-29).
 *
 * El plazo no es un número de días sino un BLOQUE, porque es la unidad en la
 * que la persona puede volver: de nada sirve un crédito de 90 días si el
 * estudio abre en 120. Se vence al cerrar la matrícula del bloque siguiente,
 * que es el último momento en que todavía podía usarlo.
 *
 * `fechaDeCierreDelBloque` la trae el llamador leyendo `capacitacion_bloques`.
 * Sin bloque siguiente definido se cae a un año, que es el plazo más largo
 * razonable: preferible que venza tarde a que venza sin que nadie lo sepa.
 */
export const MESES_SIN_BLOQUE = 12

export function vencimientoDelCredito(input: {
  fechaDeCierreDelBloqueSiguiente?: string | null
  hoy: string
}): string {
  const cierre = (input.fechaDeCierreDelBloqueSiguiente ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cierre) && cierre > input.hoy.slice(0, 10)) return cierre
  const d = new Date(`${input.hoy.slice(0, 10)}T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + MESES_SIN_BLOQUE)
  return d.toISOString().slice(0, 10)
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · LA ESCALERA
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Las cuatro salidas, EN ORDEN (Meli, 2026-09-29).
 *
 * El orden no es decorativo: es lo que finanzas le ofrece a la persona, de
 * la opción que más la mantiene adentro a la que la deja afuera. Ponerlas
 * sin orden —o poner «devolución» primero— convierte la conversación en un
 * trámite de reembolso, que es justo lo que esto viene a evitar.
 */
export const SALIDAS_DEL_CREDITO = [
  {
    clave: 'siguiente_bloque',
    titulo: 'Guardarlo para el siguiente bloque',
    que: 'Se queda a su nombre y lo usa cuando vuelva a matricularse. Es el default.',
  },
  {
    clave: 'donar_beca',
    titulo: 'Donarlo como beca para otra persona',
    que: 'La persona regala su crédito y finanzas lo convierte en una beca.',
  },
  {
    clave: 'otra_actividad',
    titulo: 'Usarlo en otra actividad',
    que: 'Vale para un campamento o una actividad grande, no para cualquier rubro.',
  },
  {
    clave: 'devolucion',
    titulo: 'Devolverle la plata',
    que: 'SOLO cuando Theos cerró el grupo. Si la persona desertó, no hay devolución.',
  },
] as const

export type SalidaDelCredito = (typeof SALIDAS_DEL_CREDITO)[number]['clave']

/**
 * La devolución NO es una opción libre: es la última y tiene condición.
 *
 * «Las deserciones no generan devolución» fue textual en la reunión. Si
 * cualquiera pudiera pedir la plata de vuelta, el crédito sería un reembolso
 * con pasos extra y nadie elegiría las otras tres.
 */
export function puedeDevolverse(input: { theosCerroElGrupo: boolean }): boolean {
  return input.theosCerroElGrupo
}

export function motivoQueImpideDevolver(input: { theosCerroElGrupo: boolean }): string | null {
  return puedeDevolverse(input)
    ? null
    : 'La devolución es solo cuando Theos cerró el grupo. Si la persona no pudo '
      + 'seguir, el crédito se le guarda para el bloque siguiente.'
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · EL TEXTO QUE VE LA PERSONA
 * ──────────────────────────────────────────────────────────────────────────── */

export const TIPO_CREDITO_EMITIDO = 'credito_emitido'
export const TITULO_CREDITO_EMITIDO = 'Te guardamos lo que pagaste'

export function cuerpoDelCredito(input: {
  monto: string
  estudio: string | null
  vence: string
}): string {
  const de = input.estudio ? ` de ${input.estudio}` : ''
  return `Quitamos tu matrícula${de} y te guardamos los ${input.monto} que ya pagaste. `
    + `Los podés usar cuando te vuelvas a matricular, hasta el ${input.vence}. `
    + 'No tenés que hacer nada ahora.'
}
