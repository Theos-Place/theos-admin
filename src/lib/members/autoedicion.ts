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
 *  · sede y todo lo administrativo o espiritual: no es un dato personal, es una
 *    decisión de la organización sobre la persona.
 */

/** Campos que la persona edita libremente en su ficha. */
export const CAMPOS_AUTOEDITABLES = [
  // Decisión del usuario 2026-09-10, que revierte la restricción inicial: la
  // gente corrige sus propios typos. OJO con la consecuencia y por eso queda
  // escrito: nombre, apellidos y fecha de nacimiento son tres de las llaves con
  // las que se detectan duplicados, así que un typo acá puede hacer que alguien
  // deje de emparejar con su propia ficha.
  'first_name', 'last_name', 'birth_date', 'gender',
  'phone',
  'province', 'canton', 'district', 'address',
  'allergies', 'medications',
  'dietary_restrictions',
  // FAM-3: la propia persona decide si su imagen se publica. Para un menor lo
  // marca quien gestiona su ficha o su familia desde el formulario, que es el
  // caso que el campo viene a cubrir.
  'autorizacion_imagen',
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

/** Mismo documento aunque esté escrito distinto: 1-1381-0347 y 113810347 son
 *  el mismo. Se comparan solo letras y números, en mayúsculas. */
function mismoDocumento(a: unknown, b: unknown): boolean {
  const limpio = (v: unknown) => String(v ?? '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase()
  return limpio(a) === limpio(b)
}

/**
 * Filtra un cuerpo de edición propia.
 *
 * `documentoActual` es el documento que la persona YA tiene registrado.
 *
 * SE RECHAZA CAMBIARLO, NO MANDARLO. Esa diferencia era un bug (reportado
 * 2026-09-21): el formulario manda SIEMPRE todos los campos, así que quien ya
 * tenía cédula recibía 403 al guardar cualquier cosa —el teléfono, la
 * dirección— porque el cuerpo incluía su propia cédula sin cambios. Andres
 * Aiello no podía tocar nada de su perfil. Ahora solo se rechaza si el valor
 * llega DISTINTO al que ya está.
 */
export function filtrarAutoedicion(
  cuerpo: unknown,
  documentoActual: string | null | undefined,
  tipoActual?: string | null,
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
      const actual = campo === 'cedula' ? documentoActual : tipoActual
      // Sin documento registrado se puede completar; con documento, solo se
      // rechaza si viene DISTINTO. Mandar el mismo no es cambiarlo.
      if (yaTieneDocumento && !mismoDocumento(valor, actual)) {
        rechazados.push({
          campo,
          motivo: 'Ya tenés un documento registrado. Para corregirlo, pedilo en tu sede o a soporte@theosplace.org.',
        })
      } else if (!yaTieneDocumento) {
        permitidos[campo] = valor
      }
      // Si es el mismo, no se rechaza ni se reescribe: no hay nada que guardar.
      continue
    }
    rechazados.push({ campo, motivo: mensajeDeCampoBloqueado(campo) })
  }
  return { permitidos, rechazados }
}

/**
 * ¿Se puede editar esta columna, y quién?
 *
 * Hay DOS permisos distintos y confundirlos es lo que produce lápices que no
 * hacen nada: el staff de padrón edita casi todo, y la persona edita un
 * subconjunto de su propia ficha. La pantalla tiene que preguntar por el caso
 * concreto —quién soy, de quién es la ficha— y no por "¿es editable?" en
 * abstracto.
 *
 * `tieneDocumento` importa solo para la cédula: la persona la COMPLETA si le
 * falta, pero no la cambia. El staff sí la cambia.
 */
export function puedeEditarColumna(
  columna: string,
  ctx: { esStaff: boolean; esPropia: boolean; tieneDocumento: boolean },
): boolean {
  if (ctx.esStaff) return CAMPOS_STAFF.includes(columna)
  if (!ctx.esPropia) return false
  if ((CAMPOS_DE_DOCUMENTO as readonly string[]).includes(columna)) return !ctx.tieneDocumento
  return (CAMPOS_AUTOEDITABLES as readonly string[]).includes(columna)
}

/** Lo que el staff de padrón puede tocar. Espejo de MEMBER_WRITE_FIELDS sin los
 *  flags de gestión, que no viven en esta pantalla. */
const CAMPOS_STAFF: readonly string[] = [
  ...CAMPOS_AUTOEDITABLES,
  ...CAMPOS_DE_DOCUMENTO,
  'email', 'marital_status',
]
