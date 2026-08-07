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

export type { TemplateData }

// 'bienvenida' y 'recuperacion_contrasena' las maneja Supabase Auth, no acá.
export type SystemTemplateKey =
  | 'form_asignado' | 'form_completado'
  | 'matricula_estudiante' | 'matricula_dirigente' | 'inicio_capacitacion'
  | 'beca_aprobada' | 'beca_aprobada_parcial' | 'beca_rechazada'
  | 'cupon_asignado'
  | 'encuesta_evento'
  | 'retro_dirigente' | 'retro_dirigente_resumen'

/** Fallback mínimo si la plantilla no está en la BD (nunca debería pasar: son
 *  no borrables, pero por si la BD no está inicializada). */
const FALLBACK: Record<string, { subject: string; html: string }> = {
  form_asignado: { subject: 'Tenés un formulario pendiente', html: '<p>Hola {{nombre}}, te asignaron el formulario "{{nombre_form}}". <a href="{{link_form}}">Completarlo</a>.</p>' },
  form_completado: { subject: 'Recibimos tus respuestas', html: '<p>Hola {{nombre}}, recibimos tus respuestas del formulario "{{nombre_form}}".</p>' },
  matricula_estudiante: { subject: 'Tu matrícula fue confirmada', html: '<p>Hola {{nombre}}, tu matrícula en "{{nombre_capacitacion}}" fue confirmada. Inicia el {{fecha_inicio}}.</p>' },
  matricula_dirigente: { subject: 'Nuevo estudiante en tu capacitación', html: '<p>Hola {{nombre_dirigente}}, {{nombre_estudiante}} se matriculó en "{{nombre_capacitacion}}".</p>' },
  inicio_capacitacion: { subject: 'Tu capacitación está por comenzar', html: '<p>Hola {{nombre}}, tu capacitación "{{nombre_capacitacion}}" inicia el {{fecha_inicio}}.</p>' },
  beca_aprobada: {
    subject: '¡Tu beca fue aprobada!',
    html: '<p>Hola {{nombre}},</p><p>¡Tenemos buenas noticias! Tu solicitud de beca para {{nombre_estudio_evento}} fue aprobada.</p><p>Se te asignó un descuento de {{descuento}} que podés aplicar al momento de hacer tu pago.</p>',
  },
  beca_aprobada_parcial: {
    subject: 'Novedades sobre tu solicitud de beca',
    html: '<p>Hola {{nombre}},</p><p>Revisamos tu solicitud de beca para {{nombre_estudio_evento}} y pudimos aprobarte un apoyo parcial.</p><p>Se te asignó un descuento de {{descuento}} que podés aplicar al momento de hacer tu pago.</p>',
  },
  beca_rechazada: {
    subject: 'Sobre tu solicitud de beca',
    html: '<p>Hola {{nombre}},</p><p>Gracias por tu solicitud de beca para {{nombre_estudio_evento}}. En esta ocasión no pudimos aprobarla.</p><p>Motivo: {{motivo_rechazo}}</p>',
  },
  // EVE-4: encuesta de satisfacción de un evento (destino = formulario).
  encuesta_evento: {
    subject: '¿Cómo te fue en {{nombre_evento}}?',
    html: '<p>Hola {{nombre}},</p><p>Gracias por acompañarnos en <strong>{{nombre_evento}}</strong>. Nos ayudaría mucho saber cómo te fue: es una encuesta corta.</p><p><a href="{{link_encuesta}}">Responder la encuesta</a></p>',
  },
  // Retroalimentación al dirigente: se le pide al ESTUDIANTE cuando cierra su grupo.
  retro_dirigente: {
    subject: '¿Cómo te fue en {{nombre_estudio}}?',
    html: '<p>Hola {{nombre}},</p><p>Terminaste <strong>{{nombre_estudio}}</strong> con {{nombre_dirigente}}. Nos ayudaría mucho saber cómo te fue: son dos preguntas y es anónimo para tu dirigente.</p><p><a href="{{link_encuesta}}">Responder</a></p>',
  },
  // EST-13: resumen agregado que recibe el dirigente. La cáscara es editable;
  // {{tablas}} y {{comentarios}} los genera leader-feedback-report.ts.
  retro_dirigente_resumen: {
    subject: 'Tu retroalimentación de {{nombre_estudio}}',
    html: '<p>Hola {{nombre}},</p><p>Recibimos {{cantidad}} evaluaciones de tu grupo de {{nombre_estudio}}.</p>{{tablas}}{{comentarios}}',
  },
  // BEC-1: cupón genérico enviado a una persona desde /finanzas/becas.
  cupon_asignado: {
    subject: 'Tenés un cupón de descuento',
    html: '<p>Hola {{nombre}},</p><p>Se te asignó un cupón de descuento para {{nombre_estudio_evento}}.</p><p>Código: <strong>{{codigo}}</strong> — descuento de {{descuento}}. Vence el {{vencimiento}}.</p><p>Usalo al momento de hacer tu pago.</p>',
  },
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
