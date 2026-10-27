/**
 * EST-30 · Folletos de Nivel 1: tiquete automático dos semanas antes de que
 * cierre la matrícula.
 *
 * EL PROBLEMA (pedido del 2026-10-26): la gente de Nivel 1 se anota hasta el
 * último día y la imprenta no da tiempo. Esperar a saber cuántos son es
 * llegar tarde; esperar a que alguien se acuerde de apretar el botón de
 * EST-21 también. Entonces el sistema pide solo, por adelantado, AL CUPO
 * MÁXIMO del grupo, y cuando el grupo abre actualiza el MISMO tiquete con el
 * número final. Quien imprime ve las dos cifras.
 *
 * Esto es SOLO la regla —cuándo toca, cuánto se pide, qué dice la nota—. Las
 * consultas y el tiquete viven en `queries/folletos.ts`; el cron diario de
 * ventanas de matrícula es el que llama (no hay cron nuevo: ya recorre los
 * grupos en matrícula todos los días).
 *
 * Módulo PURO, con tests.
 */
import { folletosQuePide } from './corte-de-bloque'
import type { Modalidad } from './modalidad-de-bloques'
import { formatDate } from '@/lib/format'

/**
 * Solo Nivel 1, aunque N3 y DIS1 también pidan por adelantado (EST-21). El
 * pedido fue por N1 —es donde la gente se anota el último día— y el cupo
 * máximo de un N3 o un DIS1 no dice nada: su gente ya viene del nivel
 * anterior. Agregar un nivel es agregarlo acá, nada más.
 */
export const NIVELES_CON_TIQUETE_AUTOMATICO = ['N1'] as const

/** Dos semanas antes del fin de matrícula. */
export const DIAS_ANTES_DEL_FIN_DE_MATRICULA = 14

/** Marca que lleva la nota del tiquete cuando ya se actualizó al abrir, para
 *  que la segunda corrida (o el cambio manual encima del cron) no la repita. */
export const MARCA_DE_APERTURA = 'Apertura del grupo'

/**
 * La fecha a partir de la cual toca pedir (YYYY-MM-DD).
 *
 * Se resta en UTC sobre las partes de la fecha, sin construir un `Date` desde
 * el string con zona: `new Date('2026-11-10')` es medianoche UTC y en Costa
 * Rica sería el 9. Comparar strings YYYY-MM-DD es exacto.
 */
export function fechaDeDisparo(finDeMatricula: string): string {
  const [y, m, d] = finDeMatricula.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - DIAS_ANTES_DEL_FIN_DE_MATRICULA)).toISOString().slice(0, 10)
}

export type GrupoCandidato = {
  planCode: string | null | undefined
  status: string | null | undefined
  enrollment_end_date: string | null | undefined
  modalidad: Modalidad
}

/**
 * ¿Hoy toca pedirle los folletos a este grupo?
 *
 * «Hoy o después», no «hoy exacto»: un grupo creado a 5 días del fin de
 * matrícula ya pasó la fecha de disparo y se pide en la próxima corrida.
 * Con el disparo exacto ese grupo nunca pediría. La idempotencia no sale de
 * la fecha sino de que el grupo ya tenga tiquete (índice único por grupo).
 *
 * Sin fin de matrícula no hay «dos semanas antes» de nada: queda el botón
 * manual de EST-21.
 */
export function tocaPedirAutomatico(g: GrupoCandidato, hoy: string): boolean {
  if (!g.planCode || !(NIVELES_CON_TIQUETE_AUTOMATICO as readonly string[]).includes(g.planCode)) return false
  if (g.status !== 'en_matricula') return false
  if (!g.enrollment_end_date) return false
  if (folletosQuePide(g.planCode, g.modalidad).length === 0) return false
  return hoy >= fechaDeDisparo(g.enrollment_end_date)
}

/**
 * Cuántos juegos se mandan a imprimir por adelantado: EL CUPO MÁXIMO, aunque
 * haya poca gente —la matrícula se llena al final—.
 *
 * Si hay más matriculados que cupo (pasa: el cupo se edita después), manda
 * el número mayor; imprimir al cupo dejaría gente sin folleto. Sin cupo
 * definido se cae a los matriculados, y con 0 y 0 no hay nada que imprimir.
 */
export function cantidadAnticipada(g: { max_students: number | null | undefined; matriculados: number }): number {
  return Math.max(g.max_students ?? 0, g.matriculados, 0)
}

