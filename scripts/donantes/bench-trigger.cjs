/** Mide cuánto cuesta cada parte del trigger de auditoría. Todo en rollback. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const ID = (await c.query(`select id from members limit 1`)).rows[0].id
    await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify({'x-actor-user-id': (await c.query(`select id from auth.users limit 1`)).rows[0].id})])
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({role:'service_role'})])

    const medir = async (etiqueta, n = 60) => {
      await c.query(`update members set updated_at = now() where id=$1`, [ID]) // calentar
      const t0 = process.hrtime.bigint()
      for (let i = 0; i < n; i++) await c.query(`update members set updated_at = now() where id=$1`, [ID])
      const ms = Number(process.hrtime.bigint() - t0) / 1e6 / n
      console.log(`  ${etiqueta.padEnd(46)} ${ms.toFixed(2)} ms por UPDATE`)
      return ms
    }

    console.log('=== MEDICIÓN (incluye ida y vuelta de red, que es igual en todos) ===')
    const actual = await medir('trigger ACTUAL (con EXCEPTION + auth.users)')

    // Variante sin el bloque EXCEPTION: se extrae el uuid con regex, que no
    // puede tirar excepción, así que no hace falta la subtransacción.
    await c.query(`
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
        if v_actor is null
           and current_setting('request.jwt.claims', true) ~ '"role"\\s*:\\s*"service_role"' then
          v_texto := substring(current_setting('request.headers', true)
                      from '"x-actor-user-id"\\s*:\\s*"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"');
          if v_texto is not null then select u.id into v_actor from auth.users u where u.id = v_texto::uuid; end if;
        end if;
        insert into audit_log (actor_id, action, entity_type, entity_id, old_data, new_data)
        values (v_actor, TG_OP, TG_TABLE_NAME, coalesce(NEW.id, OLD.id), v_old, v_new);
        return coalesce(NEW, OLD);
      end $f$;`)
    const sinExcepcion = await medir('sin EXCEPTION (regex, sin subtransacción)')

    // Variante como estaba ANTES de hoy: solo auth.uid().
    await c.query(`
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
      end $f$;`)
    const comoAntes = await medir('como estaba ANTES de hoy')

    await c.query(`alter table members disable trigger audit_members`)
    const sinTrigger = await medir('SIN trigger de auditoría (piso)')

    console.log('\n=== ATRIBUCIÓN (restando el piso de red) ===')
    console.log(`  costo del trigger actual:        ${(actual - sinTrigger).toFixed(2)} ms`)
    console.log(`  costo sin el bloque EXCEPTION:   ${(sinExcepcion - sinTrigger).toFixed(2)} ms`)
    console.log(`  costo como estaba antes de hoy:  ${(comoAntes - sinTrigger).toFixed(2)} ms`)
    await c.query('rollback'); console.log('\n(todo revertido)')
  } catch (e) { await c.query('rollback'); console.error('ROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()
