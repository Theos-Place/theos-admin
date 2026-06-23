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

// 'bienvenida' y 'recuperacion_contrasena' las maneja Supabase Auth, no acá.
export type SystemTemplateKey =
  | 'form_asignado' | 'form_completado'
  | 'matricula_estudiante' | 'matricula_dirigente' | 'inicio_capacitacion'

/** Valor de variable: texto simple, o una lista de objetos para secciones {{#lista}}. */
export type TemplateData = Record<string, string | number | null | undefined | Array<Record<string, string | number | null | undefined>>>

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Render tipo Mustache mínimo:
 *  · Secciones {{#lista}}...{{/lista}} → itera si `lista` es un array de objetos;
 *    dentro, {{campo}} se reemplaza por cada item. Si no es array, se omite.
 *  · Variables simples {{var}} → valor escapado (vacío si no existe).
 */
export function renderTemplate(html: string, data: TemplateData): string {
  // 1) Secciones (listas) primero.
  let out = html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_full, key: string, inner: string) => {
    const arr = data[key]
    if (!Array.isArray(arr)) return ''
    return arr.map(item =>
      inner.replace(/\{\{(\w+)\}\}/g, (_m, f: string) => escapeHtml(String(item?.[f] ?? ''))),
    ).join('')
  })
  // 2) Variables simples.
  out = out.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => {
    const v = data[k]
    if (Array.isArray(v) || v == null) return ''
    return escapeHtml(String(v))
  })
  return out
}

/** Fallback mínimo si la plantilla no está en la BD (nunca debería pasar: son
 *  no borrables, pero por si la BD no está inicializada). */
const FALLBACK: Record<string, { subject: string; html: string }> = {
  form_asignado: { subject: 'Tenés un formulario pendiente', html: '<p>Hola {{nombre}}, te asignaron el formulario "{{nombre_form}}". <a href="{{link_form}}">Completarlo</a>.</p>' },
  form_completado: { subject: 'Recibimos tus respuestas', html: '<p>Hola {{nombre}}, recibimos tus respuestas del formulario "{{nombre_form}}".</p>' },
  matricula_estudiante: { subject: 'Tu matrícula fue confirmada', html: '<p>Hola {{nombre}}, tu matrícula en "{{nombre_capacitacion}}" fue confirmada. Inicia el {{fecha_inicio}}.</p>' },
  matricula_dirigente: { subject: 'Nuevo estudiante en tu capacitación', html: '<p>Hola {{nombre_dirigente}}, {{nombre_estudiante}} se matriculó en "{{nombre_capacitacion}}".</p>' },
  inicio_capacitacion: { subject: 'Tu capacitación está por comenzar', html: '<p>Hola {{nombre}}, tu capacitación "{{nombre_capacitacion}}" inicia el {{fecha_inicio}}.</p>' },
}

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
  fromName?: string
}): Promise<{ ok: boolean }> {
  try {
    const tpl = await getSystemTemplate(opts.systemKey)
    const subject = renderTemplate(tpl.subject, opts.data)
    // El html_body es SOLO el contenido; se envuelve con el layout base (head+
    // header+footer) para producir el correo completo.
    const html = renderEmail(renderTemplate(tpl.html, opts.data))
    await sendEmail({ to: opts.to, subject, html, kind: 'transactional', fromName: opts.fromName })
    return { ok: true }
  } catch (e) {
    console.warn('sendSystemEmail:', opts.systemKey, e)
    return { ok: false }
  }
}
