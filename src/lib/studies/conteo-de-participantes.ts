/**
 * EST-20 · Quién cuenta como participante de un grupo. UNA sola definición.
 *
 * EL PROBLEMA QUE RESUELVE. La página de resumen decía 380 en «Niveles
 * activos» y el Excel de la pantalla de grupos traía 386. Ninguno estaba
 * roto: contaban cosas distintas y nadie lo había escrito en un solo lugar.
 *
 *  · El resumen (RPC `study_dashboard_stats_v2`) contaba `enrolled` crudo y
 *    EXCLUÍA a los dirigentes.
 *  · El Excel contaba por NEGACIÓN —`p.status !== 'withdrawn'`— sobre el
 *    estado ya mapeado al dominio, donde `completed` y `reprobado` caen en
 *    «enrolled». Así sumaba a cinco personas que ya terminaron dentro de un
 *    grupo que sigue en curso, y a una dirigente matriculada en su propio
 *    grupo.
 *
 * CONTAR POR NEGACIÓN ES EL ERROR DE FONDO, y en este repo ya costó caro: el
 * aviso de «tu capacitación está por comenzar» filtraba con
 * `status !== 'withdrawn'` —un estado que no existe en esta base— y le llegó
 * a 16 personas que ya no estaban en su grupo. «Quién no está excluido» deja
 * entrar todo lo que nadie nombró; «quién sí cuenta» obliga a decidir.
 *
 * LA DEFINICIÓN, y por qué esta:
 *
 *  · `enrolled` y `pendiente_de_pago` SÍ. La matrícula es efectiva de
 *    inmediato y el pago va por un carril aparte (regla del 2026-08-04), así
 *    que alguien con el pago pendiente está estudiando igual.
 *  · `completed` y `reprobado` NO, aunque estén dentro de un grupo en curso:
 *    ya terminaron. Ocupan cupo —para eso está `OCCUPYING_STATUSES`— pero no
 *    son gente estudiando hoy, que es lo que el resumen quiere decir.
 *  · EL DIRIGENTE NO ES ESTUDIANTE de su propio grupo. Hoy hay una sola
 *    (Sofía Solís en su Nivel 3) y el resumen ya la excluía; el Excel no.
 *
 * OCUPAR CUPO Y ESTAR ESTUDIANDO SON PREGUNTAS DISTINTAS, y por eso hay dos
 * funciones. La columna «Participantes x/y» del Excel habla de cupo, así que
 * usa la de cupo; el resumen habla de gente, así que usa la otra. Lo que NO
 * puede volver a pasar es que cada pantalla invente su propia lista.
 *
 * Módulo PURO. El RPC en SQL tiene que decir lo mismo, y
 * `conteo-de-participantes.test.ts` compara las dos listas.
 */

import { OCCUPYING_STATUSES } from './enrollment-capacity'

/** Estudiando AHORA: es lo que cuenta el resumen. */
export const ESTUDIANDO_AHORA = ['enrolled', 'pendiente_de_pago'] as const

export function estaEstudiando(status: string | null | undefined): boolean {
  return !!status && (ESTUDIANDO_AHORA as readonly string[]).includes(status)
}

export type ParticipanteParaContar = {
  member_id: string
  /** El estado CRUDO de la base, no el mapeado al dominio: el mapeo une
   *  `completed` con `enrolled` y ahí se pierde la distinción que importa. */
  status: string
}

export type GrupoParaContar = {
  leader_id?: string | null
  co_leader_id?: string | null
}

export function esDirigenteDelGrupo(memberId: string, g: GrupoParaContar): boolean {
  return memberId === g.leader_id || memberId === g.co_leader_id
}

/**
 * Los que están estudiando en este grupo, sin los dirigentes.
 *
 * Devuelve la LISTA y no el número: quien necesita el conteo hace `.length`,
 * y quien necesita saber QUIÉNES son —un export, una revisión— no tiene que
 * repetir el filtro y arriesgarse a escribirlo distinto.
 */
export function estudiantesDelGrupo<T extends ParticipanteParaContar>(
  participantes: readonly T[],
  grupo: GrupoParaContar = {},
): T[] {
  return participantes.filter(p =>
    estaEstudiando(p.status) && !esDirigenteDelGrupo(p.member_id, grupo))
}

/** Los que OCUPAN CUPO: incluye a quien ya terminó dentro de un grupo que
 *  sigue abierto, porque su campo no está libre. Es la pregunta del «x/y». */
export function ocupanCupo<T extends ParticipanteParaContar>(
  participantes: readonly T[],
): T[] {
  return participantes.filter(p =>
    (OCCUPYING_STATUSES as readonly string[]).includes(p.status))
}
