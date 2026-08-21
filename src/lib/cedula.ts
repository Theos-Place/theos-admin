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

// ── INT-1: documento de identidad por tipo (internacionalización) ─────────────
// members.document_type indica el tipo; members.cedula guarda el NÚMERO (la
// columna generada cedula_normalized lo normaliza para dedup en cualquier tipo).

export const DOCUMENT_TYPES = ['cedula', 'dni_nie', 'pasaporte', 'otro'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  cedula: 'Cédula (Costa Rica)',
  dni_nie: 'DNI / NIE (España)',
  pasaporte: 'Pasaporte',
  otro: 'Otro documento',
}

export function isDocumentType(v: string): v is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(v)
}

/** Validación por tipo. cedula = formato CR (9 u 11-12 dígitos); dni_nie =
 *  formato español (8 dígitos + letra, NIE con X/Y/Z inicial); pasaporte/otro =
 *  alfanumérico razonable (5-20 tras normalizar). Case-insensitive: el número
 *  se guarda en MAYÚSCULAS (ver rutas de members) para que el dedup por
 *  cedula_normalized no dependa del case. */
export function isValidDocument(type: DocumentType, raw: string | null | undefined): boolean {
  if (!raw) return false
  const n = normalizeCedula(raw).toUpperCase()
  if (type === 'cedula') return isValidCedula(raw)
  if (type === 'dni_nie') return /^[XYZ]?\d{7,8}[A-Z]$/.test(n)
  return /^[A-Z0-9]{5,20}$/.test(n)
}

export function documentFormatMessage(type: DocumentType): string {
  if (type === 'cedula') return CEDULA_FORMAT_MESSAGE
  if (type === 'dni_nie') return 'El DNI/NIE no tiene un formato válido (8 dígitos y letra; NIE inicia con X, Y o Z).'
  return 'El documento debe tener entre 5 y 20 letras/números.'
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

// FIN-2: ya no hay lista de planes que exigen documento — lo exige TODA
// matrícula (guard en enrollMember). La vieja REQUIRES_CEDULA_CODES (solo
// PREMAT) se eliminó junto con su test.
