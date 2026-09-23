-- INF-1 · `merge_members_resuelto` nace ejecutable por anon y authenticated.
--
-- CÓMO APARECIÓ. Levantando la primera base desde cero para preparar staging:
-- sobre un esquema en blanco con las 112 migraciones, esta es la ÚNICA función
-- de `public` con EXECUTE para anon/authenticated. Su propia migración
-- (20260914180000) termina con:
--
--     GRANT ALL ON FUNCTION public.merge_members_resuelto(...) TO anon, authenticated, service_role;
--
-- que es exactamente lo que AGENTS.md prohíbe desde SEC-3.
--
-- NO ERA EXPLOTABLE, y conviene dejarlo escrito para que nadie lo lea como un
-- incidente: la función NO es SECURITY DEFINER, así que corre con los permisos
-- de quien llama. `anon` no tiene ningún grant de escritura sobre `members` ni
-- `member_roles`, y las políticas RLS de UPDATE y DELETE exigen el rol admin,
-- encargado_staff o editor_perfiles. Un miembro con sesión que la invocara se
-- estrellaría contra RLS en la primera escritura.
--
-- Igual se cierra: la regla existe para que la defensa no dependa de una sola
-- capa. El día que alguien afloje una política de RLS, este grant deja de ser
-- inofensivo, y nadie va a acordarse de que estaba abierto.
--
-- POR QUÉ EL AUDITOR NO LA VIO. `scripts/sec3/auditar.cjs` solo mira funciones
-- SECURITY DEFINER —razonable, son las que escalan privilegios— y ésta no lo
-- es. Se amplía en el mismo cambio.
--
-- La app la llama desde el servidor con la llave de servicio
-- (`members-mutations.ts` → `createAdminClient`), así que revocar no rompe nada.

revoke execute on function public.merge_members_resuelto(uuid, uuid, jsonb, uuid) from public, anon, authenticated;
grant  execute on function public.merge_members_resuelto(uuid, uuid, jsonb, uuid) to service_role;
alter  function public.merge_members_resuelto(uuid, uuid, jsonb, uuid) set search_path to 'public';
