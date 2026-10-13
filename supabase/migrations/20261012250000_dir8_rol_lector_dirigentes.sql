-- DIR-8 · El rol `lector_dirigentes` (Luis y Yeya).
--
-- POR QUÉ HACE FALTA UN ROL NUEVO. Las notas del dirigente las escribe solo
-- coordinación (Fabiola), pero Luis y Yeya tienen que poder LEERLAS. Sin un
-- rol de lectura, dárselas obligaba a darles `coordinador_dirigentes`, que
-- escribe. Y `editor_dirigentes` —el otro rol acotado— no sirve: ese es
-- justamente el que actualiza datos todos los días y NO debe ver las notas.
--
-- El CHECK de `member_roles` se amplía con el patrón de SRV (2026-10-07):
-- leer la definición viva y reescribirla, en vez de escribir la lista entera
-- a mano. Una lista de 30 roles copiada a mano se equivoca, y el error
-- aparece meses después cuando alguien no puede entrar.

do $$
declare v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid = 'public.member_roles'::regclass
     and conname = 'member_roles_role_check';
  if v_def is null then
    raise exception 'No existe member_roles_role_check: revisar antes de seguir.';
  end if;
  if position('lector_dirigentes' in v_def) > 0 then
    raise notice 'El CHECK ya acepta lector_dirigentes; no se toca.';
  else
    alter table public.member_roles drop constraint member_roles_role_check;
    execute format(
      'alter table public.member_roles add constraint member_roles_role_check %s',
      replace(v_def, '''editor_dirigentes''::text',
                     '''editor_dirigentes''::text, ''lector_dirigentes''::text'));
  end if;
end $$;

-- A NADIE se le asigna acá: quién lo tiene lo decide Floriana desde la
-- pantalla de accesos. Un insert automático de personas por nombre es
-- justo el tipo de cosa que después nadie sabe por qué está.
