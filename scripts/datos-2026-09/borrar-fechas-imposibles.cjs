/**
 * DAT-1 · Borrar las fechas de nacimiento imposibles.
 *
 * 65 fichas activas dicen una fecha que no puede ser: 57 dan entre 1 y 3 años,
 * 7 menos de 1 año, y una da 1194. Decisión del usuario (2026-09-10): se BORRAN
 * (pasan a null) en vez de intentar corregirlas.
 *
 * Es lo correcto y no una rendición: el año está mal digitado y no hay de dónde
 * deducir el bueno — "2 años" pudo ser 1970 igual que 1995. Un null dice "no
 * sabemos", que es cierto; dejar 2 años es una mentira que el sistema usa para
 * calcular edad, tratar a un adulto como menor y decidir si le crea cuenta.
 *
 * Se guarda la fecha vieja en el CSV de respaldo antes de borrarla, por si
 * alguien reconoce el patrón después.
 *
 *   node scripts/datos-2026-09/borrar-fechas-imposibles.cjs
 *   node scripts/datos-2026-09/borrar-fechas-imposibles.cjs --aplicar
 */
const { Client } = require('pg'); const fs = require('fs'); const path = require('path')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
const aplicar = process.argv.includes('--aplicar')

// Imposible = nacida hace 3 años o menos (nadie de esa edad tiene ficha propia
// activa), o antes de 1900. NO se toca nada entre medio: una fecha rara pero
// posible es un dato, no un error.
const CRITERIO = `is_active and birth_date is not null
  and (extract(year from age(birth_date)) <= 3 or birth_date < '1900-01-01')`

;(async () => {
  await c.connect()
  const { rows } = await c.query(`
    select id, trim(first_name||' '||last_name) nombre, to_char(birth_date,'YYYY-MM-DD') fecha,
      extract(year from age(birth_date))::int edad_calculada, cedula, email
    from members where ${CRITERIO} order by birth_date`)

  console.log(`fichas con fecha imposible: ${rows.length}`)
  const porTipo = {
    'antes de 1900': rows.filter(r => r.fecha < '1900-01-01').length,
    'menos de 1 año': rows.filter(r => r.edad_calculada < 1 && r.fecha >= '1900-01-01').length,
    'entre 1 y 3 años': rows.filter(r => r.edad_calculada >= 1 && r.edad_calculada <= 3).length,
  }
  console.table([porTipo])
  console.log('\nprimeras 8:')
  console.table(rows.slice(0, 8).map(r => ({ nombre: r.nombre, fecha: r.fecha, edad: r.edad_calculada })))

  const respaldo = path.join('scripts/datos-2026-09', 'fechas-borradas.csv')
  const csv = ['id,nombre,fecha_borrada,edad_calculada,cedula,email',
    ...rows.map(r => [r.id, `"${r.nombre}"`, r.fecha, r.edad_calculada, r.cedula ?? '', r.email ?? ''].join(','))].join('\n')

  if (!aplicar) {
    console.log(`\n[simulacro] se borraría la fecha de ${rows.length} fichas`)
    console.log('SIMULACRO. Volvé a correrlo con --aplicar.')
    await c.end(); return
  }

  // El respaldo se escribe ANTES de borrar: si el UPDATE falla igual queda el
  // registro de lo que había.
  fs.writeFileSync(respaldo, csv)
  console.log(`\nrespaldo: ${respaldo}`)
  const r = await c.query(`update members set birth_date = null where ${CRITERIO} returning id`)
  console.log(`fechas borradas: ${r.rowCount}`)
  const quedan = (await c.query(`select count(*)::int n from members where ${CRITERIO}`)).rows[0].n
  console.log(`quedan con fecha imposible: ${quedan}`)
  await c.end()
})()
