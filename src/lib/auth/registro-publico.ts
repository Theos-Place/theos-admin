import { DOCUMENT_TYPES, documentFormatMessage, isDocumentType, isValidDocument, normalizeCedula, type DocumentType } from '@/lib/cedula'

/**
 * Registro público: alguien que NO está en el padrón se crea su ficha desde la
 * pantalla de ingreso.
 *
 * EL DOCUMENTO ES OBLIGATORIO, y no es un capricho del formulario: es la única
 * llave con la que se puede evitar que el padrón se llene de duplicados. La base
 * tiene un índice único por (document_type, cedula_normalized), así que la misma
 * cédula no puede entrar dos veces ni aunque la persona escriba otro nombre.
 *
 * LA DECISIÓN DE SEGURIDAD QUE MANDA SOBRE TODO LO DEMÁS. Si el documento YA
 * está en el padrón, no se crea nada y el enlace de acceso se manda al correo
 * QUE ESTÁ EN LA FICHA — nunca al que la persona acaba de escribir. Sin esa
 * regla, registrarse con la cédula de otro y un correo propio te entrega su
 * cuenta, con su historial de estudios y sus pagos. Es el único camino de
 * apropiación que abre esta pantalla, y se cierra acá.
 *
 * SOBRE DECIRLE QUE YA EXISTE (decisión del usuario, 2026-09-01). La primera
 * versión respondía siempre lo mismo para no convertir la pantalla en un
 * verificador de qué cédulas están registradas. Se cambió a decirlo de frente:
 * quien de verdad ya tiene cuenta necesita entender por qué no se creó nada, y
 * "revisá tu correo" lo dejaba adivinando.
 *
 * Lo que se dice es lo mínimo: que ya existe y que se mandó el enlace al correo
 * REGISTRADO. Nunca cuál es ese correo — eso sí sería filtrar el dato de otro.
 * El límite por intentos sigue siendo lo que evita que se use para tantear
 * cédulas en masa.
 *
 * EL ROL NO SE ESCRIBE. 'miembro' es el piso implícito de cualquier ficha
 * (withBaseRole en roles.ts): no hay fila que insertar en member_roles, y de
 * hecho insertarla sería peor —ver el comentario de withBaseRole—. Quien se
 * registra ve su perfil, su familia y el currículo, nada más.
 */

export type DatosDeRegistro = {
  first_name: string
  last_name: string
  document_type: string
  cedula: string
  email: string
  phone?: string | null
}

/** Campo → qué le falta. Vacío = los datos sirven. */
export function erroresDeRegistro(d: Partial<DatosDeRegistro>): Record<string, string> {
  const e: Record<string, string> = {}
  const nombre = (d.first_name ?? '').trim()
  const apellidos = (d.last_name ?? '').trim()
  if (nombre.length < 2) e.first_name = 'Escribí tu nombre.'
  if (apellidos.length < 2) e.last_name = 'Escribí tus apellidos.'

  const tipo = (d.document_type ?? '').trim()
  if (!isDocumentType(tipo)) e.document_type = 'Elegí el tipo de documento.'
  else if (!isValidDocument(tipo as DocumentType, d.cedula)) {
    e.cedula = documentFormatMessage(tipo as DocumentType)
  }

  const correo = (d.email ?? '').trim().toLowerCase()
  if (!correo) e.email = 'Escribí tu correo.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) e.email = 'Ese correo no tiene forma de correo.'
  else if (correo.length > 254) e.email = 'El correo es demasiado largo.'

  // El teléfono es opcional; si viene, que sea plausible y no un renglón entero.
  const tel = (d.phone ?? '').trim()
  if (tel && (tel.replace(/\D/g, '').length < 8 || tel.length > 20)) e.phone = 'Revisá el teléfono.'

  return e
}

export function registroEsValido(d: Partial<DatosDeRegistro>): boolean {
  return Object.keys(erroresDeRegistro(d)).length === 0
}

/** Los datos ya limpios, como se guardan. */
export function normalizarRegistro(d: DatosDeRegistro): {
  first_name: string; last_name: string; document_type: DocumentType
  cedula: string; email: string; phone: string | null
} {
  const tel = (d.phone ?? '').trim()
  return {
    first_name: d.first_name.trim().replace(/\s+/g, ' '),
    last_name: d.last_name.trim().replace(/\s+/g, ' '),
    document_type: d.document_type.trim() as DocumentType,
    cedula: normalizeCedula(d.cedula),
    email: d.email.trim().toLowerCase(),
    phone: tel || null,
  }
}

/**
 * Qué hacer con una solicitud de registro.
 *
 * `crear`     → nadie tiene ese documento: se crea la ficha y su cuenta.
 * `reenviar`  → ya existe. NO se crea nada y el enlace va al correo de la
 *               FICHA. Si esa ficha no tiene correo, no hay a dónde mandarlo y
 *               tiene que resolverlo el staff: mandarlo al correo escrito sería
 *               regalar la cuenta.
 */
export type PlanDeRegistro =
  | { accion: 'crear' }
  | { accion: 'reenviar'; memberId: string; correoDeLaFicha: string }
  | { accion: 'derivar_a_staff'; motivo: string }

export function planDeRegistro(input: {
  existente: { id: string; email: string | null } | null
}): PlanDeRegistro {
  const e = input.existente
  if (!e) return { accion: 'crear' }
  const correo = (e.email ?? '').trim()
  if (!correo) {
    return { accion: 'derivar_a_staff', motivo: 'La ficha existe pero no tiene correo registrado.' }
  }
  return { accion: 'reenviar', memberId: e.id, correoDeLaFicha: correo }
}

/** Cuenta creada. */
export const MENSAJE_REGISTRO_CREADO =
  'Listo. Te mandamos un correo con el paso a paso para definir tu contraseña. '
  + 'Revisá tu bandeja y la carpeta de spam.'

/** Ya existía: NO se creó nada y se mandó el enlace de recuperación. */
export const MENSAJE_YA_EXISTE =
  'Ya tenés una cuenta con esos datos, así que no creamos un perfil nuevo. '
  + 'Te mandamos al correo registrado el enlace para restablecer tu contraseña.'

/** Existe pero sin correo en la ficha: no hay a dónde mandar el enlace. */
export const MENSAJE_SIN_CORREO =
  'Ya tenés un perfil, pero no tiene un correo registrado, así que no podemos mandarte el enlace. '
  + 'Escribinos a soporte@theosplace.org y lo resolvemos.'

export { DOCUMENT_TYPES }
