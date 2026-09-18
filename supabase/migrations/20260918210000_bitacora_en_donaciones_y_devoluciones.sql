-- Bitácora en las dos tablas de PLATA que no la tenían.
--
-- Se descubrió el 2026-09-18 borrando una donación de prueba: el borrado no
-- dejó ningún rastro. `donations` y `refunds` eran las únicas dos tablas de
-- dinero sin `log_changes` — `payments` y `scholarships` sí lo tenían.
--
-- Importa más desde DON-2: ahora se pueden crear donaciones a mano desde la
-- pantalla, así que la pregunta "¿quién registró esto y con qué monto?" dejó de
-- responderse sola con el nombre del archivo importado.
--
-- El costo es el mismo que ya paga `members`: una fila de auditoría por
-- escritura. Un import de mil donaciones agrega mil filas, que es exactamente
-- lo que se quiere poder auditar.
create trigger audit_donations
  after insert or delete or update on public.donations
  for each row execute function log_changes();

create trigger audit_refunds
  after insert or delete or update on public.refunds
  for each row execute function log_changes();
