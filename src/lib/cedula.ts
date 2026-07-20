// Validación y normalización de cédula (identificación) para miembros.
// Compartido por UI y server para que ambos apliquen la MISMA regla.
//
// Formatos aceptados (personas físicas en Costa Rica):
//   · Nacional: 9 dígitos (ej. 1-1234-5678 → "112345678").
//   · DIMEX/residencia: 11 o 12 dígitos.
// La normalización quita guiones y espacios; la columna generada
// members.cedula_normalized hace lo mismo en la BD (regexp_replace [-\s]).

/** Quita guiones y espacios; deja solo el contenido para comparar/guardar. */
export function normalizeCedula(raw: string): string {
  return raw.replace(/[-\s]/g, '').trim()
}

/** ¿La cédula tiene un formato válido? Normaliza y exige solo dígitos con una
 *  longitud de persona física (9 nacional, 11-12 DIMEX). */
export function isValidCedula(raw: string | null | undefined): boolean {
  if (!raw) return false
  const n = normalizeCedula(raw)
  return /^\d{9}$/.test(n) || /^\d{11,12}$/.test(n)
}

/** Mensaje de error estándar para UI/server cuando el formato no es válido. */
export const CEDULA_FORMAT_MESSAGE =
  'Cédula inválida: debe tener 9 dígitos (nacional) u 11-12 (DIMEX), solo números.'

/** Códigos de plan de estudio que EXIGEN cédula para inscribirse (trámite que
 *  la requiere). El gate es bloqueante en server (enrollMember) y UX (matrícula). */
export const REQUIRES_CEDULA_CODES = new Set(['PREMAT'])
