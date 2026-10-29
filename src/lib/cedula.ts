// Validación y normalización de cédula (identificación) para miembros.
// Compartido por UI y server para que ambos apliquen la MISMA regla.
//
// Formatos aceptados (personas físicas en Costa Rica):
//   · Nacional: 9 dígitos (ej. 1-1234-5678 → "112345678").
//   · DIMEX/residencia: 11 o 12 dígitos.
// La normalización quita guiones y espacios; la columna generada
// members.cedula_normalized hace lo mismo en la BD (regexp_replace [-\s]).

/** Quita guiones y espacios; deja solo el contenido para comparar/guardar.
 *  Los puntos NO: la columna generada de BD solo quita [-\s], y un documento
 *  «otro» con puntos tiene que compararse igual acá y allá. La cédula CR con
 *  puntos la resuelve `canonicalCedulaCR`, que es lo que se guarda. */
export function normalizeCedula(raw: string): string {
  return raw.replace(/[-\s]/g, '').trim()
}

/**
 * La cédula nacional como se guarda: 9 dígitos. Acepta la forma con cero
 * adelante («0-1234-5678», 10 dígitos, como la imprimen algunos documentos y
 * sistemas) y le quita el cero para que el dedup por `cedula_normalized`
 * encuentre a la misma persona escrita de las dos maneras. Lo que no es
 * cédula nacional (DIMEX, documentos de otro tipo) se devuelve normalizado.
 */
export function canonicalCedulaCR(raw: string): string {
  // Puntos y barras también (2026-10-29): «1.1234.5678» tiene sus 9 dígitos
  // y se rechazaba por los puntos.
  const n = raw.replace(/[-\s./]/g, '').trim()
  return /^0\d{9}$/.test(n) ? n.slice(1) : n
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

export function documentFormatMessage(type: DocumentType, raw?: string | null): string {
  if (type === 'cedula') return mensajeDeCedulaInvalida(raw)
  if (type === 'dni_nie') return 'El DNI/NIE no tiene un formato válido (8 dígitos y letra; NIE inicia con X, Y o Z).'
  return 'El documento debe tener entre 5 y 20 letras/números.'
}

/** ¿La cédula tiene un formato válido? Normaliza y exige solo dígitos con una
 *  longitud de persona física (9 nacional, 11-12 DIMEX). */
export function isValidCedula(raw: string | null | undefined): boolean {
  if (!raw) return false
  const n = canonicalCedulaCR(raw)
  return /^\d{9}$/.test(n) || /^\d{11,12}$/.test(n)
}

/** Mensaje de error estándar para UI/server cuando el formato no es válido. */
export const CEDULA_FORMAT_MESSAGE =
  'Cédula inválida: debe tener 9 dígitos (nacional) u 11-12 (DIMEX), solo números.'

/**
 * El mismo mensaje, diciendo QUÉ se recibió. «Debe tener 9 dígitos» cuando
 * la persona ve 9 dígitos en pantalla no explica nada (Estudios, 2026-10-29):
 * lo que sobra es una letra, un punto raro o un dígito de más, y hay que
 * mostrárselo.
 */
export function mensajeDeCedulaInvalida(raw: string | null | undefined): string {
  const n = canonicalCedulaCR(raw ?? '')
  if (!n) return CEDULA_FORMAT_MESSAGE
  const digitos = (n.match(/\d/g) ?? []).length
  const otros = n.replace(/\d/g, '')
  const detalle = otros
    ? `Recibimos «${n}»: ${digitos} dígito${digitos === 1 ? '' : 's'} y además «${otros}», que no es un número.`
    : `Recibimos «${n}»: ${digitos} dígito${digitos === 1 ? '' : 's'}.`
  return `${CEDULA_FORMAT_MESSAGE} ${detalle}`
}

// FIN-2: ya no hay lista de planes que exigen documento — lo exige TODA
// matrícula (guard en enrollMember). La vieja REQUIRES_CEDULA_CODES (solo
// PREMAT) se eliminó junto con su test.
