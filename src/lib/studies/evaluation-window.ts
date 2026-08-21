// DIR-5 · Ventana para contestar la evaluación del dirigente.
//
// Dos semanas desde que se pidió la evaluación (`study_groups.feedback_requested_at`),
// y después se cierra: el compilado tiene que poder darse por bueno en algún
// momento. Si se aceptaran respuestas para siempre, un tiquete resuelto podría
// cambiar de promedio después de que la coordinación ya lo revisó y se lo mandó
// al dirigente — que es justo lo que este flujo intenta evitar.
//
// OJO con dónde vive esto. La tentación era usar `forms.starts_at/ends_at`, que
// el endpoint genérico de formularios ya valida. No sirve: la encuesta es UN
// formulario compartido por todos los grupos, así que una ventana en el
// formulario los cerraría todos a la vez. La ventana es POR GRUPO y se cuenta
// desde que ese grupo pidió su evaluación.
//
// Además, la encuesta no pasa por `POST /api/forms/[id]/responses` sino por
// `POST /api/studies/groups/[id]/leader-feedback`, que no validaba ventana
// alguna. Por eso el chequeo se agrega ahí.

/** Días que dura la ventana desde que se pide la evaluación. */
export const EVALUATION_WINDOW_DAYS = 14

export type EvaluationWindowStatus =
  /** El grupo todavía no pidió evaluación: no hay nada que contestar. */
  | 'sin_solicitar'
  /** Dentro de las dos semanas: se aceptan respuestas. */
  | 'abierta'
  /** Pasaron las dos semanas: las respuestas tardías se rechazan. */
  | 'cerrada'

/** Fin de la ventana, o null si el grupo nunca pidió evaluación. */
export function evaluationWindowEnd(requestedAt: string | null | undefined): Date | null {
  if (!requestedAt) return null
  const start = new Date(requestedAt)
  if (isNaN(start.getTime())) return null
  return new Date(start.getTime() + EVALUATION_WINDOW_DAYS * 86400000)
}

/**
 * Estado de la ventana de este grupo.
 *
 * El borde es inclusivo: justo en el instante del vencimiento todavía se
 * acepta. Redondear en contra de quien está contestando no aporta nada.
 */
export function evaluationWindowStatus(input: {
  requestedAt: string | null | undefined
  now?: Date
}): EvaluationWindowStatus {
  const end = evaluationWindowEnd(input.requestedAt)
  if (!end) return 'sin_solicitar'
  const now = input.now ?? new Date()
  return now.getTime() <= end.getTime() ? 'abierta' : 'cerrada'
}

/** Días completos que quedan para contestar. 0 si ya cerró o nunca abrió. */
export function evaluationDaysLeft(requestedAt: string | null | undefined, now: Date = new Date()): number {
  const end = evaluationWindowEnd(requestedAt)
  if (!end) return 0
  const ms = end.getTime() - now.getTime()
  return ms <= 0 ? 0 : Math.ceil(ms / 86400000)
}

/** Mensaje para el estudiante que llegó tarde. Sin culpar a nadie. */
export const EVALUATION_WINDOW_CLOSED_MESSAGE =
  'El período para evaluar este grupo ya cerró. Si necesitás dejar un comentario, escribile a la coordinación de dirigentes.'

/**
 * ¿Se puede dar por cerrado el tiquete?
 *
 * Solo con la ventana vencida: mientras siga abierta pueden entrar respuestas
 * que cambien el compilado, y resolver antes sería revisar un número que
 * todavía se mueve.
 */
export function ticketClosable(input: {
  requestedAt: string | null | undefined
  now?: Date
}): boolean {
  return evaluationWindowStatus(input) === 'cerrada'
}
