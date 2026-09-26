/**
 * REU-2 · Poner una solicitud EN ESPERA, con despertador.
 *
 * EL CASO (Ari): a la persona no le sirve ningún grupo de los que hay ahora y
 * quiere esperar a uno concreto — «cuando el grupo X llegue a Discípulos 2».
 * Las dos salidas que existían mentían: resolverla habría dicho que se
 * matriculó a alguien que no se matriculó, y rechazarla habría dicho que ya no
 * quiere. Así que se quedaba abierta, compitiendo por atención con las que sí
 * se pueden trabajar hoy.
 *
 * SE PREGUNTA EN SEMANAS Y SE GUARDA UN DÍA. Pensar en semanas es lo natural
 * («en unos tres meses»), pero guardar semanas obligaría a guardar también
 * desde cuándo se cuentan, y ese punto de partida se mueve cada vez que alguien
 * toca la solicitud. El día no se mueve.
 *
 * SOLO REUBICACIONES, por ahora. Es lo que se pidió, y es donde el caso
 * aparece: una solicitud de INTERÉS ya es un dato de demanda que no se gestiona
 * (EST-6), así que dormirla no le cambia la vida a nadie. Abrirlo a los dos
 * tipos es quitar 'relocation' de TIPOS_QUE_ESPERAN y nada más.
 *
 * Módulo PURO.
 */

export const ESTADO_EN_ESPERA = 'en_espera'

/** Qué tipos de solicitud pueden dormirse. */
export const TIPOS_QUE_ESPERAN: readonly string[] = ['relocation']

/** Desde qué estados se puede pausar. Una resuelta ya matriculó a alguien y una
 *  rechazada ya se cerró: dormirlas no significa nada. 'vencida' tampoco —
 *  para eso se reabre primero, que es una decisión distinta y queda en el
 *  historial como tal. */
export const ESTADOS_QUE_PUEDEN_ESPERAR: readonly string[] = ['open', 'in_review']

/**
 * Las opciones del selector, en semanas.
 *
 * Son pocas a propósito: la fecha es una estimación («cuando ese grupo pase de
 * nivel»), no un compromiso, y un selector con 52 números invita a una
 * precisión que nadie tiene. El tope de 26 semanas son seis meses — más que eso
 * ya es otra conversación, no una espera.
 */
export const SEMANAS_OFRECIDAS: readonly number[] = [2, 4, 8, 12, 16, 26]

export const SEMANAS_MINIMAS = 1
export const SEMANAS_MAXIMAS = 52

const MS_DIA = 86_400_000

/** YYYY-MM-DD + semanas → YYYY-MM-DD, en UTC (las fechas de espera son días,
 *  no instantes: contar en hora local movería el día en Costa Rica). */
export function fechaDeReactivacion(hoy: string, semanas: number): string {
  const t = Date.parse(`${hoy}T00:00:00Z`)
  if (!Number.isFinite(t)) throw new Error(`fecha inválida: ${hoy}`)
  return new Date(t + Math.round(semanas) * 7 * MS_DIA).toISOString().slice(0, 10)
}

/** null = se puede pausar. Si no, el motivo, con el mismo texto que ve quien lo
 *  intenta. */
export function motivoQueImpideEsperar(input: {
  requestType: string
  status: string
  semanas: number
}): string | null {
  if (!TIPOS_QUE_ESPERAN.includes(input.requestType)) {
    return 'Solo una solicitud de reubicación se puede poner en espera.'
  }
  if (input.status === ESTADO_EN_ESPERA) {
    return 'Esta solicitud ya está en espera. Para cambiarle la fecha, despertala primero.'
  }
  if (!ESTADOS_QUE_PUEDEN_ESPERAR.includes(input.status)) {
    return 'Solo una solicitud abierta o en revisión se puede poner en espera.'
  }
  if (!Number.isInteger(input.semanas) || input.semanas < SEMANAS_MINIMAS || input.semanas > SEMANAS_MAXIMAS) {
    return `Decinos cuántas semanas esperar, entre ${SEMANAS_MINIMAS} y ${SEMANAS_MAXIMAS}.`
  }
  return null
}

export type SolicitudDormida = {
  id: string
  status: string
  /** YYYY-MM-DD. */
  wait_until: string | null
}

/**
 * Las que hay que despertar hoy: dormidas cuyo día ya llegó.
 *
 * La comparación es `<=` y no `===` a propósito. El cron corre una vez por
 * semana, así que una fecha que cae un miércoles la ve el lunes siguiente; con
 * igualdad exacta, esa solicitud dormiría para siempre. Por la misma razón una
 * fecha vieja también despierta: si el cron no corrió, lo atrasado sale en la
 * próxima corrida en vez de perderse.
 */
export function solicitudesADespertar(
  solicitudes: readonly SolicitudDormida[],
  hoy: string,
): string[] {
  return solicitudes
    .filter(s => s.status === ESTADO_EN_ESPERA && !!s.wait_until && s.wait_until.slice(0, 10) <= hoy)
    .map(s => s.id)
}

/** Cuántos días faltan para que despierte (negativo = ya le tocaba). `null` si
 *  no tiene fecha, que no debería pasar pero no es razón para reventar. */
export function diasParaDespertar(waitUntil: string | null | undefined, hoy: string): number | null {
  const d = Date.parse(`${(waitUntil ?? '').slice(0, 10)}T00:00:00Z`)
  const h = Date.parse(`${hoy}T00:00:00Z`)
  if (!Number.isFinite(d) || !Number.isFinite(h)) return null
  return Math.round((d - h) / MS_DIA)
}

/**
 * Las columnas que hay que tocar cuando una solicitud DEJA de estar en espera,
 * la despierte el cron o la despierte una persona a mano.
 *
 * Está acá y no repetido en los dos lugares porque la parte que se olvida es
 * `reactivated_at`, y olvidarla no se nota: la solicitud vuelve a la cola, se
 * ve bien, y el cron de vencimiento la mata semanas después por vieja. Un bug
 * que aparece en otro módulo y con retraso es el que nadie conecta.
 */
export function parcheAlDespertar(ahoraIso: string): Record<string, unknown> {
  return { reactivated_at: ahoraIso, wait_until: null }
}
