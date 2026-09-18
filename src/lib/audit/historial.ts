/**
 * AUD-2 · Traducir una fila de `audit_log` a algo que una persona pueda leer.
 *
 * EL CASO QUE LO PIDIÓ. Preguntaron quién había movido a Pamela Fonseca entre
 * dos grupos de SCJ y cuándo. El dato estaba en la base y llegar a él necesitó
 * escribir un script: no había ninguna pantalla donde ver qué le pasó a una
 * persona, a un pago o a una matrícula.
 *
 * Lo que el trigger guarda es correcto pero ilegible: en un UPDATE deja solo lo
 * que cambió —`old: {"grade":"A"} new: {"grade":"B"}`— y en un INSERT o un
 * DELETE, la fila entera. Este módulo decide QUÉ vale la pena mostrar y CÓMO.
 *
 * Es puro: recibe el JSON y devuelve texto. El caller resuelve el nombre de
 * quien hizo el cambio, que vive en otra tabla.
 */
import { fechaCR } from '@/lib/fecha-cr'
import { formatCRC } from '@/lib/format'

export type AccionAuditada = 'INSERT' | 'UPDATE' | 'DELETE' | 'ROLE_CHANGE' | 'MERGE' | 'EXPORT' | 'APPROVE' | string

export type FilaDeAuditoria = {
  id: string
  action: AccionAuditada
  entity_type: string
  created_at: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  /** Nombre de quien lo hizo, ya resuelto. null = no quedó registrado. */
  actor_nombre: string | null
}

/** `antes`/`despues` en cadena vacía significan "no aplica": en una creación no
 *  hay un antes y en un borrado no hay un después. Decir "vacío" ahí sería
 *  afirmar que el campo estaba en blanco, que no es lo mismo. */
export type CambioLegible = { campo: string; etiqueta: string; antes: string; despues: string }

export type EntradaDeHistorial = {
  id: string
  cuando: string
  /** "Ana Mora" o null. La pantalla dice "el sistema" cuando es null. */
  quien: string | null
  /** "Modificó", "Creó"… */
  queHizo: string
  cambios: CambioLegible[]
  /** Un UPDATE anterior al 2026-09-16: se sabe que hubo un cambio pero no cuál
   *  (ver SIN_DETALLE). La pantalla lo dice en vez de listar campos. */
  sinDetalle?: true
}

/** Nombres de las cosas a las que apunta un uuid: `group_id` → "Nivel 3 —
 *  Daniella". Lo arma el caller consultando las tablas; acá solo se usa. */
export type NombresDeReferencias = ReadonlyMap<string, string>

/**
 * Campos que NUNCA se muestran.
 *
 * No es por ocultar: es que son derivados o de mantenimiento y ensucian el
 * historial hasta volverlo inútil. `sede_last_checkin` sola son 19.239 de las
 * filas de `members` del último mes —la recalcula un cron cada noche— y entre
 * ella y `search_text` tapan los cambios que sí hizo una persona.
 */
const RUIDO = new Set([
  'search_text', 'cedula_normalized', 'updated_at', 'sede_last_checkin',
  'sede_case', 'last_sign_in_at', 'id',
  // La entrada ya lleva su propia fecha arriba; repetirla como campo solo
  // ocupa una línea en cada creación.
  'created_at',
  // Tokens y rutas internas: cambian solos y su valor no le dice nada a nadie.
  'smart_link_token', 'unsubscribe_token', 'field_updated_at',
])

/** Nombre de columna → cómo se dice. Lo que no esté acá se muestra tal cual,
 *  con los guiones bajos cambiados por espacios: es mejor que esconderlo. */
