/**
 * El estado que se MUESTRA de un grupo, que tiene un escalón más que el guardado.
 *
 * study_groups.status tiene tres valores a propósito (en_matricula / en_curso /
 * finalizado) y la ventana de matrícula funciona como sub-estado sobre el
 * primero: un grupo sigue "en_matricula" desde que se crea hasta que arranca,
 * aunque la matrícula haya cerrado semanas antes. Eso es lo que se veía mal en
 * pantalla — el 14 de setiembre había 29 grupos marcados "En matrícula" que
 * habían cerrado el 13 y arrancaban entre el 28 de setiembre y el 12 de octubre.
 *
 * Acá se deriva el escalón que faltaba, "Por iniciar", SIN tocar la columna.
 * La razón de no agregar un cuarto valor guardado: hay 73 lugares en el código
 * que preguntan por 'en_matricula', y cada uno significa una cosa distinta
 * —unos "acepta matrículas", otros "todavía no empieza"— así que partir el
 * estado obliga a re-decidir los 73. Derivarlo deja intacta toda esa lógica: la
 * ventana ya bloquea la matrícula, que es el comportamiento que importa.
 *
 * Consecuencia de que sea derivado: no se pone ni se quita a mano. Sale de las
 * fechas, y si alguien corre la fecha de cierre el grupo vuelve a matrícula
 * solo, que es justo lo que uno espera al correrla.
 */
import type { GroupStatus } from '@/types/study'

export type EstadoVisible = 'en_matricula' | 'por_iniciar' | 'en_curso' | 'finalizado'

export type GrupoParaEstado = {
  status: GroupStatus
  enrollment_end_date?: string | null
  start_date?: string | null
}

export const ETIQUETA_VISIBLE: Record<EstadoVisible, string> = {
  en_matricula: 'En matrícula',
  por_iniciar: 'Por iniciar',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
}

/** "Por iniciar" va en ámbar: no es un estado malo, es uno que espera una fecha. */
export const BADGE_VISIBLE: Record<EstadoVisible, string> = {
  en_matricula: 'bg-teal-soft/30 text-teal-deep',
  por_iniciar: 'bg-amber-50 text-amber-700',
  en_curso: 'bg-navy/10 text-navy',
  finalizado: 'bg-surface-low text-navy-light/80',
}

/**
 * La condición es UNA: el grupo sigue en matrícula y su ventana ya cerró.
 *
 * No se le pide además que la fecha de inicio sea futura. Entre que el grupo
 * arranca y el cron nocturno lo pasa a en_curso puede haber unas horas, y en
 * esas horas "Por iniciar" describe mejor la realidad que "En matrícula".
 *
 * Un grupo sin fecha de cierre no entra nunca: sin ventana no hay forma de
 * saber que la matrícula cerró, y adivinarlo sería peor que no decir nada.
 */
export function estadoVisible(g: GrupoParaEstado, hoyYmd: string): EstadoVisible {
  if (g.status !== 'en_matricula') return g.status
  const cierre = (g.enrollment_end_date ?? '').slice(0, 10)
  return cierre && hoyYmd > cierre ? 'por_iniciar' : 'en_matricula'
}

/** Los cuatro, en el orden en que avanza un grupo. */
export const ESTADOS_VISIBLES: EstadoVisible[] = ['en_matricula', 'por_iniciar', 'en_curso', 'finalizado']

/**
 * Qué estados guardados hay que pedirle al servidor para poder mostrar una
 * selección de estados visibles.
 *
 * El filtro de la pantalla habla en estados VISIBLES pero la consulta va contra
 * la columna, así que "Por iniciar" y "En matrícula" piden lo mismo
 * ('en_matricula') y el reparto fino se hace después, en memoria, sobre la
 * página ya traída.
 */
export function estadosGuardadosParaFiltro(visibles: EstadoVisible[]): GroupStatus[] {
  const s = new Set<GroupStatus>()
  for (const v of visibles) s.add(v === 'por_iniciar' ? 'en_matricula' : v)
  return [...s]
}

/**
 * El desglose que necesita la consulta: qué estados guardados van tal cual y si
 * hay que partir 'en_matricula' por la ventana.
 *
 * Se devuelve descrito, no como SQL: la capa de datos arma la condición. El
 * caso que obliga a esto es elegir "Por iniciar" junto con "En curso" — ahí no
 * alcanza con un filtro global de ventana cerrada, porque le aplicaría también
 * a los en_curso y los dejaría fuera.
 */
export type DesgloseDeEstados = {
  /** Estados que se piden sin más (en_curso, finalizado). */
  guardados: GroupStatus[]
  /** 'en_matricula' con la ventana todavía abierta (o sin ventana). */
  matriculaAbierta: boolean
  /** 'en_matricula' con la ventana ya vencida = "Por iniciar". */
  matriculaCerrada: boolean
  /** true = no hay nada que filtrar (ningún estado elegido, o los cuatro). */
  sinFiltro: boolean
}

export function desglosarSeleccion(visibles: EstadoVisible[]): DesgloseDeEstados {
  const set = new Set(visibles)
  const sinFiltro = set.size === 0 || set.size === ESTADOS_VISIBLES.length
  return {
    guardados: (['en_curso', 'finalizado'] as GroupStatus[]).filter(e => set.has(e as EstadoVisible)),
    matriculaAbierta: set.has('en_matricula'),
    matriculaCerrada: set.has('por_iniciar'),
    sinFiltro,
  }
}

export function coincideEstadoVisible(
  g: GrupoParaEstado, elegidos: EstadoVisible[], hoyYmd: string,
): boolean {
  if (!elegidos.length) return true
  return elegidos.includes(estadoVisible(g, hoyYmd))
}
