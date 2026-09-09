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

export type TipoDeEntrada = 'texto' | 'telefono' | 'parrafo'

/** Clave del catálogo → columna de members. Solo las que son editables. */
const COLUMNA_POR_CLAVE: Record<string, { columna: string; tipo: TipoDeEntrada }> = {
  phone: { columna: 'phone', tipo: 'telefono' },
  address: { columna: 'address', tipo: 'parrafo' },
  emergency_contact_name: { columna: 'emergency_contact_name', tipo: 'texto' },
  emergency_contact_phone: { columna: 'emergency_contact_phone', tipo: 'telefono' },
  occupation: { columna: 'occupation', tipo: 'texto' },
  workplace: { columna: 'workplace', tipo: 'texto' },
  allergies: { columna: 'allergies', tipo: 'parrafo' },
  medications: { columna: 'medications', tipo: 'parrafo' },
  cedula: { columna: 'cedula', tipo: 'texto' },
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