const ETIQUETAS: Record<string, string> = {
  // members
  first_name: 'Nombre', last_name: 'Apellidos', email: 'Correo', phone: 'Teléfono',
  cedula: 'Documento', document_type: 'Tipo de documento', birth_date: 'Fecha de nacimiento',
  gender: 'Género', marital_status: 'Estado civil', address: 'Dirección',
  is_active: 'Activo', deactivated_at: 'Fecha de baja', deactivation_reason: 'Motivo de la baja',
  is_donor: 'Donante', sede_id: 'Sede', auth_user_id: 'Cuenta de acceso',
  account_confirmed_at: 'Cuenta confirmada', email_bounced: 'Correo rebotado',
  external_id: 'Id de CCB', datos_protegidos: 'Datos protegidos',
  email_bounced_at: 'Fecha del rebote', emergency_contact_phone: 'Teléfono de emergencia',
  notes: 'Notas',
  // payments
  amount: 'Monto', status: 'Estado', review_status: 'Revisión', payment_method: 'Método',
  payment_date: 'Fecha de pago', paid_at: 'Pagado el', reviewed_at: 'Revisado el',
  reviewed_by: 'Revisado por', reference_code: 'Referencia', receipt_path: 'Comprobante',
  description: 'Descripción', scholarship_id: 'Beca', enrollment_id: 'Matrícula',
  category_id: 'Categoría', recorded_by: 'Registrado por',
  // study_enrollments
  group_id: 'Grupo', plan_id: 'Estudio', member_id: 'Persona', grade: 'Nota',
  enrolled_at: 'Matriculado el', completed_at: 'Completado el', dropped_at: 'Dado de baja el',
  drop_reason: 'Motivo de la baja', transferred_to: 'Transferido a', resultado: 'Resultado',
  motivo: 'Motivo', es_externo: 'Externo', fuente_externa: 'Origen externo',
  // member_roles (ROLE_CHANGE)
  role: 'Rol', op: 'Operación', position_id: 'Puesto',
}

export function etiquetaDe(campo: string): string {
  return ETIQUETAS[campo] ?? campo.replace(/_/g, ' ')
}

const ACCIONES: Record<string, string> = {
  INSERT: 'Creó', UPDATE: 'Modificó', DELETE: 'Eliminó',
  ROLE_CHANGE: 'Cambió los roles', MERGE: 'Fusionó fichas',
  EXPORT: 'Exportó', APPROVE: 'Aprobó',
}

export function textoDeLaAccion(action: AccionAuditada): string {
  return ACCIONES[action] ?? action
}

const CAMPOS_DE_FECHA = /_(at|date)$|^birth_date$/
const CAMPOS_DE_PLATA = new Set(['amount'])

/**
 * Campos que guardan una ruta o un identificador largo: interesa SI HAY o no,
 * no el valor. Mostrar
 * "cdfc1da3-…/1276213a-….jpg" ocupa tres líneas y no se lee.
 */
const CAMPOS_DE_PRESENCIA = new Set(['receipt_path', 'flyer_url', 'avatar_url'])

/**
 * Los estados que la base guarda en inglés o con guiones bajos. Se traducen
 * porque el historial lo lee gente que no programa: "pendiente_de_pago" en una
 * línea que ya es densa se convierte en ruido.
 */
const ESTADOS: Record<string, string> = {
  enrolled: 'Matriculado', completed: 'Completado', dropped: 'Dado de baja',
  transferred: 'Transferido', pendiente_de_pago: 'Pendiente de pago',
  en_revision: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado',
  pending: 'Pendiente', paid: 'Pagado', cancelled: 'Cancelado', refunded: 'Devuelto',
  active: 'Activa', used: 'Usada', revoked: 'Cancelada', expired: 'Vencida',
}
const CAMPOS_DE_ESTADO = new Set(['status', 'review_status', 'payment_status'])

/** Un valor suelto, como se muestra. Vacío se dice "vacío" y no se deja en
 *  blanco: una celda en blanco no distingue "se borró" de "no cambió". */
export function valorLegible(campo: string, valor: unknown, nombres?: NombresDeReferencias): string {
  if (valor === null || valor === undefined || valor === '') return 'vacío'
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  // formatCRC y no un template propio: es la fuente única del repo y ya sabe
  // que es-CR separa los miles con espacio, no con punto.
  if (CAMPOS_DE_PLATA.has(campo) && typeof valor === 'number') return formatCRC(valor)
  if (CAMPOS_DE_PRESENCIA.has(campo)) return 'adjunto'
  if (typeof valor === 'string') {
    if (CAMPOS_DE_ESTADO.has(campo)) return ESTADOS[valor] ?? valor
    if (CAMPOS_DE_FECHA.test(campo)) return fechaCR(valor, 'corta') || valor
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)) {
      // Con nombre, el nombre. "Grupo #1a9acbce → #b89a3066" no le contesta a
      // nadie de qué grupo a qué grupo, que es LA pregunta que pidió esta
      // pantalla; "Grupo Nivel 2 Marta → Nivel 3 Daniella" sí.
      const nombre = nombres?.get(valor)
      if (nombre) return nombre
      // Sin nombre se recorta: sirve para distinguir dos uuids entre sí sin
      // pretender que alguien los lea.
      return `#${valor.slice(0, 8)}`
    }
    return valor
  }
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor)
}

/**
 * Los cambios de una fila, ya legibles.
 *
 * En un UPDATE se comparan las dos caras. En un INSERT o un DELETE hay una
 * sola: se muestran los campos que traen algo, porque una lista de veinte
 * "vacío → vacío" no informa de nada.
 */
