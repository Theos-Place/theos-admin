-- Un miembro no puede tener más de un check-in al mismo evento (refuerza la
-- idempotencia de los scripts de import y evita que la lista de participación
-- del perfil muestre el mismo evento duplicado). Parcial: los check-ins de
-- invitados (member_id NULL) quedan fuera y pueden repetirse.
create unique index if not exists event_checkins_member_event_uniq
  on event_checkins (member_id, event_id)
  where member_id is not null;
