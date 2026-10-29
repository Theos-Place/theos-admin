/**
 * EST-31 (2026-10-29) · Continuación N2→N3: el tiquete de folletos en dos
 * tiempos y los avisos.
 *
 * Al cerrar un N2 con «sí continúa», el N3 nace EN MATRÍCULA unas dos semanas
 * (EST-14) y su tiquete de folletos se pide de una con los aprobados. Pero en
 * esas dos semanas puede entrar más gente, y quien imprime tiene que saberlo
 * desde el primer día: por eso el tiquete nace con una nota de «matrícula
 * abierta hasta el …» y, cuando la matrícula cierra, se ACTUALIZA el mismo
 * tiquete con el total final y el delta (lo ya impreso no se repite). Al
 * dirigente se le avisa solo si entró alguien más, con los nombres, para que
 * los sume al chat de WhatsApp.
 *
 * Módulo PURO: las reglas y los textos. Las consultas viven en
 * queries/folletos.ts; el barrido lo hace el cron diario de ventanas.
 */
import { formatDate } from '@/lib/format'
import { textoConteo, type ConteoDeMatricula } from './folletos-anticipados-auto'

/** Marca de la nota cuando la matrícula del sucesor ya cerró: idempotencia. */
export const MARCA_CIERRE_DE_MATRICULA = 'Cierre de matrícula'

/** ¿El grupo sucesor nació con ventana? Entonces el tiquete lleva la nota. */
export function tieneMatriculaAbierta(g: { status: string | null | undefined; enrollment_end_date: string | null | undefined }): boolean {
  return g.status === 'en_matricula' && !!(g.enrollment_end_date ?? '').trim()
}

/** La nota con la que nace el tiquete de cierre de un sucesor en matrícula. */
export function notaDeMatriculaAbierta(i: { finDeMatricula: string; aprobados: number; nivelOrigen?: string | null }): string {
  const origen = i.nivelOrigen ? ` de ${i.nivelOrigen}` : ''
  return `⚠️ Este grupo queda EN MATRÍCULA hasta el ${formatDate(i.finDeMatricula)}: `
    + 'potencialmente se matricularán más personas — habrá una actualización al cierre. '
    + `Cantidad inicial = ${i.aprobados} aprobado${i.aprobados === 1 ? '' : 's'}${origen}.`
}

/** ¿Toca cerrar la matrícula de este grupo hoy? Un día después del fin de la
 *  ventana, aunque todavía no haya arrancado: quien imprime necesita el
 *  número final ANTES del inicio, no el día que empieza. */
export function tocaCerrarMatricula(
  g: { status: string | null | undefined; enrollment_end_date: string | null | undefined },
  hoy: string,
): boolean {
  const fin = (g.enrollment_end_date ?? '').slice(0, 10)
  return g.status === 'en_matricula' && !!fin && hoy > fin
}

export function yaSeCerroLaMatricula(nota: string | null | undefined): boolean {
  return (nota ?? '').includes(MARCA_CIERRE_DE_MATRICULA)
}

export type DeltaDeFolletos =
  | { adicionales: number; texto: string; cambio: true }
  | { adicionales: 0; texto: string; cambio: false }

/**
 * Lo que hay que imprimir DE MÁS. Lo ya mandado a imprimir no se repite; si
 * salió gente, no se «desimprime»: el total final baja pero no hay delta
 * negativo que pedir.
 */
export function deltaDeFolletos(inicial: number, final: number): DeltaDeFolletos {
  if (final > inicial) {
    const n = final - inicial
    return { adicionales: n, cambio: true, texto: `CONTINUACIÓN: este grupo necesita +${n} folleto${n === 1 ? '' : 's'} adicional${n === 1 ? '' : 'es'} (ya se mandaron a imprimir ${inicial}; total final ${final}).` }
  }
  return { adicionales: 0, cambio: false, texto: final === inicial
    ? `Sin cambios: cantidad final confirmada (${final}).`
    : `Sin folletos adicionales: la cantidad bajó de ${inicial} a ${final} (lo ya impreso no se repite).` }
}

/** Lo que se anexa a la nota del tiquete al cerrar la matrícula. */
export function notaDeCierreDeMatricula(i: { hoy: string; inicial: number; final: number; conteo: ConteoDeMatricula }): string {
  return `${MARCA_CIERRE_DE_MATRICULA} (${formatDate(i.hoy)}): ${textoConteo(i.conteo)}. ${deltaDeFolletos(i.inicial, i.final).texto}`
}

export type MatriculaConFecha = {
  member_id: string
  status: string | null
  created_at: string | null
  nombre: string
}

/** Quiénes entraron DESPUÉS de que se pidió el tiquete (los que el dirigente
 *  tiene que sumar al chat). Solo matrículas que cuentan. */
export function nuevosDesde(filas: ReadonlyArray<MatriculaConFecha>, desdeIso: string): MatriculaConFecha[] {
  const desde = Date.parse(desdeIso)
  return filas.filter(f =>
    (f.status === 'enrolled' || f.status === 'pendiente_de_pago')
    && !!f.created_at && Date.parse(f.created_at) > desde)
}

/** El correo al dirigente va SOLO si entró alguien: cero ruido. */
export function textoParaElDirigente(nombres: readonly string[]): string | null {
  if (nombres.length === 0) return null
  const n = nombres.length
  return `Se matricul${n === 1 ? 'ó' : 'aron'} ${n} persona${n === 1 ? '' : 's'} más: ${nombres.join(', ')}. `
    + `Por favor asegurate de agregarl${n === 1 ? 'a' : 'as'} al chat de WhatsApp del grupo.`
}
