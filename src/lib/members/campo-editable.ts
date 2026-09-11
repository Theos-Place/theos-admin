/**
 * Qué campo de "tus datos personales" se puede editar EN SITIO, y en qué columna
 * de members se guarda.
 *
 * Los datos personales que muestra un formulario salen del catálogo
 * PERSONAL_DATA_FIELDS, cuyas claves no siempre son columnas: 'full_name' y
 * 'age' se calculan. Este módulo traduce clave → columna y dice cuáles se
 * pueden tocar, apoyándose en la misma lista que autoriza el servidor
 * (CAMPOS_AUTOEDITABLES) para que la pantalla no ofrezca editar algo que la API
 * después va a rechazar.
 */
import { CAMPOS_AUTOEDITABLES, CAMPOS_DE_DOCUMENTO } from './autoedicion'

export type TipoDeEntrada = 'texto' | 'telefono' | 'parrafo' | 'fecha' | 'seleccion'

/** Opciones del género, con las mismas etiquetas que el resto del sistema. */
export const OPCIONES_GENERO = [
  { valor: 'M', etiqueta: 'Masculino' },
  { valor: 'F', etiqueta: 'Femenino' },
  { valor: 'otro', etiqueta: 'No indica' },
] as const

/** Clave del catálogo → columna de members. Solo las que son editables. */
const COLUMNA_POR_CLAVE: Record<string, { columna: string; tipo: TipoDeEntrada }> = {
  // 'age' NO está: es un cálculo sobre la fecha de nacimiento, no una columna.
  // Se edita la fecha y la edad se recalcula sola.
  birth_date: { columna: 'birth_date', tipo: 'fecha' },
  gender: { columna: 'gender', tipo: 'seleccion' },
  phone: { columna: 'phone', tipo: 'telefono' },
  address: { columna: 'address', tipo: 'parrafo' },
  emergency_contact_name: { columna: 'emergency_contact_name', tipo: 'texto' },
  emergency_contact_phone: { columna: 'emergency_contact_phone', tipo: 'telefono' },
  occupation: { columna: 'occupation', tipo: 'texto' },
  workplace: { columna: 'workplace', tipo: 'texto' },
  allergies: { columna: 'allergies', tipo: 'parrafo' },
  medications: { columna: 'medications', tipo: 'parrafo' },
  cedula: { columna: 'cedula', tipo: 'texto' },
  // dietary_restrictions NO va acá: no es texto libre sino checkboxes con
  // validación propia, y el FormFiller lo pinta con su propio componente.
}

export type Editabilidad =
  | { editable: true; columna: string; tipo: TipoDeEntrada }
  | { editable: false; motivo: string | null }

/**
 * ¿Se puede editar este campo desde el formulario?
 *
 * `tieneDocumento` decide el caso de la cédula: completarla sí, cambiarla no.
 * Los campos que nadie edita en sitio (nombre, edad, correo…) devuelven
 * motivo null: no se les pinta un aviso, simplemente no llevan lápiz — un
 * cartel en cada uno sería ruido.
 */
export function editabilidadDeCampo(
  clave: string,
  opciones: { tieneDocumento: boolean },
): Editabilidad {
  const mapeo = COLUMNA_POR_CLAVE[clave]
  if (!mapeo) return { editable: false, motivo: null }

  if ((CAMPOS_DE_DOCUMENTO as readonly string[]).includes(mapeo.columna)) {
    return opciones.tieneDocumento
      ? { editable: false, motivo: 'Para corregir tu documento, pedilo en tu sede.' }
      : { editable: true, columna: mapeo.columna, tipo: mapeo.tipo }
  }

  // Coherencia con el servidor: si la columna no está autorizada allá, acá no se
  // ofrece. Sin esto la pantalla podría invitar a editar algo que da 403.
  if (!(CAMPOS_AUTOEDITABLES as readonly string[]).includes(mapeo.columna)) {
    return { editable: false, motivo: null }
  }
  return { editable: true, columna: mapeo.columna, tipo: mapeo.tipo }
}

/**
 * Qué valor mostrar en un campo editable en sitio.
 *
 * El bug que lo motiva (2026-09-11, caso Daniela Vindas): el campo guardaba el
 * apellido completo en la base y acto seguido volvía a pintar el apellido VIEJO,
 * porque lo que muestra es una prop del servidor que no se recarga. Desde
 * afuera se ve exactamente igual que si no hubiera guardado — y se reintenta,
 * y vuelve a "fallar".
 *
 * `guardado` es lo último que este campo escribió, junto con la prop que tenía
 * cuando lo escribió. Mientras la prop no se mueva, gana lo guardado; apenas el
 * servidor manda un valor nuevo (`desde` ya no calza), gana el servidor — así
 * un cambio hecho en otra pestaña no queda tapado por un eco viejo.
 */
export function valorAMostrar(
  delServidor: string,
  guardado: { desde: string; valor: string } | null,
): string {
  return guardado && guardado.desde === delServidor ? guardado.valor : delServidor
}
