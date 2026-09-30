-- EST-20 · El resumen de estudios: números que cuadren y los bloques que faltaban.
--
-- QUÉ ESTABA MAL. La página decía 380 en «Niveles activos» y el Excel de la
-- pantalla de grupos traía 386. Ninguno roto: contaban cosas distintas, y la
-- definición no estaba escrita en ningún lado.
--
--   · Este RPC contaba `enrolled` crudo y excluía dirigentes → 380.
--   · El Excel contaba por NEGACIÓN (`status !== 'withdrawn'`) sobre el estado
--     ya mapeado al dominio, donde `completed` y `reprobado` caen en
--     «enrolled»: sumaba 5 personas que ya terminaron dentro de un grupo en
--     curso, más una dirigente matriculada en su propio grupo.
--
-- LO QUE CAMBIA ACÁ:
--
-- 1. Se agrega `pendiente_de_pago` a lo que cuenta como estudiando. La
--    matrícula es efectiva de inmediato y el pago va por un carril aparte
--    (regla del 2026-08-04): dejarlo fuera decía que esa persona no estudia.
--    Hoy hay CERO filas así en niveles en curso, así que el número no se mueve
--    — se arregla antes de que aparezca la primera y nadie entienda por qué
--    falta uno.
--
-- 2. Se agrega el estado `en_matricula` («por iniciar»), que hasta hoy no
--    salía en ninguna parte del resumen: son 11 grupos y 54 inscripciones que
--    existen y nadie veía.
--
-- LA LISTA DE ESTADOS ES BLANCA, no una negación. Contar «quién no está
-- excluido» es lo que hizo que el aviso de inicio le llegara a 16 personas
-- retiradas: deja entrar todo lo que nadie nombró. La misma lista vive en
-- `lib/studies/conteo-de-participantes.ts` y un test compara las dos.

create or replace function public.study_dashboard_stats_v2()
returns table(estado text, categoria text, grupos bigint, inscripciones bigint, unicos bigint)
language sql stable security definer set search_path to 'public'
as $function$
  with rows as (
    select
      g.status::text as estado,
      case
        when p.level = 'niveles' then 'niveles'
        when p.level in ('etapa_inicial','etapa_intermedia') then 'capacitaciones'
        else 'otros'
      end as categoria,
      g.id as group_id,
      e.member_id,
      (e.member_id = g.leader_id or e.member_id = g.co_leader_id) as is_leader
    from study_groups g
    join study_plans p on p.id = g.plan_id
    left join study_enrollments e on e.group_id = g.id
      and (
        -- ESTUDIANDO AHORA, en un grupo que corre o que está por arrancar.
        (g.status in ('en_curso','en_matricula') and e.status in ('enrolled','pendiente_de_pago'))
        -- YA TERMINÓ, en un grupo cerrado. `reprobado` queda fuera a
        -- propósito: el histórico de «cuántos pasaron» no lo cuenta.
        or (g.status = 'finalizado' and e.status = 'completed')
      )
    where g.status in ('en_curso','en_matricula','finalizado')
  )
  select estado, categoria,
    count(distinct group_id) as grupos,
    count(member_id) filter (where not coalesce(is_leader, false)) as inscripciones,
    count(distinct member_id) filter (where not coalesce(is_leader, false)) as unicos
  from rows
  group by 1, 2;
$function$;

-- AGENTS.md: una función de `public` nace con EXECUTE para PUBLIC y PostgREST
-- la publica en /rest/v1/rpc/. La app la llama desde el servidor.
revoke execute on function public.study_dashboard_stats_v2() from public, anon, authenticated;
grant  execute on function public.study_dashboard_stats_v2() to service_role;