export type ConteoDeMatricula = {
  /** Matriculados sin cobro pendiente. */
  confirmados: number
  /** Matriculados con un pago pendiente (carril aparte: la matrícula ya es
   *  efectiva, el cobro va por su lado). */
  pendientes: number
}

/** Las matrículas que ocupan campo y van a recibir folleto. 'pendiente_de_pago'
 *  sigue por las viejas: ya no se escribe, pero las que quedaron cuentan. */
const ESTADOS_QUE_CUENTAN = ['enrolled', 'pendiente_de_pago'] as const

/**
 * Cuenta confirmados y pendientes a partir de las matrículas con sus pagos,
 * tal como las devuelve la base.
 *
 * «Pendiente» = tiene un pago en `pending`. Un pago cancelado o pagado no lo
 * es; una matrícula sin pagos tampoco (el nivel puede no cobrarse).
 */
export function contarMatricula(
  filas: ReadonlyArray<{ status: string | null; payments?: ReadonlyArray<{ status: string | null }> | null }>,
): ConteoDeMatricula {
  let confirmados = 0
  let pendientes = 0
  for (const f of filas) {
    if (!(ESTADOS_QUE_CUENTAN as readonly string[]).includes(f.status ?? '')) continue
    const debe = (f.payments ?? []).some(p => p.status === 'pending')
    if (debe) pendientes++
    else confirmados++
  }
  return { confirmados, pendientes }
}

export function totalMatriculados(c: ConteoDeMatricula): number {
  return c.confirmados + c.pendientes
}

/** «3 matriculados confirmados · 2 con pago pendiente». */
export function textoConteo(c: ConteoDeMatricula): string {
  return `${c.confirmados} matriculado${c.confirmados === 1 ? '' : 's'} confirmado${c.confirmados === 1 ? '' : 's'} · ${c.pendientes} con pago pendiente`
}

/**
 * La nota con la que nace el tiquete. Dice de dónde sale la cantidad (el
 * cupo) y cuánta gente había ese día, que es lo que Denise necesita para
 * saber si el número es real o es el techo.
 */
export function notaInicial(i: {
  hoy: string
  finDeMatricula: string
  cantidad: number
  maxStudents: number | null | undefined
  conteo: ConteoDeMatricula
}): string {
  const origen = i.maxStudents && i.cantidad === i.maxStudents
    ? `cupo máximo del grupo (${i.maxStudents})`
    : i.maxStudents
      ? `matriculados (${i.cantidad}), que ya superan el cupo de ${i.maxStudents}`
      : `matriculados (${i.cantidad}); el grupo no tiene cupo máximo definido`
  return `Tiquete automático: dos semanas antes del fin de matrícula (${formatDate(i.finDeMatricula)}). `
    + `Cantidad = ${origen}. `
    + `Al ${formatDate(i.hoy)}: ${textoConteo(i.conteo)}.`
}

/**
 * Lo que se ANEXA a la nota cuando el grupo abre. Deja el historial a la
 * vista: cifra inicial → cifra final.
 */
export function notaDeApertura(i: {
  hoy: string
  cantidadInicial: number
  cantidadFinal: number
  conteo: ConteoDeMatricula
}): string {
  const cambio = i.cantidadInicial === i.cantidadFinal
    ? `La cantidad se mantiene en ${i.cantidadFinal}.`
    : `Cantidad: ${i.cantidadInicial} → ${i.cantidadFinal}.`
  return `${MARCA_DE_APERTURA} (${formatDate(i.hoy)}): ${textoConteo(i.conteo)}. ${cambio}`
}

/** La nota previa más el anexo, sin pisar nada. */
export function anexarNota(previa: string | null | undefined, anexo: string): string {
  const p = (previa ?? '').trim()
  return p ? `${p}\n\n${anexo}` : anexo
}

/** ¿La nota ya dice que el grupo abrió? Entonces no se actualiza dos veces. */
export function yaSeActualizoAlAbrir(nota: string | null | undefined): boolean {
  return (nota ?? '').includes(MARCA_DE_APERTURA)
}

/**
 * Cuando el grupo YA tenía tiquete (el botón de EST-21, o el cierre del
 * grupo anterior) no se crea otro: se levanta la cantidad al cupo si el
 * tiquete sigue en «creada» y pedía menos. Si ya está en impresión, lo que
 * se mandó a imprimir se mandó; tocarlo mentiría.
 */
export function cantidadAlConvivir(t: {
  status: string
  quantity: number
  cupo: number
}): number | null {
  if (t.status !== 'creada') return null
  if (t.cupo <= t.quantity) return null
  return t.cupo
}
