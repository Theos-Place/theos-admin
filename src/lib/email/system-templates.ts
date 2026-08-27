/**
 * Plantillas del SISTEMA (transaccionales): el código las busca por system_key,
 * reemplaza las variables {{...}} y las envía con sendEmail (kind 'transactional'
 * → sin pie de baja ni check de opt-out).
 *
 * Solo server-side (usa service role + nodemailer vía sendEmail).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/provider'
import { renderEmail } from '@/lib/email/baseLayout'
import { renderTemplate, renderTemplateWithHtml, type TemplateData } from '@/lib/email/render-vars'
import { FALLBACK } from '@/lib/email/system-template-fallbacks'

export { FALLBACK }

export type { TemplateData }

// 'bienvenida' y 'recuperacion_contrasena' las maneja Supabase Auth, no acá.
export type SystemTemplateKey =
  | 'form_asignado' | 'form_completado'
  | 'matricula_estudiante' | 'matricula_dirigente' | 'inicio_capacitacion'
  | 'beca_aprobada' | 'beca_aprobada_parcial' | 'beca_rechazada'
  | 'cupon_asignado'
  | 'encuesta_evento' | 'inscripcion_evento'
  | 'retro_dirigente' | 'retro_dirigente_resumen'
  | 'solicitud_asignada'
  | 'cumpleanos'
  | 'cierre_pendiente' | 'cierre_vencido'

/** Fallback mínimo si la plantilla no está en la BD (nunca debería pasar: son
 *  no borrables, pero por si la BD no está inicializada). */

/** Devuelve {subject, html} de la plantilla del sistema (BD; fallback embebido). */
export async function getSystemTemplate(systemKey: SystemTemplateKey): Promise<{ subject: string; html: string }> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('message_templates')
      .select('subject, body')
      .eq('system_key', systemKey)
      .eq('is_active', true)
      .maybeSingle()
    if (data?.body) return { subject: data.subject ?? FALLBACK[systemKey]?.subject ?? 'Theos Place', html: data.body }
  } catch (e) {
    console.warn('getSystemTemplate:', systemKey, e)
  }
  return FALLBACK[systemKey] ?? { subject: 'Theos Place', html: '<p>{{nombre}}</p>' }
}

/**
 * Envía un correo del sistema (transaccional): busca la plantilla por system_key,
 * renderiza asunto + cuerpo con `data` y envía. Best-effort: loguea y no lanza,
 * para no romper el flujo de negocio si el correo falla.
 */
export async function sendSystemEmail(opts: {
  systemKey: SystemTemplateKey
  to: { email: string; name?: string }
  data: TemplateData
  /** Marcadores cuyo valor YA es HTML del sistema (tablas, listas): NO se escapa.
   *  Nunca meter acá texto escrito por una persona sin escapar antes. */
  rawData?: Record<string, string>
  fromName?: string
}): Promise<{ ok: boolean }> {
  try {
    const tpl = await getSystemTemplate(opts.systemKey)
    const subject = renderTemplate(tpl.subject, opts.data)
    // El html_body es SOLO el contenido; se envuelve con el layout base (head+
    // header+footer) para producir el correo completo.
    const cuerpo = opts.rawData
      ? renderTemplateWithHtml(tpl.html, opts.data, opts.rawData)
      : renderTemplate(tpl.html, opts.data)
    const html = renderEmail(cuerpo)
    await sendEmail({ to: opts.to, subject, html, kind: 'transactional', fromName: opts.fromName })
    return { ok: true }
  } catch (e) {
    console.warn('sendSystemEmail:', opts.systemKey, e)
    return { ok: false }
  }
}
