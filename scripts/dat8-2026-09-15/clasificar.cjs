/**
 * DAT-8 · Los menores de 12 con correo y sin familia, separados por lo que hay
 * que hacerles. Solo lee.
 *   npx tsx --env-file=.env.local scripts/dat8-2026-09-15/clasificar.cjs
 *
 * Son dos problemas distintos viviendo mezclados, y la señal que los separa es
 * si el correo lleva el NOMBRE DE PILA de la propia persona (ver
 * src/lib/members/correo-de-quien.ts). El apellido no cuenta: madre e hijo lo
 * comparten.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const M12 = `m.birth_date is not null and m.birth_date > (current_date - interval '12 years')`

;(async () => {
  const { deQuienEsElCorreo } = await import('../../src/lib/members/correo-de-quien.ts')
  const c = L.nuevoCliente(); await c.connect()
  const { rows } = await c.query(`
    select m.id, m.first_name, m.last_name, m.birth_date::text nac,
      extract(year from age(m.birth_date))::int edad, m.email, m.phone, m.cedula,
      (select count(*)::int from study_enrollments se where se.member_id=m.id) estudios,
      (select a.first_name||' '||a.last_name from members a
        where a.id<>m.id and a.is_active and lower(a.email)=lower(m.email)
          and (a.birth_date is null or a.birth_date <= (current_date - interval '18 years')) limit 1) adulto_correo,
      (select a.first_name||' '||a.last_name from members a
        where a.id<>m.id and a.is_active and a.phone is not null and m.phone is not null
          and regexp_replace(a.phone,'\\D','','g')=regexp_replace(m.phone,'\\D','','g')
          and length(regexp_replace(m.phone,'\\D','','g'))>=8
          and (a.birth_date is null or a.birth_date <= (current_date - interval '18 years')) limit 1) adulto_tel
    from members m
    where m.is_active and ${M12} and m.email is not null and btrim(m.email)<>''
      and not exists (select 1 from family_members f where f.member_id=m.id)
    order by edad, m.first_name`)

  const grupos = { la_fecha_esta_mal: [], correo_prestado: [], a_mano: [] }
  for (const r of rows) {
    const v = deQuienEsElCorreo({
      email: r.email, first_name: r.first_name, last_name: r.last_name,
      adultoConElMismoCorreo: r.adulto_correo, adultoConElMismoTelefono: r.adulto_tel,
    })
    grupos[v].push(r)
  }

  console.log(`DAT-8 · menores de 12 con correo y sin familia: ${rows.length}\n`)
  console.log(`a) EL CORREO ES SUYO → la fecha está mal, no son menores: ${grupos.la_fecha_esta_mal.length}`)
  grupos.la_fecha_esta_mal.forEach(r => console.log(`   ${String(r.edad).padStart(2)}a ${(r.first_name+' '+r.last_name).padEnd(30)} ${r.email}`))

  console.log(`\nb) EL CORREO ES DE UN ADULTO → sí son menores, falta la familia: ${grupos.correo_prestado.length}`)
  grupos.correo_prestado.forEach(r => console.log(`   ${String(r.edad).padStart(2)}a ${(r.first_name+' '+r.last_name).padEnd(30)} ${r.email}\n        es de: ${r.adulto_correo ?? r.adulto_tel}${r.adulto_correo && r.adulto_tel ? ' (correo y teléfono)' : r.adulto_tel ? ' (por teléfono)' : ' (por correo)'}`))

  console.log(`\nc) SIN PISTA — a mano: ${grupos.a_mano.length}`)
  grupos.a_mano.forEach(r => console.log(`   ${String(r.edad).padStart(2)}a ${(r.first_name+' '+r.last_name).padEnd(30)} ${r.email}`))

  const csv = (n, cab, f) => { fs.writeFileSync(`data-import/${n}`, [cab, ...f].map(x => x.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n')); console.log(`CSV: data-import/${n}`) }
  console.log()
  csv('dat8-fecha-mal-2026-09-15.csv', ['Persona','Nacimiento','Edad','Correo','Cédula','Estudios'],
    grupos.la_fecha_esta_mal.map(r => [`${r.first_name} ${r.last_name}`, r.nac, r.edad, r.email, r.cedula, r.estudios]))
  csv('dat8-correo-prestado-2026-09-15.csv', ['Menor','Edad','Correo','De quién es','Cómo se supo'],
    grupos.correo_prestado.map(r => [`${r.first_name} ${r.last_name}`, r.edad, r.email, r.adulto_correo ?? r.adulto_tel, r.adulto_correo ? 'mismo correo' : 'mismo teléfono']))
  csv('dat8-a-mano-2026-09-15.csv', ['Persona','Nacimiento','Edad','Correo','Teléfono'],
    grupos.a_mano.map(r => [`${r.first_name} ${r.last_name}`, r.nac, r.edad, r.email, r.phone]))
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
