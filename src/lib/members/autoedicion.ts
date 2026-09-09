/**
 * Qué puede cambiar una persona de SU PROPIA ficha, sin pasar por staff.
 *
 * Hasta 2026-09-10 esto no era una lista de permitidos sino una de prohibidos:
 * la rama isSelf de PUT /api/members/[id] dejaba pasar todo MEMBER_WRITE_FIELDS
 * salvo is_donor e is_active. O sea que cualquiera podía cambiarse el correo
 * —que es su usuario de login y la llave de deduplicación—, el nombre y la fecha
 * de nacimiento. Se invierte: acá está lo que SÍ, y lo que no esté no pasa.
 *
 * QUÉ QUEDA AFUERA Y POR QUÉ:
 *  · correo: es la identidad con la que entra y la llave con la que se detectan
 *    duplicados. Cambiarlo necesita verificar que la dirección nueva es suya,
 *    y ese flujo no existe todavía.
 *  · nombre, apellidos, fecha de nacimiento: definen a la persona en el padrón
 *    y se usan para no duplicarla. Un error acá lo arregla staff.
 *  · sede y todo lo administrativo o espiritual: no es un dato personal, es una
 *    decisión de la organización sobre la persona.
 */

/** Campos que la persona edita libremente en su ficha. */
export const CAMPOS_AUTOEDITABLES = [
  'phone',
  'province', 'canton', 'district', 'address',
  'allergies', 'medications',
  'emergency_contact_name', 'emergency_contact_phone',
  'occupation', 'workplace',
] as const

/**
 * El documento se puede COMPLETAR pero no CAMBIAR.
 *
 * Completar el propio documento es justo lo que FIN-2 le pide a la gente, y
 * pedirle que espere a un encargado para eso frena una matrícula. Cambiar uno ya
 * registrado es otra cosa: es la llave con la que se evita duplicar a alguien, y
 * moverla sin control permite pisar la identidad de otra persona. Eso pasa por
 * staff, que es la regla que ya regía.
 */
export const CAMPOS_DE_DOCUMENTO = ['cedula', 'document_type'] as const

export type CampoAutoeditable = typeof CAMPOS_AUTOEDITABLES[number]

/** Mensaje para cada campo que la persona no puede tocar. Dice A QUIÉN pedirlo:
 *  un "no autorizado" pelado deja a alguien sin saber cómo seguir. */
const A_QUIEN_PEDIRLO: Record<string, string> = {
  email: 'El correo es tu usuario para entrar, así que no se cambia desde acá. Escribinos a soporte@theosplace.org.',
  first_name: 'El nombre y los apellidos los corrige el equipo de Theos. Pedilo en tu sede o a soporte@theosplace.org.',
  last_name: 'El nombre y los apellidos los corrige el equipo de Theos. Pedilo en tu sede o a soporte@theosplace.org.',
  birth_date: 'La fecha de nacimiento la corrige el equipo de Theos. Pedilo en tu sede o a soporte@theosplace.org.',
  sede_id: 'La sede la asigna el equipo de Theos.',
  is_active: 'Eso lo maneja el equipo de Theos.',
  is_donor: 'Eso lo maneja el equipo de Theos.',
}

export function mensajeDeCampoBloqueado(campo: string): string {
  return A_QUIEN_PEDIRLO[campo]
    ?? 'Ese dato lo maneja el equipo de Theos. Pedilo en tu sede o a soporte@theosplace.org.'
}

export type ResultadoAutoedicion = {
  /** Lo que sí se va a escribir. */
  permitidos: Record<string, unknown>
  /** Campos rechazados, con el motivo listo para mostrar. */
  rechazados: Array<{ campo: string; motivo: string }>
}

/**
 * Filtra un cuerpo de edición propia.
 *
 * `documentoActual` es el documento que la persona YA tiene registrado: si tiene
 * uno, los campos de documento se rechazan; si no tiene, se permiten.
 */
export function filtrarAutoedicion(
  cuerpo: unknown,
  documentoActual: string | null | undefined,
): ResultadoAutoedicion {
  const permitidos: Record<string, unknown> = {}
  const rechazados: Array<{ campo: string; motivo: string }> = []
  if (!cuerpo || typeof cuerpo !== 'object') return { permitidos, rechazados }

  const libres = new Set<string>(CAMPOS_AUTOEDITABLES)
  const documento = new Set<string>(CAMPOS_DE_DOCUMENTO)
  const yaTieneDocumento = !!(documentoActual && String(documentoActual).trim())

  for (const [campo, valor] of Object.entries(cuerpo as Record<string, unknown>)) {
    if (libres.has(campo)) { permitidos[campo] = valor; continue }
    if (documento.has(campo)) {
      if (yaTieneDocumento) {
        rechazados.push({
          campo,
          motivo: 'Ya tenés un documento registrado. Para corregirlo, pedilo en tu sede o a soporte@theosplace.org.',
        })
      } else {
        permitidos[campo] = valor
      }
      continue
    }
    rechazados.push({ campo, motivo: mensajeDeCampoBloqueado(campo) })
  }
  return { permitidos, rechazados }
}
