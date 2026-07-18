-- Auditoría db (docs/db-audit-2026-07-18.md) — hallazgo 🟢 §1/§5.
-- events.committee_id era una columna TEXT legacy (comité único "viejo") sin FK,
-- con 0 filas con valor en producción. Fue reemplazada por la relación m2m
-- event_organizing_committees (evento ↔ areas), que es la que alimenta la
-- validación de servidores (memberServesCommittee). El código que la leía/escribía
-- (tipos, adapter, form-mapper de eventos, ruta pública, UI) se eliminó en el
-- mismo cambio; la lógica de comités quedó 100% sobre la m2m.

ALTER TABLE events DROP COLUMN IF EXISTS committee_id;
