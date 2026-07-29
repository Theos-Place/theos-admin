// PRE-7: validación de género de la pareja del curso prematrimonial (regla
// pura, compartida por spouse-search, el POST y testeable). Solo se realizan
// matrimonios entre hombre y mujer; el caso "mismo género" se trata como
// ERROR DE SELECCIÓN o de dato (el mensaje pide verificar, no juzga).

export type GenderCheckResult =
  | { ok: true }
  /** A alguno de los dos le falta el género en el perfil (o tiene un valor
   *  fuera de M/F): se pide completar/corregir el dato, NO se trata como
   *  "mismo género". */
  | { ok: false; code: 'genero_faltante'; who: 'requester' | 'spouse' | 'both' }
  | { ok: false; code: 'mismo_genero' }

function normalized(g: string | null | undefined): 'M' | 'F' | null {
  const v = (g ?? '').trim().toUpperCase()
  return v === 'M' || v === 'F' ? v : null
}

export function checkCoupleGender(
  requesterGender: string | null | undefined,
  spouseGender: string | null | undefined,
): GenderCheckResult {
  const r = normalized(requesterGender)
  const s = normalized(spouseGender)
  if (!r || !s) {
    return { ok: false, code: 'genero_faltante', who: !r && !s ? 'both' : !r ? 'requester' : 'spouse' }
  }
  if (r === s) return { ok: false, code: 'mismo_genero' }
  return { ok: true }
}

export const SAME_GENDER_MESSAGE =
  'La persona seleccionada tiene el mismo género registrado. Verificá que seleccionaste a la persona correcta; si el género en el perfil está incorrecto, contactá al equipo para corregirlo.'

export function missingGenderMessage(who: 'requester' | 'spouse' | 'both'): string {
  const quien = who === 'both' ? 'Ambos perfiles no tienen' : who === 'requester' ? 'El perfil de quien se inscribe no tiene' : 'El perfil de la pareja no tiene'
  return `${quien} el género registrado. Completá ese dato en el perfil antes de continuar.`
}
