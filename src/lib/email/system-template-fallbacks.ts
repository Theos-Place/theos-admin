/**
 * Textos de respaldo de las plantillas del sistema. MÓDULO PURO a propósito:
 * system-templates.ts importa el cliente de Supabase, así que nada que solo
 * necesite los textos (tests, previsualización) podía tocarlos sin arrastrar
 * medio servidor.
 *
 * Son el respaldo mínimo si la plantilla no está en la BD. No debería pasar —
 * son no borrables — pero si pasa, el correo sale igual.
 */
export const FALLBACK: Record<string, { subject: string; html: string }> = {
  cierre_vencido: { subject: '{{nombre_estudio}} ya terminó y falta el cierre', html: '<p>Hola {{nombre}}, {{nombre_grupo}} terminó el {{fecha_fin}} y sigue abierto. <a href="{{link_cierre}}">Hacer el cierre</a>.</p>' },
  cierre_pendiente: { subject: 'Te toca cerrar {{nombre_estudio}}', html: '<p>Hola {{nombre}}, tu grupo de {{nombre_estudio}} ({{nombre_grupo}}) termina el {{fecha_fin}}. <a href="{{link_cierre}}">Hacer el cierre</a>.</p>' },
  cumpleanos: { subject: '¡Feliz cumpleaños, {{nombre}}!', html: '<p>Hola {{nombre}},</p><p>Hoy es tu día y queríamos saludarte. <strong>¡Feliz cumpleaños!</strong></p><p>Gracias por servir en Theos Place.</p>' },
  solicitud_asignada: { subject: 'Te asignaron una solicitud', html: '<p>Hola {{nombre}}, te asignaron una solicitud de {{tipo_solicitud}} de {{nombre_solicitante}}. <a href="{{link_solicitud}}">Verla en el sistema</a>.</p>' },
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
  inscripcion_evento: {
    subject: 'Quedaste inscrito/a en {{nombre_evento}}',
    html: '<p>Hola {{nombre}},</p><p>Confirmamos tu inscripción a <strong>{{nombre_evento}}</strong>.</p><p><strong>Cuándo:</strong> {{fecha_evento}}<br><strong>Dónde:</strong> {{lugar_evento}}</p>{{#pago_pendiente}}<p>Queda pendiente el pago de <strong>{{monto}}</strong>. Tu cupo está reservado mientras subís el comprobante y lo revisamos. <a href="{{link_pago}}">Subir el comprobante</a></p>{{/pago_pendiente}}{{#sin_pago}}<p>No hay nada más que hacer: te esperamos.</p>{{/sin_pago}}',
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
