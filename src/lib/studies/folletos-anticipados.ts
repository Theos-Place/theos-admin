/**
 * EST-21 · Cuándo se pueden pedir los folletos por adelantado.
 *
 * Módulo PURO: el endpoint hace las consultas, la regla vive acá y se puede
 * probar sin base.
 */
import { folletosQuePide } from './corte-de-bloque'
import type { Modalidad } from './modalidad-de-bloques'

/** Los niveles que abren un bloque: son los que piden el par completo. */
export const NIVELES_QUE_PIDEN_POR_ADELANTADO = ['N1', 'N3'] as const

export type Veredicto =
  | { puede: true }
  | { puede: false; code: string; motivo: string }

/**
 * Solo N1 y N3, y solo en matrícula.
 *
 * · **El nivel.** Decisión de Floriana (2026-09-30): son los que abren un
 *   bloque y por lo tanto los que necesitan folletos impresos antes del
 *   primer día. Un N2 o un N4 no pide nada —su gente ya los tiene desde que
 *   entró al bloque— y eso NO se escribe acá: se pregunta a
 *   `folletosQuePide`, la misma regla que usan el cobro, la orden y el
 *   conteo de impresión. Una cuarta copia se habría separado de las otras
 *   tres.
 *
 * · **El estado.** En matrícula, que es el punto entero del ítem: pedirlos
 *   ~15 días antes de arrancar. Un grupo ya en curso llegó tarde y uno
 *   finalizado no tiene a quién entregarle; en los dos casos queda el pedido
 *   manual suelto de la pantalla de folletos, que existe para los casos raros.
 */
export function puedePedirFolletosAnticipados(
  g: {
    planCode: string | null | undefined
    status: string | null | undefined
    /** Bajo `legacy` cada nivel pide SU folleto, no el par (ver
     *  `modalidad-de-bloques`). */
    modalidad: Modalidad
  },
): Veredicto {
  if (!g.planCode) {
    return { puede: false, code: 'sin_plan', motivo: 'El grupo no tiene un plan de estudio asignado.' }
  }
  if (!(NIVELES_QUE_PIDEN_POR_ADELANTADO as readonly string[]).includes(g.planCode)) {
    const yaLosTiene = folletosQuePide(g.planCode, g.modalidad).length === 0
    return {
      puede: false,
      code: yaLosTiene ? 'ya_los_tiene_del_bloque' : 'nivel_no_aplica',
      motivo: yaLosTiene
        ? 'Los estudiantes de este nivel ya recibieron sus folletos al entrar al bloque.'
        : 'Solo los grupos de Nivel 1 y Nivel 3 piden folletos por adelantado.',
    }
  }
  if (g.status !== 'en_matricula') {
    return {
      puede: false, code: 'estado_no_aplica',
      motivo: g.status === 'en_curso'
        ? 'El grupo ya arrancó: los folletos se piden durante la matrícula.'
        : 'Solo se piden por adelantado mientras el grupo está en matrícula.',
    }
  }
  return { puede: true }
}

/** Qué folletos va a traer la orden, para mostrarlo en la confirmación. */
export function folletosQueVaAPedir(
  planCode: string | null | undefined,
  modalidad: Modalidad,
): readonly string[] {
  return folletosQuePide(planCode, modalidad)
}
