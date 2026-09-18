/**
 * DAT-8 · De los menores de 12 con correo y sin familia, ¿de quién es el correo?
 *
 * Aplica la MISMA regla del 15-set (`lib/members/correo-de-quien.ts`): el correo
 * lleva el NOMBRE DE PILA de la persona → la fecha está mal; el correo o el
 * teléfono coinciden con los de un adulto del padrón → es prestado y falta la
 * familia; nada de eso → a mano.
 *
 * Va por SQL y no por el cliente de Supabase a propósito: PostgREST corta en
 * 1.000 filas y el cruce necesita los 24 mil adultos.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')

const norm = s => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const usuario = e => norm(String(e ?? '').split('@')[0]).replace(/[._\-+0-9]/g, '')
const correoPareceDeLaPersona = (email, firstName) => {
  const u = usuario(email)
  if (u.length < 4) return false
  return String(firstName).split(/\s+/).map(norm).filter(p => p.length >= 4).some(p => u.includes(p))
}
const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`

;(async () => {
  const c = await nuevoCliente(); await c.connect()
  const { rows: menores } = await c.query(`
    select m.id, m.first_name, m.last_name, m.email, m.phone,
           to_char(m.birth_date,'YYYY-MM-DD') nac, date_part('year', age(m.birth_date))::int edad,
           (select string_agg(o.first_name||' '||o.last_name, ' / ') from members o
             where o.id <> m.id and o.is_active and lower(trim(o.email)) = lower(trim(m.email))
               and date_part('year', age(o.birth_date)) >= 18) adulto_mismo_correo,
           (select string_agg(o.first_name||' '||o.last_name, ' / ') from members o
             where o.id <> m.id and o.is_active and m.phone is not null
               and regexp_replace(o.phone,'\\D','','g') = regexp_replace(m.phone,'\\D','','g')
               and date_part('year', age(o.birth_date)) >= 18) adulto_mismo_telefono,
           (select string_agg(o.first_name||' '||o.last_name, ' / ') from members o
             where o.id <> m.id and o.is_active and lower(trim(o.email)) = lower(trim(m.email))) cualquiera_mismo_correo
    from members m
    where m.is_active and m.birth_date is not null
      and date_part('year', age(m.birth_date)) < 12
      and coalesce(trim(m.email),'') <> ''
      and not exists (select 1 from family_members fm2
        where fm2.family_unit_id in (select family_unit_id from family_members where member_id = m.id)
          and fm2.member_id <> m.id)
    order by m.last_name, m.first_name`)

  const filas = menores.map(m => {
    const suyo = correoPareceDeLaPersona(m.email, m.first_name)
    const prestado = m.adulto_mismo_correo || m.adulto_mismo_telefono
    return { ...m, veredicto: suyo ? 'la_fecha_esta_mal' : prestado ? 'correo_prestado' : 'a_mano' }
  })

  const TIT = {
    la_fecha_esta_mal: 'EL CORREO ES SUYO → lo que está mal es la FECHA, no el correo',
    correo_prestado:   'EL CORREO O EL TELÉFONO SON DE UN ADULTO DEL PADRÓN → falta vincular la familia',
    a_mano:            'SIN PISTA MECÁNICA → hay que averiguarlo',
  }
  console.log(`menores de 12, activos, con correo y sin familia: ${filas.length}\n`)
  for (const v of ['correo_prestado','la_fecha_esta_mal','a_mano']) {
    const g = filas.filter(f => f.veredicto === v)
    console.log(`── ${TIT[v]}  (${g.length})`)
    g.forEach(f => console.log(`   ${String(f.edad).padStart(2)}a  ${(f.first_name+' '+f.last_name).padEnd(30)} ${String(f.email).padEnd(34)}`
      + (f.adulto_mismo_correo ? `  → MISMO CORREO que ${f.adulto_mismo_correo}` : '')
      + (f.adulto_mismo_telefono ? `  → mismo teléfono que ${f.adulto_mismo_telefono}` : '')
      + (!f.adulto_mismo_correo && f.cualquiera_mismo_correo ? `  · ese correo también lo usa ${f.cualquiera_mismo_correo}` : '')))
    console.log('')
  }
  const cols = ['veredicto','first_name','last_name','edad','nac','email','phone','adulto_mismo_correo','adulto_mismo_telefono','cualquiera_mismo_correo','id']
  fs.writeFileSync('/tmp/dat8-clasificados.csv', '﻿' + [cols.join(','),
    ...filas.map(f => cols.map(k => q(f[k])).join(','))].join('\n'))
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
