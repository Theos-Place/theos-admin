-- Pares de miembros marcados como "no es duplicado" para no volver a sugerirlos.
-- Se guardan ordenados (member_a < member_b) para que el par sea único.
create table if not exists duplicate_dismissals (
  member_a uuid not null references members(id) on delete cascade,
  member_b uuid not null references members(id) on delete cascade,
  dismissed_at timestamptz default now(),
  primary key (member_a, member_b)
);
