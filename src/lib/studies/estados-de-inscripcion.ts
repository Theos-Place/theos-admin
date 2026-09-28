/**
 * Los estados que una inscripción (`study_enrollments.status`) tiene DE VERDAD.
 *
 * POR QUÉ HACE FALTA ESCRIBIRLOS. El aviso de «tu capacitación está por
 * comenzar» filtraba con `status !== 'withdrawn'` — y `withdrawn` no existe en
 * esta base. El filtro no excluía a nadie, y el correo salió durante meses a
 * gente retirada, con la matrícula cancelada o ya pasada a otro grupo.
 * TypeScript no lo atrapó porque ahí el campo estaba tipado como `string`, y
 * `src/types/study.ts` todavía declara un `'withdrawn'` que la base no conoce.
 *
 * Esta lista se MIDIÓ contra producción el 2026-09-28 (36.056 inscripciones).
 * No es una intención: es lo que hay. Si aparece un estado nuevo, el test que
 * la acompaña obliga a clasificarlo en vez de dejarlo entrar por omisión.
 */
export const ESTADOS_DE_INSCRIPCION = [
  /** Matriculada y en curso. El caso normal. */
  'enrolled',
  /** Matriculada, con el pago pendiente. La matrícula ES efectiva: el pago va
   *  por un carril aparte (regla del 2026-08-04). */
  'pendiente_de_pago',
  /** Terminó el estudio. En este sistema `completed` YA significa aprobado; la
   *  reprobación se guarda aparte. */
  'completed',
  /** Reprobó. */
  'reprobado',
  /** Se retiró del grupo después de empezar. */
  'dropped',
  /** Canceló la matrícula antes de empezar. */
  'cancelada',
  /** Se pasó a otro grupo: hay una inscripción NUEVA en el destino. */
  'transferred',
  /** El grupo cerró sin registrar su resultado. */
  'en_revision',
] as const

export type EstadoDeInscripcion = (typeof ESTADOS_DE_INSCRIPCION)[number]

export function esEstadoDeInscripcion(v: unknown): v is EstadoDeInscripcion {
  return typeof v === 'string' && (ESTADOS_DE_INSCRIPCION as readonly string[]).includes(v)
}

/** ¿Sigue siendo parte del grupo? Lo usan los avisos: a quien ya no está no se
 *  le escribe sobre ese grupo. */
export function sigueEnElGrupo(estado: string): boolean {
  return estado === 'enrolled' || estado === 'pendiente_de_pago'
}

/**
 * Quiénes reciben el aviso «tu capacitación está por comenzar».
 *
 * ES UNA LISTA BLANCA, y ese es el arreglo de fondo. Antes el envío filtraba
 * con `status !== 'withdrawn'`, un estado que no existe, así que no excluía a
 * nadie. Lo reportó Alexandra Forero el 2026-09-28 —le llegó el aviso de un
 * estudio del que estaba fuera—: medido, entre el 25 y el 28 de setiembre se
 * mandaron 18 correos a 16 personas que ya no estaban en su grupo (7 con
 * matrícula cancelada, 6 retiradas, 5 pasadas a otro grupo).
 *
 * Con una lista NEGRA esto se repite: un estado nuevo entra sin que nadie lo
 * decida, porque «no está entre los excluidos» es el default. Con una BLANCA,
 * un estado nuevo queda fuera hasta que alguien lo agregue, que es el error
 * que se nota.
 *
 * Reglas de Floriana (2026-09-28): reciben `enrolled` y `pendiente_de_pago`;
 * no reciben `dropped` ni `cancelada`; `transferred` no por ESTE grupo y no
 * hace falta nada más —la transferencia crea una inscripción `enrolled` en el
 * destino, así que el aviso le llega por ahí—.
 */
export const RECIBEN_EL_AVISO: ReadonlySet<string> = new Set(
  ESTADOS_DE_INSCRIPCION.filter(sigueEnElGrupo),
)
