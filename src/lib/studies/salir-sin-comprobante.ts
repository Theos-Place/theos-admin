/**
 * MAT-3 · Qué se le dice a quien intenta cerrar el modal del comprobante.
 *
 * La matrícula YA está hecha cuando este modal se abre (carriles separados,
 * 2026-08-04): cerrar no la deshace. Pero hasta hoy, al intentar salir, lo
 * único que se ofrecía era CANCELARLA, y nadie le decía el estado real — que
 * queda viva y pendiente, y que se libera sola si el comprobante no llega.
 *
 * El texto sale de la constante y no de un número escrito a mano: el plazo ya
 * cambió una vez (48 → 72 el 2026-09-17) y un literal en la UI habría quedado
 * mintiendo sin que nadie lo notara.
 */
import { HORAS_DE_GRACIA } from './enrollment-hold'

/** Lo que ve quien intenta cerrar sin haber subido nada. */
export function avisoDeSalidaSinComprobante(estudio: string): {
  titulo: string
  cuerpo: string
  plazo: string
} {
  return {
    titulo: 'Tu matrícula todavía NO está completa',
    cuerpo: `Ya tenés el campo apartado en ${estudio}, pero falta el comprobante. `
      + 'Mientras no lo subás, la matrícula queda pendiente.',
    plazo: `Si no lo subís en las próximas ${HORAS_DE_GRACIA} horas, la matrícula `
      + 'se elimina sola y el cupo pasa a otra persona.',
  }
}

/** El mensaje del navegador si cierran la pestaña con el modal abierto.
 *
 *  Los navegadores modernos ignoran el texto y muestran el suyo, pero la
 *  cadena tiene que ser no vacía para que el diálogo salga del todo. */
export const AVISO_AL_CERRAR_PESTANA =
  'Falta subir el comprobante: tu matrícula queda pendiente y se puede liberar.'
