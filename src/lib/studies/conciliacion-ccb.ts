/**
 * DAT-14 · El histórico de process queues de CCB contra lo que tiene el sistema.
 *
 * LA REGLA, dicha por Floriana: *solo deberían existir cierres o aprobaciones
 * de personas que tienen process queue en CCB. Si estuvieron en un grupo y
 * después las sacaron, eso no es una reprobación — fue un error de haberlas
 * unido al grupo.*
 *
 * Acá vive la parte que se puede probar sin base de datos: qué fila del export
 * cuenta, a qué plan corresponde su cola, y en qué casilla de la conciliación
 * cae cada persona-plan. El script `scripts/dat14-2026-10-13/conciliar.cjs`
 * pone los datos; este módulo pone el criterio.
 *
 * Módulo PURO.
 */

/**
 * Las colas «Reprueba …» no cuentan como aprobación — instrucción de Floriana
 * al entregar el export (2026-10-13). En CCB son el trámite que se le abre a
 * quien reprobó, no un estudio ganado, y hay 1.249 de ellas.
 *
 * PERO NO SE TIRAN A LA BASURA, y esto se descubrió midiendo: de los 54
 * «reprobado» del sistema que no tenían cola de aprobación, 48 SÍ tenían cola
 * «Reprueba» (45 con fecha compatible). Botarlas del todo habría puesto a 48
 * reprobaciones reales en la lista de «errores de unión al grupo» — el error
 * más caro posible acá, porque le borra a alguien algo que sí pasó. La cola
 * «Reprueba» es la prueba de LA REPROBACIÓN; lo que no es, es una aprobación.
 *
 * Dos avisos sobre ella: no nombra el plan («Reprueba Nivel 1 - 4» cubre los
 * cuatro niveles, «Reprueba Capacitación» el resto), así que solo sirve a
 * nivel de persona + año; y por eso nunca puede confirmar un plan concreto.
 */
export const esColaDeReprueba = (cola: string): boolean =>
  /^\s*reprueba\b/i.test(cola)

/**
 * COLA DE CCB → CÓDIGO DE PLAN DEL SISTEMA.
 *
 * Escrito a mano y no por parecido de texto: «Discipulos 3» sin tilde,
 * «Desiciones» con la falta de ortografía que trae el export y
 * «¿Cómo dar Estudios Bíblicos?» con signos que ningún normalizador junta
 * con CDEB por su cuenta. Adivinar acá le acredita a alguien un estudio que
 * no llevó.
 */
export const PLAN_POR_COLA: Readonly<Record<string, string>> = {
  'Nivel 1': 'N1',
  'Nivel 2': 'N2',
  'Nivel 3': 'N3',
  'Nivel 4': 'N4',
  '¿Adónde va este bus?': 'BUS',
  'Sirviendo como Jesús': 'SCJ',
  'Discípulos 1': 'DIS1',
  'Discípulos 2': 'DIS2',
  'Discipulos 3': 'DIS3',
  'Panorama': 'PAN',
  '¿Cómo dar Estudios Bíblicos?': 'CDEB',
  'Administrando el Dinero': 'AED',
  'Matrimonios': 'MAT',
  'Religiones del Mundo': 'RDM',
  'Evangelismo': 'EVM',
  '¿Cómo interpretar la Biblia? (Hermenéutica)': 'HER',
  'Hechos': 'HCH',
  'Evangelios': 'EVA',
  'Defendiendo la Fe (Apologética)': 'DLF',
  'Cómo Tomar Buenas Desiciones (Viviendo en Integri)': 'CTBD',
  'Pre Matrimonial': 'PREMAT',
  'Hebreos': 'HEB',
  'Romanos': 'ROM',
  '¿Cómo dar Charlas?': 'CDC',
  'Amor sin Fronteras': 'ASF',
  '¿Quien es Jesús?': 'QEJ',
  'Efesios': 'EFE',
  'Seminario - Teologia AT - Esepa': 'TEOAT',
  'Lecturas con Propósito': 'LECTPROP',
  'Galatas': 'GAL',
  'Movimiento de Discipulos Multiplicadores': 'MDM',
  'Apocalipsis': 'APO',
}

/**
 * Las que NO tienen plan y no es un olvido.
 *
 * «Bienestar Integral» (96) y «Pasantía como Dirigente» (57) existen en CCB
 * pero no son planes de estudio del sistema: la pasantía es un estado del
 * dirigente (DIR-8, `razon_no_disponible = 'pasantia'`). Quedan declaradas
 * acá para que el script no las cuente como colas desconocidas y para que
 * una cola NUEVA sí salte.
 */
