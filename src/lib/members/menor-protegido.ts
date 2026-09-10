/**
 * Menores con datos protegidos.
 *
 * PARA QUÉ. En España no se puede pedir información protegida de un menor. Se
 * necesita poder registrar que el niño llegó a la actividad sin guardarle lo
 * que sí se guarda en Costa Rica.
 *
 * LA FORMA (decisión del usuario, 2026-09-10): en el alta desde el check-in
 * hay una casilla. Al marcarla, la ficha pide SOLO nombre y fecha de
 * nacimiento, y esos dos son obligatorios — la fecha porque sin ella no se
 * sabe que es menor, y el nombre porque hay que poder llamarlo.
 *
 * Y dos consecuencias que no son opcionales:
 *
 *   · NO se le crea cuenta de acceso. Nunca. Un menor con datos protegidos no
 *     tiene login, así que tampoco tiene correo que pedirle.
 *   · Su ficha queda LIGADA A SU FAMILIA — mamá, papá o el familiar que lo
 *     trajo. Una ficha de menor suelta, sin adulto detrás, es justo lo que no
 *     debe existir: nadie sabría a quién preguntarle por él.
 */

/** Lo ÚNICO que se guarda de un menor con datos protegidos. */
export const CAMPOS_MENOR_PROTEGIDO = ['first_name', 'last_name', 'birth_date'] as const

export type CampoMenorProtegido = typeof CAMPOS_MENOR_PROTEGIDO[number]

/** Campos que la ficha de un menor protegido NO puede llevar, ni vacíos.
 *  Se nombran para poder decir cuál llegó, en vez de descartarlo en silencio. */
const PROHIBIDOS = ['email', 'phone', 'cedula', 'document_type', 'address', 'allergies'] as const

export type Impedimento =
  | { code: 'falta_nombre'; mensaje: string }
  | { code: 'falta_fecha'; mensaje: string }
  | { code: 'fecha_invalida'; mensaje: string }
  | { code: 'no_es_menor'; mensaje: string }
  | { code: 'campo_prohibido'; mensaje: string; campos: string[] }
  | { code: 'sin_familia'; mensaje: string }

export function edadEnAnios(birthDate: string, hoy: Date): number {
  const [a, m, d] = birthDate.split('-').map(Number)
  let edad = hoy.getUTCFullYear() - a
  const mes = hoy.getUTCMonth() + 1 - m
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < d)) edad--
  return edad
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * `null` = se puede crear. Si no, qué falta y por qué.
 *
 * @param familiarId  la persona de la familia a la que se liga. Obligatoria:
 *   sin adulto detrás la ficha del menor queda huérfana.
 */
export function motivoQueImpideCrear(input: {
  datos: Record<string, unknown>
  familiarId: string | null | undefined
  hoy?: Date
}): Impedimento | null {
  const { datos, familiarId } = input
  const hoy = input.hoy ?? new Date()

  const sobran = Object.keys(datos).filter(
    k => (PROHIBIDOS as readonly string[]).includes(k) && datos[k] != null && datos[k] !== '',
  )
  if (sobran.length) {
    return {
      code: 'campo_prohibido',
      campos: sobran,
      mensaje: `De un menor con datos protegidos no se guarda ${sobran.join(', ')}. Solo el nombre y la fecha de nacimiento.`,
    }
  }

  const nombre = `${String(datos.first_name ?? '').trim()} ${String(datos.last_name ?? '').trim()}`.trim()
  if (!nombre) {
    return { code: 'falta_nombre', mensaje: 'El nombre es obligatorio: hay que poder llamarlo.' }
  }

  const fecha = String(datos.birth_date ?? '').trim()
  if (!fecha) {
    return {
      code: 'falta_fecha',
      mensaje: 'La fecha de nacimiento es obligatoria: sin ella no se sabe que es menor.',
    }
  }
  if (!FECHA.test(fecha)) {
    return { code: 'fecha_invalida', mensaje: 'La fecha de nacimiento no se entiende. Usá el formato del calendario.' }
  }
  const edad = edadEnAnios(fecha, hoy)
  if (edad < 0 || edad > 130) {
    return { code: 'fecha_invalida', mensaje: 'Esa fecha de nacimiento no puede ser.' }
  }
  if (edad >= 18) {
    return {
      code: 'no_es_menor',
      mensaje: `Esa fecha da ${edad} años. Esta casilla es solo para menores de edad; para una persona adulta usá el alta normal.`,
    }
  }

  if (!familiarId) {
    return {
      code: 'sin_familia',
      mensaje: 'Hay que decir con qué familiar viene. La ficha de un menor no puede quedar sola.',
    }
  }
  return null
}

/** Lo que de verdad se escribe. Nada más, aunque el cuerpo traiga más. */
export function fichaDeMenorProtegido(datos: Record<string, unknown>): {
  first_name: string; last_name: string; birth_date: string
  datos_protegidos: true; is_active: true
} {
  return {
    first_name: String(datos.first_name ?? '').trim(),
    last_name: String(datos.last_name ?? '').trim(),
    birth_date: String(datos.birth_date ?? '').trim(),
    datos_protegidos: true,
    is_active: true,
  }
}

/** ¿A esta ficha se le puede crear cuenta de acceso? Nunca a un menor
 *  protegido: no tiene correo, y no lo va a tener. */
export function puedeTenerCuenta(ficha: { datos_protegidos?: boolean | null }): boolean {
  return !ficha.datos_protegidos
}
