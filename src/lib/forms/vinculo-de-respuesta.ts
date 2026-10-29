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

export type FichaCandidata = { id: string; first_name: string; last_name: string; email: string | null; cedula: string | null }
export type MotivoDelCandidato = 'correo' | 'nombre'
export type Candidato = { miembro: FichaCandidata; motivo: MotivoDelCandidato }

export function normalizarCorreo(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

export function candidatoParaRespuesta(
  respuesta: { guest_name: string | null; guest_email: string | null },
  fichas: ReadonlyArray<FichaCandidata>,
): Candidato | null {
  const correo = normalizarCorreo(respuesta.guest_email)
  if (correo) {
    const porCorreo = fichas.filter(f => normalizarCorreo(f.email) === correo)
    if (porCorreo.length === 1) return { miembro: porCorreo[0], motivo: 'correo' }
    if (porCorreo.length > 1) return null
  }
  const nombre = normalizarNombre(respuesta.guest_name)
  if (!nombre) return null
  const porNombre = fichas.filter(f => normalizarNombre(`${f.first_name} ${f.last_name}`) === nombre)
  return porNombre.length === 1 ? { miembro: porNombre[0], motivo: 'nombre' } : null
}

export const TEXTO_DEL_MOTIVO: Record<MotivoDelCandidato, string> = {
  correo: 'mismo correo',
  nombre: 'mismo nombre',
}