export const COLAS_SIN_PLAN: readonly string[] = [
  'Bienestar Integral',
  'Pasantía como Dirigente',
]

export const planDeCola = (cola: string): string | null =>
  PLAN_POR_COLA[cola.trim()] ?? null

/**
 * Los estados del sistema que afirman algo sobre el resultado y por lo tanto
 * se pueden contrastar contra CCB.
 *
 * `enrolled` y `pendiente_de_pago` son presente, no resultado. `dropped`,
 * `cancelada` y `transferred` ya son una decisión tomada sobre esa matrícula
 * y no hay nada que conciliar.
 */
export const ESTADOS_CONCILIABLES = ['completed', 'reprobado', 'en_revision'] as const
export type EstadoConciliable = (typeof ESTADOS_CONCILIABLES)[number]

export type Casilla =
  | 'ok'                    // el sistema dice aprobado y CCB tiene la cola
  | 'resultado_distinto'    // el sistema dice reprobado/en revisión y CCB la aprobó
  | 'sin_respaldo'          // el sistema afirma un resultado y CCB no sabe nada
  | 'cierre_no_registrado'  // CCB la aprobó y el sistema no tiene la matrícula

export function clasificar(
  estado: EstadoConciliable | null,
  enCcb: boolean,
): Casilla {
  if (estado === null) return 'cierre_no_registrado'
  if (!enCcb) return 'sin_respaldo'
  return estado === 'completed' ? 'ok' : 'resultado_distinto'
}

/**
 * Qué se propone para cada casilla, y por qué NO es `dropped`.
 *
 * `cancelada` dice «esta matrícula no debió existir»; `dropped` dice «se
 * salió». El historial de estudios es el expediente de una persona: dejarle
 * un abandono que no ocurrió es escribirle algo falso en el expediente.
 * La distinción vive en `lib/studies/baja-matricula.ts`.
 */
export const PROPUESTA_SIN_RESPALDO = 'cancelada' as const

/**
 * El corte: después de esta fecha el export de CCB no prueba nada.
 *
 * CCB dejó de alimentarse cuando el sistema pasó a ser la fuente. Una
 * matrícula cerrada DESPUÉS de la última cola del export no tiene respaldo
 * posible, y meterla en «sin respaldo» convertiría el trabajo reciente de los
 * dirigentes en 'cancelada'. El script calcula la fecha del propio archivo en
 * vez de fijarla acá.
 */
export function fueraDelAlcance(cierre: string | null, ultimaColaCcb: string): boolean {
  if (!cierre) return false
  return cierre.slice(0, 10) > ultimaColaCcb.slice(0, 10)
}

/**
 * La fecha de verdad está en «Queue Days», NO en «Due».
 *
 * `Due` es el vencimiento de la cola y difiere de la fecha real hasta por
 * cinco días. La buena viene incrustada en una frase:
 * `"5 Days in queue, completed on 24 jul 2020"`.
 *
 * ESTO SE DESCUBRIÓ A TIEMPO Y POR POCO: tomando `Due` había 1.751 Nivel 2
 * con la misma fecha, 2019-06-13, que es un vencimiento masivo de CCB y no
 * el día en que nadie terminó nada. Esas filas dicen `completed on ` a
 * secas — están marcadas Done pero sin fecha de completado — y escribirles
 * 2019-06-13 habría puesto una fecha falsa, con pinta de exacta, en el
 * expediente de 1.751 personas. Cuando no hay fecha real, no se inventa: se
 * devuelve null y la matrícula se queda sin fecha, que es honesto.
 *
 * Ojo con «sept»: CCB escribe cuatro letras para setiembre y tres para todos
 * los demás meses. Un `[a-z]{3}` se come la «t» y la fila se pierde en
 * silencio — se perdían 2.061 antes de contarlas bien.
 */
const MES_CCB: Readonly<Record<string, string>> = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', set: '09', sep: '09', sept: '09',
  oct: '10', nov: '11', dic: '12',
}

export function fechaDeCompletado(queueDays: string | null | undefined): string | null {
  const m = (queueDays ?? '').match(/completed on (\d{1,2}) ([a-zA-Zé]{3,4})\.? (\d{4})/)
  if (!m) return null
  const mes = MES_CCB[m[2].toLowerCase()]
  if (!mes) return null
  return `${m[3]}-${mes}-${m[1].padStart(2, '0')}`
}
