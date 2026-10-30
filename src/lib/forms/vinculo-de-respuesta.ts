/**
 * FRM-9 (2026-10-29) · Respuestas sin ficha: a quién del padrón corresponden.
 *
 * Las 29 personas que se inscribieron a Matrimonios por el link público no
 * tienen ficha ligada, y 25 de ellas escribieron el MISMO correo que tiene su
 * ficha. El sistema propone el vínculo; alguien lo confirma con un toque.
 *
 * Confianza, en orden: correo exacto (normalizado) y, si no, nombre exacto.
 * Con cero o con más de un candidato no se propone nada: queda la búsqueda
 * manual (regla de AGENTS.md: match por nombre solo con EXACTAMENTE UNA ficha).
 */
import { normalizarNombre } from '@/lib/events/puerta-con-inscripcion'
import { canonicalCedulaCR } from '@/lib/cedula'

export type FichaCandidata = { id: string; first_name: string; last_name: string; email: string | null; cedula: string | null; phone?: string | null }
/** EVE-14: en orden de confianza — cédula, correo, teléfono, nombre. */
export type MotivoDelCandidato = 'cedula' | 'correo' | 'telefono' | 'nombre'
export type Candidato = { miembro: FichaCandidata; motivo: MotivoDelCandidato }

export function normalizarCorreo(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/** Los últimos 8 dígitos: en Costa Rica el número local, con o sin +506. */
export function normalizarTelefono(s: string | null | undefined): string {
  const d = (s ?? '').replace(/\D/g, '')
  return d.length >= 8 ? d.slice(-8) : ''
}

export function candidatoParaRespuesta(
  respuesta: { guest_name: string | null; guest_email: string | null; guest_cedula?: string | null; guest_phone?: string | null },
  fichas: ReadonlyArray<FichaCandidata>,
): Candidato | null {
  // EVE-14 · Cédula exacta manda sobre todo lo demás.
  const cedula = canonicalCedulaCR(respuesta.guest_cedula ?? '')
  if (cedula) {
    const porCedula = fichas.filter(f => f.cedula && canonicalCedulaCR(f.cedula) === cedula)
    if (porCedula.length === 1) return { miembro: porCedula[0], motivo: 'cedula' }
    if (porCedula.length > 1) return null
  }
  const correo = normalizarCorreo(respuesta.guest_email)
  if (correo) {
    const porCorreo = fichas.filter(f => normalizarCorreo(f.email) === correo)
    if (porCorreo.length === 1) return { miembro: porCorreo[0], motivo: 'correo' }
    if (porCorreo.length > 1) return null
  }
  const tel = normalizarTelefono(respuesta.guest_phone)
  if (tel) {
    const porTel = fichas.filter(f => normalizarTelefono(f.phone) === tel)
    if (porTel.length === 1) return { miembro: porTel[0], motivo: 'telefono' }
    if (porTel.length > 1) return null
  }
  const nombre = normalizarNombre(respuesta.guest_name)
  if (!nombre) return null
  const porNombre = fichas.filter(f => normalizarNombre(`${f.first_name} ${f.last_name}`) === nombre)
  return porNombre.length === 1 ? { miembro: porNombre[0], motivo: 'nombre' } : null
}

export const TEXTO_DEL_MOTIVO: Record<MotivoDelCandidato, string> = {
  cedula: 'misma cédula',
  correo: 'mismo correo',
  telefono: 'mismo teléfono',
  nombre: 'mismo nombre',
}

/**
 * EVE-14 · Nombre y apellidos a partir de lo que escribió en el link, para
 * crear la ficha. Es una PROPUESTA que la pantalla deja corregir: con dos
 * palabras, nombre y apellido; con tres, un nombre y dos apellidos; con
 * cuatro o más, los dos últimos son apellidos (el patrón de Costa Rica).
 */
export function nombreDesdeRespuesta(guestName: string | null | undefined): { first_name: string; last_name: string } {
  const partes = (guestName ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return { first_name: '', last_name: '' }
  if (partes.length === 1) return { first_name: partes[0], last_name: '' }
  if (partes.length === 2) return { first_name: partes[0], last_name: partes[1] }
  if (partes.length === 3) return { first_name: partes[0], last_name: partes.slice(1).join(' ') }
  return { first_name: partes.slice(0, -2).join(' '), last_name: partes.slice(-2).join(' ') }
}
