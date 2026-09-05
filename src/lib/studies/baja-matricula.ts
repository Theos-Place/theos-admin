/**
 * Dos formas de sacar a alguien de un grupo, que no son lo mismo.
 *
 * Hasta el 2026-09-05 había una sola acción y se llamaba de dos maneras: el
 * modal decía "Desinscribir participante" y adentro "Quedará como retirado",
 * con un campo "Motivo del retiro". Todo terminaba en `dropped`, así que en la
 * ficha salía "Se retiró" incluso cuando la matrícula había sido un error.
 *
 * Son cosas distintas y se leen distinto en el expediente de una persona:
 *
 *   · QUITAR DEL GRUPO — la matrícula no debió existir: se inscribió por
 *     error, se equivocó de grupo, se está reinscribiendo. No cursó nada.
 *     Queda 'cancelada' y NO aparece en su historial de estudios.
 *
 *   · RETIRAR DEL ESTUDIO — venía cursando y dejó de ir. Eso sí pasó y sí
 *     queda: 'dropped', que la ficha muestra como "Se retiró".
 *
 * La diferencia importa porque el historial es el expediente de una persona.
 * Decir que alguien se retiró de un estudio que nunca empezó es escribirle una
 * historia que no vivió.
 */

export const TIPOS_DE_BAJA = ['cancelar', 'retirar'] as const
export type TipoDeBaja = (typeof TIPOS_DE_BAJA)[number]

export function esTipoDeBaja(v: unknown): v is TipoDeBaja {
  return typeof v === 'string' && (TIPOS_DE_BAJA as readonly string[]).includes(v)
}

/** El estado en que queda la inscripción según el tipo de baja. */
export function estadoDeBaja(tipo: TipoDeBaja): 'cancelada' | 'dropped' {
  return tipo === 'cancelar' ? 'cancelada' : 'dropped'
}

export const BAJA_COPY: Record<TipoDeBaja, {
  titulo: string
  boton: string
  gerundio: string
  /** Qué le pasa a la persona, en la pantalla de confirmación. */
  efecto: string
  labelMotivo: string
  placeholderMotivo: string
}> = {
  cancelar: {
    titulo: 'Quitar del grupo',
    boton: 'Quitar del grupo',
    gerundio: 'Quitando…',
    efecto: 'La matrícula se anula como si no hubiera pasado: no queda en su historial de estudios y el cupo se libera. Se puede volver a matricular cuando sea.',
    labelMotivo: 'Por qué se quita',
    placeholderMotivo: 'Ej.: se inscribió por error, se equivocó de grupo, se va a reinscribir…',
  },
  retirar: {
    titulo: 'Retirar del estudio',
    boton: 'Retirar',
    gerundio: 'Retirando…',
    efecto: 'Queda registrado que empezó el estudio y lo dejó. Aparece en su historial como "Se retiró", con el motivo.',
    labelMotivo: 'Motivo del retiro',
    placeholderMotivo: 'Ej.: se mudó de zona, cambió de horario de trabajo, motivos de salud…',
  },
}
