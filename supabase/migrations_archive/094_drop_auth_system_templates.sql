-- 'bienvenida' y 'recuperacion_contrasena' las maneja por completo Supabase Auth
-- (panel → Authentication → Emails), no el sistema de plantillas. Se quitan de
-- message_templates para no duplicarlas. Las otras 5 del sistema (formularios y
-- matrículas) y las de marketing NO se tocan.
DELETE FROM message_templates
WHERE is_system = true AND system_key IN ('bienvenida', 'recuperacion_contrasena');
