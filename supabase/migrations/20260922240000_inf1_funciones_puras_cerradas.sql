-- INF-1 · Las dos últimas funciones de `public` con EXECUTE para PUBLIC.
--
-- CÓMO APARECIERON, y por qué no las había visto nadie: el auditor de SEC-3
-- solo miraba las SECURITY DEFINER, y ninguna de estas dos lo es. Al ampliarlo
-- (mismo cambio) saltaron. Ojo con el detalle que casi me las hace pasar por
-- alto a mí también: NO tienen un GRANT escrito en ninguna migración —una
-- consulta sobre `proacl` las da como cerradas— sino que conservan el
-- **default de PostgreSQL**, que es EXECUTE para PUBLIC. Solo se ven con
-- `has_function_privilege`. Es literalmente el caso que AGENTS.md describe:
-- «una función creada en public NACE con EXECUTE para PUBLIC».
--
-- NO HAY EXPOSICIÓN: las dos son puras y no tocan datos.
--   · immutable_unaccent(text) → quita tildes. Entra texto, sale texto.
--   · merge_no_copia()         → devuelve un arreglo constante con los nombres
--                                de las columnas que la fusión no copia.
-- Se cierran igual, porque la regla es «ninguna», y una regla con excepciones
-- no escritas deja de ser revisable.
--
-- VERIFICADO ANTES DE APLICAR, no razonado: `immutable_unaccent` es la que usa
-- la columna generada `members.search_text`, así que la duda real era si
-- revocarla rompía los INSERT. Se probó en una base local con las migraciones
-- desde cero: revocada, un insert como service_role —que es como escribe la
-- app— sigue funcionando y `search_text` se calcula igual ('Añó Zúñiga' →
-- 'ano zuniga'). La evaluación de una columna generada no pasa por el permiso
-- de quien inserta.

revoke execute on function public.immutable_unaccent(text) from public, anon, authenticated;
grant  execute on function public.immutable_unaccent(text) to service_role;

revoke execute on function public.merge_no_copia() from public, anon, authenticated;
grant  execute on function public.merge_no_copia() to service_role;
