-- EXECUTE de las funciones de public estaba en PUBLIC (=X). La app solo llama RPCs
-- por service role (ningún cliente usa .rpc()). Bloqueamos todas las funciones a
-- service_role. Los triggers siguen funcionando (su ejecución no depende del
-- privilegio EXECUTE del rol que dispara la operación).
revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on all functions in schema public to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public grant  execute on functions to service_role;
