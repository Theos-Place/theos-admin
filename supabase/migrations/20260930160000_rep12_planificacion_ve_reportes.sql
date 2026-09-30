-- REP-12 · Quien encabeza el Comité de Planificación recibe el rol `reportes`.
--
-- La regla nueva vive en `lib/servers/position-roles.ts` y funciona sola de
-- ahora en adelante. Esta migración existe solo por el BACKFILL: el sync de
-- roles por puesto corre cuando alguien TOCA una asignación, así que quien ya
-- tiene el puesto desde antes no dispara nada y la regla no le llegaría hasta
-- que alguien lo reasigne.
--
-- MEDIDO ANTES (producción, 2026-09-30, `scripts/rep12/dry-run.cjs`):
--   · 1 persona la recibe — Roberto Acosta Acosta, «Encargado Comité» del
--     Comité Planificación.
--   · 24 personas tienen ESE MISMO TÍTULO en otros 22 comités y NO la reciben.
--     Es el control que importa: el título `Encargado Comité` es genérico, y
--     una regla escrita contra él le habría dado todos los reportes de la
--     organización a 25 personas en vez de a una.
--
-- NO SE INSERTA A MANO: se llama `grant_position_role`, el mismo RPC que usa
-- la app al asignar a alguien a un puesto. Ya es idempotente, ya respeta un
-- rol que la persona tenga a mano (no le pisa el `origen`) y ya crea la fila
-- de `member_role_position_grants` que es lo que hace que al PERDER el puesto
-- pierda el acceso. Escribir el INSERT acá habría duplicado esas tres cosas.
--
-- El espejo de `esPuestoDeEncargado` en SQL: título 'encargado' o que empiece
-- por 'encargado ', sin acentos y sin artículos. Hoy son «Encargado Comité» y
-- «Encargado de comité»; se compara por prefijo y no contra esa lista porque
-- la sincronización del Excel Madre ya renombró los encargados una vez
-- (2026-09-11) y dejó 26 comités sin otorgar su rol.

begin;

do $$
declare
  v record;
  v_n int := 0;
begin
  for v in
    select distinct vol.member_id, sp.id as position_id
      from volunteers vol
      join service_positions sp on sp.id = vol.position_id and sp.is_active
      join areas a on a.id = sp.area_id and a.is_active and a.area_type = 'committee'
     where vol.status = 'active'
       and unaccent(lower(a.name)) like '%planificacion%'
       and (
         regexp_replace(
           regexp_replace(unaccent(lower(btrim(sp.title))), '\y(de|del|la|el|los|las)\y', ' ', 'g'),
           '\s+', ' ', 'g') = 'encargado'
         or regexp_replace(
              regexp_replace(unaccent(lower(btrim(sp.title))), '\y(de|del|la|el|los|las)\y', ' ', 'g'),
              '\s+', ' ', 'g') like 'encargado %'
       )
  loop
    perform public.grant_position_role(v.member_id, 'reportes', v.position_id);
    v_n := v_n + 1;
  end loop;
  raise notice 'REP-12: rol reportes otorgado por puesto a % persona(s).', v_n;
end $$;

commit;
