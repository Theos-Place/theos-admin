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

/** Sufijo de los que todavía no arrancaron. Va acá y no en la pantalla porque
 *  también sale en el export, y las dos tienen que decir lo mismo. */
export const SUFIJO_EN_MATRICULA = ' (en matrícula)'

/**
 * Lo que la persona está llevando AHORA, incluyendo lo que todavía no empieza.
 *
 * Es lo que muestra la columna «Nivel actual» desde el 2026-09-25. La versión
 * anterior usaba `estudiosQueCursa`, que es estricta —solo grupos que ya
 * arrancaron— y por eso la columna salía VACÍA para quien estaba inscrito en un
 * grupo por empezar. Para una columna que se lee como «en qué anda esta
 * persona», eso es información que falta.
 *
 * LOS DOS CASOS SE DISTINGUEN, no se mezclan: al que no arrancó se le agrega
 * «(en matrícula)». Sin esa marca, la columna diría que alguien está llevando
 * Nivel 2 cuando todavía no ha ido a una sesión, que es justo el error que PAR-5
 * vino a arreglar.
 *
 * EL FILTRO NO CAMBIA. «Cursando ahora» sigue siendo estricto y «En matrícula»
 * es su propia opción (PAR-5b). Una columna informa; un filtro tiene que poder
 * responder una pregunta precisa, y son cosas distintas.
 */
export function estudiosEnMarcha(matriculas: readonly MatriculaParaColumna[]): string[] {
  const cursando = estudiosQueCursa(matriculas)
  const enMatricula = [...new Set(
    matriculas
      .filter(m => matriculaVigente(m.status)
        && m.grupo?.status === 'en_matricula'
        && m.grupo?.planNombre)
      .map(m => m.grupo!.planNombre!),
  )]
    .filter(n => !cursando.includes(n))
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map(n => `${n}${SUFIJO_EN_MATRICULA}`)

  // Primero lo que ya está pasando: es lo que se busca al mirar la columna.
  return [...cursando, ...enMatricula]
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

/**
 * «Último estudio» quiere decir DOS COSAS DISTINTAS según la pantalla, y por
 * eso los textos viven acá juntos: leídos uno al lado del otro se ve la
 * diferencia, y nadie puede cambiar uno y dejar el otro contradiciéndolo.
 *
 * El origen del dato es distinto de verdad, no es un matiz de redacción:
 *  - en «Mi comité» sale de `study_enrollments` — la persona como ESTUDIANTE.
 *  - en el comité de Dirigentes sale de `study_groups.leader_id/co_leader_id`
 *    — la persona DANDO el estudio.
 *
 * Reportado por Floriana el 2026-09-23: las dos columnas se llamaban igual y
 * la de dirigentes se leía como si fuera lo que la persona había llevado.
 */
export const INFO_ULTIMO_ESTUDIO_ESTUDIANTE =
  'El último estudio que la persona LLEVÓ como estudiante. Solo aparece cuando hoy no está llevando ni dando ninguno.'

export const INFO_ULTIMO_ESTUDIO_DIRIGENTE =
  'El último estudio que la persona DIO como dirigente o co-dirigente — no el que llevó como estudiante. El punto verde marca que el grupo está en curso o en matrícula ahora.'
