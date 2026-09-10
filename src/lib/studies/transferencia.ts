/**
 * Mover a una persona de un grupo a otro, con su pago.
 *
 * POR QUÉ EXISTE. Hoy el coordinador lo hace a mano: saca a la persona de un
 * grupo y la matricula en otro. El sistema no sabe que es un cambio de grupo,
 * así que le genera un COBRO NUEVO y le pide otro comprobante — cuando ya
 * pagó. Cambiar de grupo no es matricularse de nuevo.
 *
 * La mecánica de transferir ya existía dentro de resolveStudyRequest para las
 * reubicaciones. Acá viven las REGLAS, sin base de datos, para que el camino
 * de la solicitud y el de la acción directa no se separen con el tiempo.
 */

/**
 * A qué familia de estudios pertenece un grupo.
 *
 * Mover a alguien de un Nivel 3 a Hebreos no es cambiar de grupo: es cambiar
 * de camino. Ofrecerlo en la misma lista invita al error (decisión del
 * usuario, 2026-09-10). Así que los niveles solo se cruzan con niveles, y las
 * capacitaciones con capacitaciones.
 *
 * 'excluido' es Prematrimonial: tiene su propio flujo, con pareja y
 * requisitos, y nada de eso sobrevive a un traslado suelto.
 */
export type FamiliaDeEstudio = 'niveles' | 'capacitaciones' | 'excluido'

const PLANES_EXCLUIDOS = new Set(['PREMAT'])

export function familiaDelPlan(level: string | null, code: string | null): FamiliaDeEstudio {
  if (code && PLANES_EXCLUIDOS.has(code.toUpperCase())) return 'excluido'
  return level === 'niveles' ? 'niveles' : 'capacitaciones'
}

export type GrupoParaTransferir = {
  id: string
  name: string
  plan_id: string | null
  /** study_plans.level — 'niveles', 'etapa_inicial', 'campanas'… */
  plan_level?: string | null
  /** study_plans.code — para excluir Prematrimonial. */
  plan_code?: string | null
  /** Costo del plan, en su moneda. */
  costo: number
  currency: string | null
  status: string
  max_students: number | null
  /** Cuántos estudiantes activos tiene hoy. */
  inscritos: number
}

export type ImpedimentoTransferencia =
  | { code: 'mismo_grupo'; mensaje: string }
  | { code: 'plan_distinto'; mensaje: string }
  | { code: 'costo_distinto'; mensaje: string }
  | { code: 'grupo_cerrado'; mensaje: string }
  | { code: 'sin_cupo'; mensaje: string }
  | { code: 'ya_matriculado'; mensaje: string }
  | { code: 'ya_completado'; mensaje: string }
  | { code: 'otra_familia'; mensaje: string }
  | { code: 'plan_excluido'; mensaje: string }

/** Estados de grupo a los que se puede mover a alguien. */
const DESTINOS_VALIDOS = new Set(['en_matricula', 'en_curso'])

/**
 * `null` = se puede mover. Si no, el impedimento con el texto que ve la persona.
 *
 * @param estadoEnDestino  estado que la persona YA tiene en el grupo destino, si tiene.
 */
export function motivoQueImpideTransferir(input: {
  origen: GrupoParaTransferir
  destino: GrupoParaTransferir
  estadoEnDestino?: string | null
}): ImpedimentoTransferencia | null {
  const { origen, destino, estadoEnDestino } = input

  if (origen.id === destino.id) {
    return { code: 'mismo_grupo', mensaje: 'La persona ya está en ese grupo.' }
  }
  if (estadoEnDestino === 'completed') {
    return { code: 'ya_completado', mensaje: `Ya completó ${destino.name}. Moverla ahí borraría ese registro académico.` }
  }
  if (estadoEnDestino === 'enrolled' || estadoEnDestino === 'pendiente_de_pago') {
    return { code: 'ya_matriculado', mensaje: `Ya está matriculada en ${destino.name}.` }
  }
  const familiaOrigen = familiaDelPlan(origen.plan_level ?? null, origen.plan_code ?? null)
  const familiaDestino = familiaDelPlan(destino.plan_level ?? null, destino.plan_code ?? null)
  if (familiaDestino === 'excluido' || familiaOrigen === 'excluido') {
    return {
      code: 'plan_excluido',
      mensaje: 'El Prematrimonial no se mueve por acá: tiene su propio flujo, con pareja y requisitos.',
    }
  }
  if (familiaOrigen !== familiaDestino) {
    return {
      code: 'otra_familia',
      mensaje: familiaOrigen === 'niveles'
        ? 'Está en un Nivel: solo se puede mover a otro Nivel. Pasar a una capacitación es otro camino, no un cambio de grupo.'
        : 'Está en una capacitación: solo se puede mover a otra capacitación, no a los Niveles.',
    }
  }
  if (!DESTINOS_VALIDOS.has(destino.status)) {
    return { code: 'grupo_cerrado', mensaje: `${destino.name} no está recibiendo gente (está ${destino.status}).` }
  }
  // Cambiar de ESTUDIO sí se permite (decisión del usuario, 2026-09-10): pasa
  // que alguien se matricula en el estudio equivocado —Religiones del Mundo en
  // vez de SCJ, por ejemplo— y hay que pasarlo. Lo que no se hace en silencio
  // es la plata: la diferencia se cobra o queda a favor. Ver planDeDinero.
  //
  // Lo único que sigue bloqueado es la MONEDA distinta: restar colones de
  // dólares no da un número que signifique algo.
  if (origen.currency !== destino.currency) {
    return {
      code: 'costo_distinto',
      mensaje: `Los grupos cobran en monedas distintas (${origen.currency ?? 'CRC'} y ${destino.currency ?? 'CRC'}). `
        + 'Esto lo tiene que ajustar finanzas.',
    }
  }
  if (destino.max_students !== null && destino.inscritos >= destino.max_students) {
    return { code: 'sin_cupo', mensaje: `${destino.name} está lleno (${destino.inscritos} de ${destino.max_students}).` }
  }
  return null
}

