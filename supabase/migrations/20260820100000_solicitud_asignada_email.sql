-- Correo del sistema al ASIGNAR una solicitud de estudios (interés/reubicación)
-- a un coordinador: la campana sola no alcanza porque la gente no entra al
-- sistema (decisión 2026-08-20).
INSERT INTO public.message_templates (name, channel, subject, body, body_format, category, is_system, system_key, is_active, available_variables)
SELECT
  'Solicitud asignada (coordinador)', 'email',
  'Te asignaron una solicitud de {{tipo_solicitud}}',
  '<p>Hola {{nombre}},</p><p>Te asignaron una solicitud de <strong>{{tipo_solicitud}}</strong> de <strong>{{nombre_solicitante}}</strong>.</p><p><a href="{{link_solicitud}}">Verla en el sistema</a></p>',
  'html', 'transaccional', true, 'solicitud_asignada', true,
  '["nombre", "tipo_solicitud", "nombre_solicitante", "link_solicitud"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.message_templates WHERE system_key = 'solicitud_asignada');
