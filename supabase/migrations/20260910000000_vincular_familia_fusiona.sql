-- Vincular a dos personas FUSIONA sus familias, de forma transaccional.
--
-- BUG 2026-09-09 (caso Chavarría / Hernández): linkFamilyMember tomaba la
-- familia del titular e insertaba a la otra persona ahí, sin mirar jamás si esa
-- persona YA tenía familia. Al vincular a dos esposos que cada uno venía con
-- hijos, ella quedó en DOS unidades y los hijos repartidos entre ambas.
--
-- Esto vive en la base y no en TypeScript porque una fusión mueve varias filas y
-- borra una unidad: hecho desde el cliente, un fallo a mitad deja la familia
-- partida en dos, que es exactamente el estado del que se está saliendo. Acá es
-- una transacción: o se mueve todo o no se mueve nada.
--
-- Reglas (documentadas también en src/lib/members/fusion-familias.ts, que tiene
-- los tests de la misma decisión):
--   · Sobrevive la unidad MÁS ANTIGUA, con su nombre.
--   · Cada integrante se muda con su relation y su linked_by.
--   · Si alguien está en las dos (solo pasa reparando datos viejos), sobrevive
--     su fila MÁS RECIENTE: sobre una persona vale lo último que un humano dijo.

create or replace function public.link_family_member(
  p_owner    uuid,
  p_link     uuid,
  p_relation text,
  p_actor    uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_owner uuid;
  v_unit_link  uuid;
  v_survivor   uuid;
  v_loser      uuid;
  v_last_name  text;
begin
  if p_owner is null or p_link is null then
    raise exception 'DATOS_INCOMPLETOS';
  end if;
  if p_owner = p_link then
    raise exception 'VINCULO_A_SI_MISMO';
  end if;

  -- La unidad de cada uno. Se toma la más antigua por si quedara basura previa
  -- a la restricción UNIQUE(member_id); después de la reparación hay una sola.
  select fm.family_unit_id into v_unit_owner
    from family_members fm join family_units fu on fu.id = fm.family_unit_id
   where fm.member_id = p_owner order by fu.created_at, fu.id limit 1;

  select fm.family_unit_id into v_unit_link
    from family_members fm join family_units fu on fu.id = fm.family_unit_id
   where fm.member_id = p_link order by fu.created_at, fu.id limit 1;

  -- (d) Ya están juntos: no-op idempotente.
  if v_unit_owner is not null and v_unit_owner = v_unit_link then
    return v_unit_owner;
  end if;

  -- (a) Ninguno tiene familia: se crea, con el owner de Titular.
  if v_unit_owner is null and v_unit_link is null then
    select nullif(btrim(last_name), '') into v_last_name from members where id = p_owner;
    insert into family_units (name)
      values (coalesce('Familia ' || v_last_name, 'Familia'))
      returning id into v_unit_owner;
    insert into family_members (family_unit_id, member_id, relation, linked_by)
      values (v_unit_owner, p_owner, 'Titular', p_actor);
    insert into family_members (family_unit_id, member_id, relation, linked_by)
      values (v_unit_owner, p_link, p_relation, p_actor);
    return v_unit_owner;
  end if;

  -- (b) Solo uno tiene: el otro entra ahí. Si la que existe es la del vinculado,
  -- el que entra es el owner — la familia no se parte solo porque el vínculo se
  -- haya iniciado desde el perfil "equivocado".
  if v_unit_link is null then
    insert into family_members (family_unit_id, member_id, relation, linked_by)
      values (v_unit_owner, p_link, p_relation, p_actor);
    return v_unit_owner;
  end if;
  if v_unit_owner is null then
    -- OJO con la relación: p_relation describe a la persona VINCULADA, no al
    -- dueño del perfil. Acá el que entra es el dueño, así que usar p_relation
    -- escribiría sobre él un dato que nadie afirmó ("es Hijo/a" cuando lo que se
    -- dijo fue que el OTRO lo es). Entra como 'Titular', la misma convención que
    -- cuando se crea una familia desde cero: es la persona cuyo hogar se está
    -- gestionando. Puede quedar más de un 'Titular' tras una fusión; nada en el
    -- sistema asume que haya uno solo (el check-in lo calcula por id).
    insert into family_members (family_unit_id, member_id, relation, linked_by)
      values (v_unit_link, p_owner, 'Titular', p_actor);
    return v_unit_link;
  end if;

  -- (c) Los dos tienen familia distinta: FUSIÓN.
  select id into v_survivor from family_units
   where id in (v_unit_owner, v_unit_link) order by created_at, id limit 1;
  v_loser := case when v_survivor = v_unit_owner then v_unit_link else v_unit_owner end;

  -- Quien esté en las dos: se queda su fila más reciente. Se resuelve borrando
  -- de la sobreviviente las filas que la perdedora va a reemplazar, pero solo
  -- cuando la de la perdedora es efectivamente posterior.
  delete from family_members s
   where s.family_unit_id = v_survivor
     and exists (
       select 1 from family_members l
        where l.family_unit_id = v_loser
          and l.member_id = s.member_id
          and l.created_at >= s.created_at
     );

  -- Mudanza. El ON CONFLICT cubre a quien ya tenga la fila buena en la
  -- sobreviviente (su fila de la perdedora era más vieja y no debe pisarla).
  update family_members
     set family_unit_id = v_survivor
   where family_unit_id = v_loser
     and not exists (
       select 1 from family_members s2
        where s2.family_unit_id = v_survivor and s2.member_id = family_members.member_id
     );

  -- Lo que no se pudo mudar es un duplicado que ya está representado arriba.
  delete from family_members where family_unit_id = v_loser;
  delete from family_units where id = v_loser;

  -- El vínculo pedido: si el vinculado ya está (viene de la fusión), se respeta
  -- su relación; solo se escribe cuando falta.
  insert into family_members (family_unit_id, member_id, relation, linked_by)
    values (v_survivor, p_link, p_relation, p_actor)
    on conflict (family_unit_id, member_id) do nothing;

  return v_survivor;
end;
$$;

revoke all on function public.link_family_member(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.link_family_member(uuid, uuid, text, uuid) to service_role;

comment on function public.link_family_member is
  'Vincula dos personas fusionando sus familias si ambas tenían. Transaccional. Sobrevive la unidad más antigua; ante una persona en ambas, gana su fila más reciente.';


-- Fusiona un grupo de unidades en una sola, transaccionalmente. La usa la
-- reparación de los datos que dejó el bug; la misma regla que link_family_member.
create or replace function public.merge_family_units(
  p_survivor uuid,
  p_losers   uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_survivor is null or p_losers is null or array_length(p_losers, 1) is null then
    raise exception 'DATOS_INCOMPLETOS';
  end if;
  if p_survivor = any(p_losers) then
    raise exception 'SOBREVIVIENTE_EN_LA_LISTA';
  end if;

  -- Quien esté repetido: gana su fila más reciente. Se borra de la
  -- sobreviviente la fila vieja que una de las perdedoras va a reemplazar.
  delete from family_members s
   where s.family_unit_id = p_survivor
     and exists (
       select 1 from family_members l
        where l.family_unit_id = any(p_losers)
          and l.member_id = s.member_id
          and l.created_at >= s.created_at
     );

  -- De las perdedoras, por persona se muda UNA sola fila: la más reciente.
  update family_members fm
     set family_unit_id = p_survivor
   where fm.id in (
     select distinct on (member_id) id
       from family_members
      where family_unit_id = any(p_losers)
        and member_id not in (select member_id from family_members where family_unit_id = p_survivor)
      order by member_id, created_at desc, id desc
   );

  -- El resto de las perdedoras son duplicados ya representados en la
  -- sobreviviente.
  delete from family_members where family_unit_id = any(p_losers);
  delete from family_units where id = any(p_losers);
end;
$$;

revoke all on function public.merge_family_units(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.merge_family_units(uuid, uuid[]) to service_role;

comment on function public.merge_family_units is
  'Fusiona unidades familiares en la sobreviviente. Transaccional. Ante una persona repetida, gana su fila más reciente.';
