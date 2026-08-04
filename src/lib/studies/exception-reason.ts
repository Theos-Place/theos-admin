// La razón de una excepción de matrícula es OBLIGATORIA (2026-08-04).
//
// Una excepción salta compromisos —donante, servidor, asistencia, prerequisito,
// edad— sin dejar rastro de por qué. Es la decisión más discrecional del módulo
// de estudios, así que tiene que quedar justificada: la usa quien audita después
// y quien tiene que sostener la decisión si alguien pregunta.
//
// Regla única: la comparten la validación del formulario y el zod de la API, así
// que la pantalla nunca deja mandar algo que el servidor va a rechazar.

/** Suficiente para una frase real, corto para no exigir un ensayo. */
export const REASON_MIN = 10
export const REASON_MAX = 500

/** null = la razón sirve. Si no, el mensaje de qué le falta. */
export function validateExceptionReason(reason: string | null | undefined): string | null {
  const r = (reason ?? '').trim()
  if (r.length === 0) return 'Escribí la razón de la excepción.'
  if (r.length < REASON_MIN) {
    return `La razón es muy corta: contá en una frase por qué se hace la excepción (mínimo ${REASON_MIN} caracteres).`
  }
  if (r.length > REASON_MAX) return `La razón no puede pasar de ${REASON_MAX} caracteres.`
  return null
}

export function isValidExceptionReason(reason: string | null | undefined): boolean {
  return validateExceptionReason(reason) === null
}
