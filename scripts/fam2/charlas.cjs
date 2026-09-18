/**
 * FAM-2 parte B · De los 66 que cumplieron 18 sin cuenta, a cuáles se les
 * ofrece el alta: decisión del usuario (2026-09-18) → los que asistieron a una
 * charla AL MENOS DOS VECES en 2026.
 *
 * LA FECHA DE LA ASISTENCIA no es siempre `events.starts_at`. En un evento
 * RECURRENTE esa columna es el ancla de la serie —la primera ocurrencia— y todas
 * las marcas del año colgarían del mismo día. Se usa la misma regla que
 * `lib/events/checkins-del-dia.ts` (bug de Floriana, 2026-09-17): recurrente →
 * la hora del check-in; suelto → el inicio del evento.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const q = s => `"${String(s ?? '').replace(/"/g,'""')}"`

;(async () => {
  const c = await nuevoCliente(); await c.connect()
  const { rows } = await c.query(`
    with candidatos as (
      select m.id, m.first_name, m.last_name, m.email, m.phone, m.cedula,
             to_char(m.birth_date,'YYYY-MM-DD') nacimiento, m.sede_id
      from members m
      where m.is_active and m.auth_user_id is null and m.birth_date is not null
        and (m.birth_date + interval '18 years')::date between date '2025-09-16' and date '2026-09-15'
    ), asistencias as (
      select ec.member_id,
             (case when e.is_recurring then ec.checked_in_at else coalesce(e.starts_at, ec.checked_in_at) end
               at time zone 'America/Costa_Rica')::date dia,
             e.title
      from event_checkins ec
      join events e on e.id = ec.event_id
      where e.event_type = 'charla' and ec.member_id in (select id from candidatos)
    )
    select cand.*, a.name sede,
           count(x.*) charlas_2026,
           count(distinct x.dia) dias_distintos,
           to_char(min(x.dia),'YYYY-MM-DD') primera,
           to_char(max(x.dia),'YYYY-MM-DD') ultima,
           string_agg(distinct x.title, ' / ') charlas
    from candidatos cand
    left join areas a on a.id = cand.sede_id
    left join asistencias x
      on x.member_id = cand.id and x.dia >= date '2026-01-01' and x.dia < date '2027-01-01'
    group by cand.id, cand.first_name, cand.last_name, cand.email, cand.phone,
             cand.cedula, cand.nacimiento, cand.sede_id, a.name
    order by count(x.*) desc, cand.last_name`)

  const invitar = rows.filter(r => Number(r.charlas_2026) >= 2)
  const fuera   = rows.filter(r => Number(r.charlas_2026) < 2)
  console.log(`candidatos: ${rows.length}`)
  console.log(`  ✓ con 2 o más charlas en 2026 → SE INVITA: ${invitar.length}`)
  console.log(`  · con 1 charla:  ${fuera.filter(r => Number(r.charlas_2026) === 1).length}`)
  console.log(`  · con ninguna:   ${fuera.filter(r => Number(r.charlas_2026) === 0).length}`)
  const sinCorreo = invitar.filter(r => !String(r.email ?? '').trim())
  console.log(`\n  ‼ de los que se invitan, SIN CORREO: ${sinCorreo.length}${sinCorreo.length ? ' → ' + sinCorreo.map(r=>r.first_name+' '+r.last_name).join(', ') : ''}`)

  console.log('\n=== a quiénes se invita ===')
  invitar.forEach(r => console.log(
    `  ${String(r.charlas_2026).padStart(2)}×  ${(r.first_name+' '+r.last_name).padEnd(30)} ${String(r.email||'(SIN CORREO)').padEnd(34)} ${r.primera} → ${r.ultima}  ${r.sede ?? ''}`))

  const cols = ['first_name','last_name','email','phone','cedula','nacimiento','sede','charlas_2026','dias_distintos','primera','ultima','charlas','id']
  for (const [nombre, datos] of [['invitar', invitar], ['no-invitar', fuera]]) {
    fs.writeFileSync(`/tmp/fam2-18-${nombre}.csv`,
      '﻿' + [cols.join(','), ...datos.map(r => cols.map(k => q(r[k])).join(','))].join('\n'))
  }
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
