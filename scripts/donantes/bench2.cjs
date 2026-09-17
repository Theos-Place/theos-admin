/** Mide el trigger DENTRO de Postgres: EXPLAIN ANALYZE sobre 300 filas. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const VARIANTES = {
  actual: null, // la que está en producción
  sin_exception: `
    create or replace function public.log_changes() returns trigger language plpgsql security definer set search_path to 'public' as $f$
    declare v_old jsonb; v_new jsonb; v_actor uuid; v_texto text;
    begin
      if TG_OP = 'UPDATE' then
        select coalesce(jsonb_object_agg(o.key,o.value) filter (where o.key is not null),'{}'::jsonb),
               coalesce(jsonb_object_agg(o.key,n.value) filter (where o.key is not null),'{}'::jsonb)
          into v_old, v_new
        from jsonb_each(to_jsonb(OLD)) o join jsonb_each(to_jsonb(NEW)) n on n.key=o.key
        where o.value is distinct from n.value and o.key <> 'updated_at';
      elsif TG_OP='DELETE' then v_old := to_jsonb(OLD); v_new := null;
      else v_old := null; v_new := to_jsonb(NEW); end if;
      v_actor := auth.uid();
      if v_actor is null and current_setting('request.jwt.claims', true) ~ '"role"\\s*:\\s*"service_role"' then
        v_texto := substring(current_setting('request.headers', true)
          from '"x-actor-user-id"\\s*:\\s*"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"');
        if v_texto is not null then select u.id into v_actor from auth.users u where u.id = v_texto::uuid; end if;
      end if;
      insert into audit_log (actor_id, action, entity_type, entity_id, old_data, new_data)
      values (v_actor, TG_OP, TG_TABLE_NAME, coalesce(NEW.id, OLD.id), v_old, v_new);
      return coalesce(NEW, OLD);
    end $f$;`,
  como_antes: `
    create or replace function public.log_changes() returns trigger language plpgsql security definer set search_path to 'public' as $f$
    declare v_old jsonb; v_new jsonb;
    begin
      if TG_OP = 'UPDATE' then
        select coalesce(jsonb_object_agg(o.key,o.value) filter (where o.key is not null),'{}'::jsonb),
               coalesce(jsonb_object_agg(o.key,n.value) filter (where o.key is not null),'{}'::jsonb)
          into v_old, v_new
        from jsonb_each(to_jsonb(OLD)) o join jsonb_each(to_jsonb(NEW)) n on n.key=o.key
        where o.value is distinct from n.value and o.key <> 'updated_at';
      elsif TG_OP='DELETE' then v_old := to_jsonb(OLD); v_new := null;
      else v_old := null; v_new := to_jsonb(NEW); end if;
      insert into audit_log (actor_id, action, entity_type, entity_id, old_data, new_data)
      values (auth.uid()::uuid, TG_OP, TG_TABLE_NAME, coalesce(NEW.id, OLD.id), v_old, v_new);
      return coalesce(NEW, OLD);
    end $f$;`,
}
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const uid = (await c.query(`select id from auth.users limit 1`)).rows[0].id
    await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify({'x-actor-user-id': uid})])
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({role:'service_role'})])
    const N = 300
    for (const [nombre, sql] of Object.entries(VARIANTES)) {
      if (sql) await c.query(sql)
      await c.query(`savepoint s`)
      const r = await c.query(`explain (analyze, timing) update members set first_name = first_name where id in (select id from members limit ${N})`)
      const plan = r.rows.map(x => x['QUERY PLAN']).join('\n')
      const trig = plan.match(/Trigger audit_members: time=([\d.]+)/)
      const total = plan.match(/Execution Time: ([\d.]+)/)
      console.log(`  ${nombre.padEnd(16)} trigger ${((trig?+trig[1]:0)/N).toFixed(3)} ms/fila · total ${total?.[1]} ms para ${N} filas`)
      await c.query(`rollback to savepoint s`)
    }
    await c.query('rollback'); console.log('\n(todo revertido)')
  } catch (e) { await c.query('rollback'); console.error('ROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()
