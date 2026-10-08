/**
 * Cuál es el ÚLTIMO estudio de una persona, para la ficha del aplicante.
 *
 * EL BUG (Floriana, 2026-10-08): la ficha de Karen Angamarca decía
 * «Transformados», un estudio de junio de 2025, cuando lo que está llevando
 * ahora mismo es Nivel 4 con Alexandra Forero (jul–sep 2026).
 *
 * No era un problema de ORDEN, que es lo que parecía. La consulta pedía
 * `status = 'completed'` y nada más: el estudio en curso ni siquiera entraba
 * en la lista, así que el «último» terminaba siendo el último TERMINADO —y
 * con un solo estudio terminado, el único.
 *
 * POR QUÉ IMPORTA MÁS DE LO QUE PARECE. Esta ficha existe para una cosa:
 * que el encargado del puesto LLAME AL DIRIGENTE y pregunte por la persona
 * antes de recibirla. El dirigente que la conoce es el de ahora, no el de
 * hace año y medio. En el padrón hay 1.002 personas cuyo estudio más
 * reciente no está `completed` (medido el 2026-10-08): 695 en curso, 257 sin
 * cerrar, 45 reprobados y 5 sin pagar.
 *
 * QUÉ SE CUENTA Y QUÉ NO. Entra todo estudio en el que la persona ESTÁ o
 * ESTUVO. No entran `dropped`, `cancelada` ni `transferred`: de esos se
 * salió, y su dirigente no tiene nada que contar.
 *
 * Y SE DICE EN QUÉ ESTADO ESTÁ. Poner «Nivel 4» a secas cuando todavía no lo
 * termina afirma algo falso en una hoja que alguien usa para decidir.
 */

/** Los estados que `study_enrollments.status` admite hoy. */
export type EstadoDeMatricula =
  | 'completed' | 'enrolled' | 'en_revision' | 'reprobado'
  | 'pendiente_de_pago' | 'dropped' | 'cancelada' | 'transferred'

/** De estos la persona se salió: no cuentan como «su último estudio». */
export const ESTADOS_QUE_NO_CUENTAN: ReadonlyArray<string> =
  ['dropped', 'cancelada', 'transferred']

export function cuentaComoEstudio(status: string | null | undefined): boolean {
  return !!status && !ESTADOS_QUE_NO_CUENTAN.includes(status)
}

/** Lo que se le agrega al nombre cuando el estudio no está terminado. */
export const MATIZ_POR_ESTADO: Record<string, string> = {
  enrolled: 'en curso',
  pendiente_de_pago: 'en curso',
  en_revision: 'sin cerrar',
  reprobado: 'no aprobado',
}

export function nombreConEstado(nombre: string, status: string | null | undefined): string {
  const matiz = status ? MATIZ_POR_ESTADO[status] : undefined
  return matiz ? `${nombre} (${matiz})` : nombre
}

export type EstudioDeLaPersona = {
  nombre: string | null
  status: string | null
  /** `ends_at` del grupo, o `starts_at` si no terminó. '' si no se sabe. */
  fecha: string
  dirigente: string | null
  telefonoDirigente: string | null
}

export type UltimoEstudio = {
  /** Ya con el matiz: «Nivel 4 (en curso)». */
  nombre: string
  dirigente: string | null
  telefonoDirigente: string | null
  /** Para quien necesite el dato crudo. */
  status: string | null
}

/**
 * El más reciente de los que cuentan, o null si no hay ninguno.
 *
 * Ordena por la fecha del GRUPO y no por la de la matrícula: la fila se crea
 * cuando la persona se inscribe, que puede ser meses antes, y dos estudios
 * matriculados el mismo día se desempatarían al azar.
 *
 * Un estudio sin fecha queda de ÚLTIMO en vez de primero: sin fecha no se
 * puede afirmar que sea el más reciente, y adivinar acá es justo lo que puso
 * un estudio de 2025 en la ficha.
 */
export function ultimoEstudioDe(
  estudios: ReadonlyArray<EstudioDeLaPersona>,
): UltimoEstudio | null {
  const validos = estudios.filter(e => !!e.nombre && cuentaComoEstudio(e.status))
  if (validos.length === 0) return null
  const ordenados = [...validos].sort((x, y) => {
    if (!x.fecha && !y.fecha) return 0
    if (!x.fecha) return 1
    if (!y.fecha) return -1
    return y.fecha.localeCompare(x.fecha)
  })
  const u = ordenados[0]
  return {
    nombre: nombreConEstado(u.nombre!, u.status),
    dirigente: u.dirigente,
    telefonoDirigente: u.telefonoDirigente,
    status: u.status,
  }
}
