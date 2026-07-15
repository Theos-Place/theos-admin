-- Incidente real (2026-07-15): dos filas de members apuntaban al mismo
-- auth_user_id (una del import histórico 2015, otra de una corrida del
-- script de usuarios de prueba) — .maybeSingle() por auth_user_id fallaba
-- silenciosamente, la sesión resolvía a "sin member" y el usuario quedaba
-- sin ningún rol/permiso pese a tenerlos asignados. Ya desvinculado el
-- duplicado a mano; este índice único impide que se repita.
CREATE UNIQUE INDEX members_auth_user_id_uniq ON members (auth_user_id) WHERE auth_user_id IS NOT NULL;
