/**
 * MAT-3 · Cobros de estudio que se quedaron sin estudio.
 *
 * QUÉ PASÓ (2026-10-12). Un cobro de matrícula o folletos cuelga de una
 * matrícula (`enrollment_id`) y de un grupo (`study_group_id`). Las dos FK
 * son ON DELETE SET NULL, así que borrar el grupo no borra el cobro: lo deja
 * apuntando a nada. Deja de aparecer en la pantalla del estudio, deja de
 * contarse para la persona, y nadie se entera — no hay error, no hay log,
 * la fila simplemente se vuelve invisible.
 *
 * Se encontraron 9 así, y solo porque alguien fue a buscarlos a mano. Entre
 * ellos ₡30.000 ya pagados. El guard de `borrar-grupo` impide que se creen
 * nuevos; esto es para VER los que haya, porque «no pueden existir
 * huérfanos» solo se puede sostener si se pueden mirar.
 *
 * GRAVEDAD. No todos pesan igual y la pantalla tiene que ordenarlos, o los
 * importantes se pierden entre los que no importan:
 *   · `pagado`     — entró plata y no cuelga de nada. Lo más grave.
 *   · `pendiente`  — se le debe cobrar a alguien y nadie lo va a ver.
 *   · `sin_dueno`  — ni siquiera tiene member_id. No se sabe de quién es.
 *   · `anulado`    — cancelado: no hay plata de por medio, solo ruido.
 */
import { formatMoney } from '@/lib/format'

export type Gravedad = 'pagado' | 'sin_dueno' | 'pendiente' | 'anulado'

export type CobroHuerfano = {
  id: string
  persona: string | null
  monto: number
  currency: string
  status: string
  concepto: string | null
  /** Desde cuándo quedó suelto (el UPDATE que puso las FK en null). */
  huerfanoDesde: string | null
  /** Si ya se resolvió por otro lado: el crédito que salió de este cobro. */
  tieneCredito: boolean
}

export function gravedadDe(c: Pick<CobroHuerfano, 'status' | 'persona'>): Gravedad {
  if (!c.persona) return 'sin_dueno'
  if (c.status === 'paid') return 'pagado'
  if (c.status === 'cancelado') return 'anulado'
  return 'pendiente'
}

const ORDEN: Record<Gravedad, number> = { pagado: 0, sin_dueno: 1, pendiente: 2, anulado: 3 }

/** Lo grave primero; dentro de cada grupo, lo más viejo arriba. */
export function ordenarPorGravedad(cobros: readonly CobroHuerfano[]): CobroHuerfano[] {
  return [...cobros].sort((a, b) => {
    const d = ORDEN[gravedadDe(a)] - ORDEN[gravedadDe(b)]
    if (d !== 0) return d
    return (a.huerfanoDesde ?? '').localeCompare(b.huerfanoDesde ?? '')
  })
}

/** Qué hacer con este cobro, en una línea. */
export function queHacerCon(c: CobroHuerfano): string {
  const g = gravedadDe(c)
  if (g === 'sin_dueno') {
    return 'No tiene persona asignada. Hay que averiguar de quién es antes de tocarlo.'
  }
  if (g === 'pagado') {
    return c.tieneCredito
      ? 'Ya se resolvió: de este pago salió un crédito a favor. Queda suelto solo en la contabilidad del estudio.'
      : 'Entró la plata y no cuelga de ningún estudio. Hay que emitir el crédito o devolverla.'
  }
  if (g === 'pendiente') {
    return 'Se le debe cobrar a alguien y no aparece en ninguna pantalla. Reconectalo o anulalo.'
  }
  return 'Anulado: no hay plata de por medio.'
}

/** ¿Este cobro pide que alguien haga algo? */
export function pideAccion(c: CobroHuerfano): boolean {
  const g = gravedadDe(c)
  if (g === 'anulado') return false
  // Un pagado del que ya salió un crédito está resuelto para la persona:
  // queda suelto solo en la contabilidad del estudio.
  if (g === 'pagado' && c.tieneCredito) return false
  return true
}

/**
 * El aviso a finanzas. Devuelve null si no hay nada que avisar.
 *
 * Solo cuenta lo que pide acción. Ni los anulados ni los que ya se
 * resolvieron con un crédito hacen sonar nada: un aviso que suena por ruido
 * se deja de leer, y entonces no sirve el día que suene por algo real. Los
 * cuatro casos de octubre ya tienen su crédito y se verían todos los días.
 */
export function avisoDeHuerfanos(cobros: readonly CobroHuerfano[]): {
  title: string
  body: string
} | null {
  const vivos = cobros.filter(pideAccion)
  if (vivos.length === 0) return null
  const pagados = vivos.filter(c => gravedadDe(c) === 'pagado')
  const plata = pagados.reduce((t, c) => t + c.monto, 0)
  const title = vivos.length === 1
    ? 'Hay 1 cobro de estudio sin estudio'
    : `Hay ${vivos.length} cobros de estudio sin estudio`
  const detalle = pagados.length > 0
    ? ` ${pagados.length} ya ${pagados.length === 1 ? 'está pagado' : 'están pagados'} `
      + `(${formatMoney(plata, pagados[0]?.currency)}) y no ${pagados.length === 1 ? 'tiene' : 'tienen'} `
      + 'crédito a favor: esa plata entró y no cuelga de nada.'
    : ''
  return {
    title,
    body: `Quedaron sueltos al borrarse su grupo o su matrícula.${detalle}`
      + ' Se revisan en Finanzas → Cobros sin estudio.',
  }
}
