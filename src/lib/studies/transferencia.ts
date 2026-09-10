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

export type GrupoParaTransferir = {
  id: string
  name: string
  plan_id: string | null
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
  if (!DESTINOS_VALIDOS.has(destino.status)) {
    return { code: 'grupo_cerrado', mensaje: `${destino.name} no está recibiendo gente (está ${destino.status}).` }
  }
  // El plan tiene que ser el mismo: esta acción es para cambiar de HORARIO o
  // de dirigente, no para cambiar de estudio. Cambiar de estudio es otra
  // matrícula, con su propio cobro.
  if (origen.plan_id !== destino.plan_id) {
    return {
      code: 'plan_distinto',
      mensaje: 'Los dos grupos son de estudios distintos. Mover el pago sin más sería cobrar una cosa por otra: '
        + 'esto lo tiene que ajustar finanzas.',
    }
  }
  // Mismo plan pero distinto costo (pasa: un plan cambió de precio entre
  // cohortes). Tampoco se mueve el pago en silencio.
  if (Number(origen.costo) !== Number(destino.costo) || origen.currency !== destino.currency) {
    return {
      code: 'costo_distinto',
      mensaje: `Los montos difieren (${origen.currency ?? 'CRC'} ${origen.costo} contra ${destino.currency ?? 'CRC'} ${destino.costo}). `
        + 'Esto requiere ajuste de finanzas.',
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

/** La traza que se le deja al pago, para que finanzas entienda el movimiento. */
export function notaDeTransferencia(input: {
  desde: string
  hacia: string
  quien: string
  cuando: Date
}): string {
  const fecha = input.cuando.toLocaleDateString('es-CR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Costa_Rica',
  })
  return `Movida de grupo el ${fecha}: «${input.desde}» → «${input.hacia}» (por ${input.quien}). El pago viaja con la matrícula; no se cobró de nuevo.`
}

/** Lo que se le dice al coordinador ANTES de confirmar. Sin sorpresas. */
export function resumenDeLaAccion(input: {
  persona: string
  desde: string
  hacia: string
  pagosQueViajan: number
}): string {
  const pago = input.pagosQueViajan === 0
    ? 'No hay ningún pago que mover.'
    : input.pagosQueViajan === 1
      ? 'Su pago se traslada a la matrícula nueva; no se le cobra de nuevo.'
      : `Sus ${input.pagosQueViajan} pagos se trasladan a la matrícula nueva; no se le cobra de nuevo.`
  return `Se cierra la matrícula de ${input.persona} en «${input.desde}» como transferida y queda matriculada en «${input.hacia}». ${pago}`
}
