/**
 * DAT-8 · Los menores de 12 con correo y SIN familia, con todo lo que se sabe,
 * para poder buscarlos a mano.
 *
 * El criterio es el mismo del pendiente: edad < 12 por birth_date, ficha activa,
 * correo no vacío, y cero familiares en su unidad familiar.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')

const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`

;(async () => {
  const c = await nuevoCliente(); await c.connect()
  const { rows } = await c.query(`
    select
      m.first_name, m.last_name, m.email, m.phone, m.cedula, m.document_type,
      to_char(m.birth_date,'YYYY-MM-DD') birth_date,
      date_part('year', age(m.birth_date))::int edad,
      m.gender, m.address, m.external_id,
      to_char(m.created_at at time zone 'America/Costa_Rica','YYYY-MM-DD HH24:MI') creada,
      to_char(m.account_confirmed_at at time zone 'America/Costa_Rica','YYYY-MM-DD') cuenta_confirmada,
      (m.auth_user_id is not null) tiene_cuenta,
      a.name sede,
      -- Por dónde buscarlos: si asisten, si estudian, si alguien más usa ese correo.
      (select count(*) from event_checkins ec where ec.member_id = m.id) checkins,
      to_char((select max(ec.checked_in_at) at time zone 'America/Costa_Rica'
               from event_checkins ec where ec.member_id = m.id),'YYYY-MM-DD') ultimo_checkin,
      (select count(*) from study_enrollments se where se.member_id = m.id) matriculas,
      (select string_agg(distinct sp.title, ' / ') from volunteers v
         join service_positions sp on sp.id = v.position_id
        where v.member_id = m.id and v.status='active') puestos,
      (select count(*) from members o
        where o.id <> m.id and lower(o.email) = lower(m.email) and o.is_active) otros_con_ese_correo,
      (select string_agg(o.first_name||' '||o.last_name, ' / ') from members o
        where o.id <> m.id and lower(o.email) = lower(m.email) and o.is_active) quienes_mas,
      -- Apellidos compartidos: el camino más probable para encontrar al adulto.
      (select count(*) from members o
        where o.id <> m.id and o.is_active
          and o.last_name = m.last_name
          and date_part('year', age(o.birth_date)) >= 18) adultos_mismo_apellido,
      m.id
    from members m
    left join areas a on a.id = m.sede_id
    where m.is_active
      and m.birth_date is not null
      and date_part('year', age(m.birth_date)) < 12
      and coalesce(trim(m.email),'') <> ''
      and not exists (
        select 1 from family_members fm2
        where fm2.family_unit_id in (select family_unit_id from family_members where member_id = m.id)
          and fm2.member_id <> m.id)
    order by m.last_name, m.first_name`)

  console.log(`menores de 12, activos, con correo y sin familia: ${rows.length}\n`)
  rows.forEach(r => console.log(
    `  ${String(r.edad).padStart(2)}a  ${(r.first_name+' '+r.last_name).padEnd(30)} ${String(r.email).padEnd(34)} ` +
    `checkins:${String(r.checkins).padStart(3)}  mismo apellido adultos:${r.adultos_mismo_apellido}` +
    (r.otros_con_ese_correo > 0 ? `  ‼ ese correo también es de: ${r.quienes_mas}` : '')))

  const cols = Object.keys(rows[0] ?? {})
  const csv = [cols.join(','), ...rows.map(r => cols.map(k => q(r[k])).join(','))].join('\n')
  fs.writeFileSync('/tmp/dat8-menores-sin-familia.csv', '﻿' + csv)
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
