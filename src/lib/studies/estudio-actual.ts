/**
 * SRV-7 · Qué estudio está llevando alguien, o cuál fue el último.
 *
 * La columna de "Mi comité" decía solo "Llevando"/"Dando", y la pregunta
 * siguiente de quien la mira siempre es "¿cuál?". Sin el nombre, el encargado
 * tiene que ir al perfil de cada persona.
 *
 * DÓNDE ESTÁ LA LÍNEA entre "lo lleva ahora" y "lo llevó": manda el estado del
 * GRUPO, no el de la matrícula. Una matrícula `enrolled` en un grupo
 * `finalizado` no es alguien estudiando: es alguien a quien no le cerraron el
 * resultado. Hay 675 matrículas `enrolled` contra 68 grupos `en_curso`, así que
 * mirar solo la matrícula diría que media iglesia está estudiando.
 *
 * Módulo PURO.
 */

/** Estados de GRUPO en los que el estudio está pasando ahora. */
export const GRUPOS_EN_MARCHA = ['en_curso', 'en_matricula'] as const

/** Matrículas que siguen contando dentro de un grupo en marcha. Se excluyen
 *  las que ya salieron: dropped, cancelada y transferred. */
export const MATRICULAS_VIGENTES = ['enrolled', 'pendiente_de_pago', 'en_revision'] as const

export function grupoEnMarcha(estadoDelGrupo: string | null | undefined): boolean {
  return (GRUPOS_EN_MARCHA as readonly string[]).includes(estadoDelGrupo ?? '')
}

export function matriculaVigente(estadoDeLaMatricula: string | null | undefined): boolean {
  return (MATRICULAS_VIGENTES as readonly string[]).includes(estadoDeLaMatricula ?? '')
}

/**
 * PAR-5 · CURSANDO AHORA es más estricto que «en marcha», y la diferencia
 * importa.
 *
 * `grupoEnMarcha` incluye `en_matricula` porque para el COMPROMISO de servicio
 * (SRV-7) alguien inscrito en un grupo que arranca la otra semana ya está
 * comprometido. Pero para la pregunta «¿quién está cursando hoy?» eso es falso:
 * todavía no ha ido a una sola sesión.
 *
 * Medido el 2026-09-23: 666 personas con matrícula vigente contra 431 en un
 * grupo que ya arrancó. Las otras 241 están esperando que empiece.
 *
 * Las dos definiciones conviven a propósito y por eso tienen nombres distintos.
 * Si alguna vez se unifican, que sea una decisión y no un descuido.
 */
export function cursandoAhora(estadoDelGrupo: string | null | undefined): boolean {
  return estadoDelGrupo === 'en_curso'
}

export type MatriculaParaColumna = {
  status: string | null | undefined
  grupo: { status?: string | null; planNombre?: string | null } | null | undefined
}

/**
 * Los estudios que la persona CURSA hoy, por nombre.
 *
 * Devuelve TODOS, no el primero: hay gente con dos matrículas a la vez y la
 * columna decía solo una —usaba `.find()`—, así que mostraba un dato incompleto
 * sin avisar. Se ordenan alfabéticamente para que la celda no cambie de orden
 * entre recargas por el capricho del join.
 */
export function estudiosQueCursa(matriculas: readonly MatriculaParaColumna[]): string[] {
  const nombres = matriculas
    .filter(m => matriculaVigente(m.status) && cursandoAhora(m.grupo?.status) && m.grupo?.planNombre)
    .map(m => m.grupo!.planNombre!)
  return [...new Set(nombres)].sort((a, b) => a.localeCompare(b, 'es'))
}

export type EstudioDeLaPersona = {
  /** Los que está llevando ahora, por nombre. */
  llevando: string[]
  /** Los que está dando ahora, por nombre. */
  dando: string[]
  /** El último que terminó, si hoy no está llevando ninguno. */
  ultimo: { nombre: string; fecha: string | null } | null
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

/** "mar 2026" a partir de 'YYYY-MM-DD'. '' si no hay fecha. */
export function mesYAnio(fecha: string | null | undefined): string {
  if (!fecha) return ''
  const m = /^(\d{4})-(\d{2})/.exec(fecha)
  if (!m) return ''
  return `${MESES[Number(m[2]) - 1]} ${m[1]}`
}

/**
 * El texto de la columna.
 *
 * El último estudio SOLO se muestra cuando no está llevando ninguno: quien ya
 * está estudiando no necesita que le recuerden el anterior, y la columna se
 * vuelve ilegible. Por eso no es "todo junto" sino una u otra cosa.
 */
export function textoDeEstudio(e: EstudioDeLaPersona): string {
  const partes: string[] = []
  // "Cursando:" y "Dirige:" al frente (pedido del usuario 2026-09-21): sin la
  // palabra, "Nivel 2" a secas no dice si lo está llevando o si lo dio, y en una
  // columna donde la otra opción empieza con "Último:" la asimetría confunde.
  if (e.llevando.length) partes.push(`Cursando: ${e.llevando.join(', ')}`)
  if (e.dando.length) partes.push(`Dirige: ${e.dando.join(', ')}`)
  if (partes.length) return partes.join(' · ')
  if (e.ultimo) {
    const f = mesYAnio(e.ultimo.fecha)
    return `Último: ${e.ultimo.nombre}${f ? ` · ${f}` : ''}`
  }
  return ''
}

/** ¿Cumple el compromiso de estudio? Llevar o dar, igual que antes de SRV-7:
 *  el último estudio es información, no cumplimiento. */
export function estaEnEstudio(e: EstudioDeLaPersona): boolean {
  return e.llevando.length > 0 || e.dando.length > 0
}
