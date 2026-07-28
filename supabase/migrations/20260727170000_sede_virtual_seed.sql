-- EST-4: zona fija "Virtual" para grupos virtuales. is_active=false a
-- propósito: NO debe aparecer como sede de charlas ni en los combos que listan
-- activeSedes (filtros, alta de miembros); los grupos la referencian por code
-- y sedeLabel la resuelve del catálogo completo.

insert into "public"."sedes" ("code", "name", "is_active", "is_historical")
values ('VIRTUAL', 'Virtual', false, false)
on conflict ("code") do nothing;