/** Los grupos a los que se puede ofrecer mover, ya filtrados y ordenados. */
export function destinosPosibles(
  origen: GrupoParaTransferir,
  candidatos: readonly GrupoParaTransferir[],
  estadoPorGrupo: Readonly<Record<string, string>> = {},
): GrupoParaTransferir[] {
  return candidatos
    .filter(d => motivoQueImpideTransferir({ origen, destino: d, estadoEnDestino: estadoPorGrupo[d.id] }) === null)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export type PagoParaTransferir = {
  id: string
  status: string
  /** 'en_revision' | 'aprobado' | 'rechazado' | null */
  review_status: string | null
  concept: string | null
}

/**
 * Qué pagos se llevan a la matrícula nueva.
 *
 * Viajan los de MATRÍCULA que siguen vivos: aprobados, en revisión y
 * pendientes. No viajan los rechazados ni los cancelados —esos ya no
 * representan plata— ni los de folletos, que son del folleto que la persona ya
 * tiene en la mano y se quedan donde están.
 */
export function pagosQueViajan<T extends PagoParaTransferir>(pagos: readonly T[]): T[] {
  return pagos.filter(p =>
    (p.concept ?? 'matricula') === 'matricula'
    && (p.status === 'paid' || p.status === 'pending')
    && p.review_status !== 'rechazado',
  )
}

/** La traza que se le deja al pago, para que finanzas entienda el movimiento.
 *
 *  Dos textos, porque son dos cosas distintas: el pago que VIAJA y el cobro
 *  NUEVO por la diferencia. Ponerle a los dos "no se cobró de nuevo" —como
 *  pasaba— hace que la fila del cobro se desmienta a sí misma. */
export function notaDeTransferencia(input: {
  desde: string
  hacia: string
  quien: string
  cuando: Date
  /** true = esta nota va en el cobro de la diferencia, no en el pago que viaja. */
  esDiferencia?: boolean
}): string {
  const fecha = input.cuando.toLocaleDateString('es-CR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Costa_Rica',
  })
  const cabeza = `Movida de grupo el ${fecha}: «${input.desde}» → «${input.hacia}» (por ${input.quien}).`
  return input.esDiferencia
    ? `${cabeza} Este cobro es la DIFERENCIA de precio entre los dos grupos; lo que ya había pagado se trasladó a la matrícula nueva.`
    : `${cabeza} Este pago viajó con la matrícula, no se cobró de nuevo.`
}

/**
 * Lo que se le dice al coordinador ANTES de confirmar. Sin sorpresas.
 *
 * `mensajeDelDinero` viene de planDeDinero y es la ÚNICA fuente sobre la
 * plata: antes esta función armaba su propia frase y decía "no se le cobra de
 * nuevo" en un movimiento que sí generaba un cobro de ₡15.000.
 */
export function resumenDeLaAccion(input: {
  persona: string
  desde: string
  hacia: string
  mensajeDelDinero: string
}): string {
  return `Se cierra la matrícula de ${input.persona} en «${input.desde}» como transferida y queda matriculada en «${input.hacia}». ${input.mensajeDelDinero}`
}