export function cambiosLegibles(
  old_data: Record<string, unknown> | null, new_data: Record<string, unknown> | null,
  nombres?: NombresDeReferencias,
): CambioLegible[] {
  const campos = [...new Set([...Object.keys(old_data ?? {}), ...Object.keys(new_data ?? {})])]
    .filter(c => !RUIDO.has(c))
    .sort((a, b) => etiquetaDe(a).localeCompare(etiquetaDe(b), 'es'))

  const out: CambioLegible[] = []
  for (const campo of campos) {
    const antes = old_data?.[campo]
    const despues = new_data?.[campo]
    // El trigger ya acota los UPDATE a lo que cambió, pero un INSERT trae la
    // fila entera: los nulos de ahí no son un cambio, son columnas vacías.
    const hayAlgo = (antes ?? null) !== null || (despues ?? null) !== null
    if (!hayAlgo) continue
    out.push({
      campo,
      etiqueta: etiquetaDe(campo),
      antes: valorLegible(campo, antes, nombres),
      despues: valorLegible(campo, despues, nombres),
    })
  }
  return out
}

/**
 * De la fila cruda a la entrada de la pantalla, o `null` si no vale la pena
 * mostrarla.
 *
 * Se descartan las entradas cuyo único cambio es ruido. Si no, el historial de
 * cualquier persona son cincuenta líneas de "Modificó" sin nada adentro, todas
 * del cron de sedes, y el cambio que se está buscando queda enterrado.
 */
export function aEntradaDeHistorial(
  fila: FilaDeAuditoria, nombres?: NombresDeReferencias,
): EntradaDeHistorial | null {
  const base = {
    id: fila.id,
    cuando: fila.created_at,
    quien: fila.actor_nombre,
    queHizo: textoDeLaAccion(fila.action),
  }

  /**
   * UN UPDATE VIEJO NO SABE QUÉ CAMBIÓ, y hay que decirlo en vez de inventarlo.
   *
   * Hasta el 2026-09-15 el trigger no guardaba `old_data` y volcaba la fila
   * ENTERA en `new_data` —medido: 44 claves de promedio y `old_data` nulo en
   * 12.277 de 12.288 UPDATE—. Renderizar eso como "Correo vacío → ana@x.com"
   * es afirmar que el correo estaba vacío, y no es cierto: simplemente no se
   * registró. Desde el 16 de setiembre son 1 clave de promedio y con su antes.
   */
  if (fila.action === 'UPDATE' && fila.old_data === null) {
    return { ...base, cambios: [], sinDetalle: true }
  }

  const crudos = cambiosLegibles(fila.old_data, fila.new_data, nombres)
  // En una creación no hay "antes" y en un borrado no hay "después": se vacían
  // en vez de mostrar "vacío → Ana", que se lee como si el nombre hubiera
  // estado en blanco antes de existir la ficha.
  const cambios = fila.action === 'INSERT' ? crudos.map(c => ({ ...c, antes: '' }))
    : fila.action === 'DELETE' ? crudos.map(c => ({ ...c, despues: '' }))
    : crudos
  // Un DELETE sin datos sigue siendo información: se borró algo y hay que
  // decirlo. Un UPDATE sin cambios visibles, no.
  if (!cambios.length && fila.action === 'UPDATE') return null
  return { ...base, cambios }
}

export function historialLegible(
  filas: readonly FilaDeAuditoria[], nombres?: NombresDeReferencias,
): EntradaDeHistorial[] {
  return filas
    .map(f => aEntradaDeHistorial(f, nombres))
    .filter((e): e is EntradaDeHistorial => e !== null)
}

/** Lo que se muestra en una entrada sin detalle del "antes". */
export const SIN_DETALLE = 'Se registró un cambio, pero de esta fecha no quedó guardado cuál.'

/** Campos cuyo valor es un uuid que apunta a algo con nombre. El caller los usa
 *  para saber qué buscar; acá viven porque es donde se decide cómo se muestran. */
export const REFERENCIAS: Record<string, 'study_groups' | 'study_plans' | 'members' | 'areas'> = {
  group_id: 'study_groups',
  transferred_to: 'study_groups',
  study_group_id: 'study_groups',
  plan_id: 'study_plans',
  member_id: 'members',
  sede_id: 'areas',
}

/** Lo que se muestra cuando el cambio no tiene autor. Pasa con los crons y con
 *  todo lo anterior al 2026-09-18, que es cuando el actor empezó a guardarse
 *  de verdad. */
export const SIN_ACTOR = 'el sistema'
