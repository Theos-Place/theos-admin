-- Las notificaciones de solicitudes de estudio ya no usan una lista manual:
-- van automáticamente a todos los miembros con rol activo coordinador_estudios,
-- coordinador_dirigentes o admin (ver getStudyNotificationRecipients). Se elimina
-- la tabla de la lista configurable. CASCADE por si quedara alguna dependencia.
DROP TABLE IF EXISTS study_notification_recipients CASCADE;