// ─── La plata al cambiar de estudio ─────────────────────────────────────────
//
// Decisión del usuario (2026-09-10): mover a la persona SIEMPRE se puede, y la
// diferencia de precio se resuelve, no se esconde.
//
//  · Destino más caro  → se le cobra la diferencia (un pendiente nuevo).
//  · Destino más barato o gratis → el pago viaja igual y lo que sobra queda
//    como SALDO A FAVOR de la persona.
//
// El saldo a favor NO es una fila nueva en la base: es la resta entre lo que
// pagó y lo que cuesta su matrícula. Guardarlo aparte sería un segundo número
// que puede quedar desalineado con el primero.

export type PagoConMonto = PagoParaTransferir & { amount: number }

export type PlanDeDinero = {
  /** Pagos que se re-enlazan a la matrícula nueva. */
  mover: string[]
  /** Un pendiente SIN pagar al que se le corrige el monto (en vez de crear otro). */
  ajustar: { id: string; monto: number } | null
  /** Cobro nuevo a crear, si ya había pagado y falta plata. 0 = ninguno. */
  cobrar: number
  /** Lo que le sobra a la persona después de cubrir el destino. 0 = nada. */
  saldoAFavor: number
  /** Lo que se le dice al coordinador antes de confirmar. */
  mensaje: string
}

// A mano y no con toLocaleString('es-CR'): el ICU de Node separa los miles con
// un espacio fino ("₡5 000") y en Costa Rica se escribe con punto ("₡5.000").
const plata = (n: number, moneda: string | null) => {
  const entero = Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${moneda === 'USD' ? '$' : '₡'}${entero}`
}

/**
 * @param pagos  los que viajan (ya filtrados con pagosQueViajan).
 * @param costoDestino  lo que cuesta el plan del grupo destino.
 */
export function planDeDinero(input: {
  pagos: readonly PagoConMonto[]
  costoDestino: number
  moneda: string | null
}): PlanDeDinero {
  const { pagos, costoDestino, moneda } = input

  // Sin ningún pago detrás (venía de un grupo gratis, por ejemplo). Si el
  // destino cuesta, se le cobra: es plata que de verdad debe. Va aparte para
  // no decirle "ya pagó ₡0", que no significa nada.
  if (pagos.length === 0) {
    return costoDestino > 0
      ? {
          mover: [], ajustar: null, cobrar: costoDestino, saldoAFavor: 0,
          mensaje: `No tenía ningún pago y el grupo nuevo vale ${plata(costoDestino, moneda)}: le queda ese cobro pendiente.`,
        }
      : { mover: [], ajustar: null, cobrar: 0, saldoAFavor: 0, mensaje: 'No hay ningún pago que mover.' }
  }

  const pagado = pagos.filter(p => p.status === 'paid').reduce((n, p) => n + Number(p.amount), 0)
  const pendientes = pagos.filter(p => p.status === 'pending')
  const mover = pagos.map(p => p.id)

  // Todavía no ha pagado: no hay nada que cobrar de más ni que devolver, solo
  // que el cobro pendiente diga el precio correcto.
  if (pagado === 0 && pendientes.length > 0) {
    const primero = pendientes[0]
    const ajustar = Number(primero.amount) === costoDestino ? null : { id: primero.id, monto: costoDestino }
    return {
      mover,
      ajustar,
      cobrar: 0,
      saldoAFavor: 0,
      mensaje: ajustar
        ? `Su cobro pendiente pasa de ${plata(primero.amount, moneda)} a ${plata(costoDestino, moneda)}, que es lo que vale el grupo nuevo. Sigue siendo un solo cobro.`
        : 'Su cobro pendiente se traslada tal cual; no se le cobra de nuevo.',
    }
  }

  const falta = costoDestino - pagado
  if (falta > 0) {
    return {
      mover, ajustar: null, cobrar: falta, saldoAFavor: 0,
      mensaje: `Ya pagó ${plata(pagado, moneda)} y el grupo nuevo vale ${plata(costoDestino, moneda)}: su pago se traslada como abono y le queda un cobro pendiente de ${plata(falta, moneda)}.`,
    }
  }
  if (falta < 0) {
    return {
      mover, ajustar: null, cobrar: 0, saldoAFavor: -falta,
      mensaje: costoDestino === 0
        ? `El grupo nuevo es gratis y ella ya pagó ${plata(pagado, moneda)}: ese pago la sigue acompañando y le queda ${plata(-falta, moneda)} a favor.`
        : `Ya pagó ${plata(pagado, moneda)} y el grupo nuevo vale ${plata(costoDestino, moneda)}: le quedan ${plata(-falta, moneda)} a favor.`,
    }
  }
  return {
    mover, ajustar: null, cobrar: 0, saldoAFavor: 0,
    mensaje: 'Su pago se traslada a la matrícula nueva; no se le cobra de nuevo.',
  }
}
