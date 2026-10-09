/**
 * «¿Dónde te dejamos los folletos?» pasa de texto libre a CODE de sede.
 *
 *   dry-run:  node scripts/folletos-sede-2026-10/a-codigo-de-sede.cjs
 *   aplicar:  ... --aplicar
 *
 * El campo era libre, con el placeholder «Una sede, o lo que te sirva», y las
 * cuatro personas que lo llenaron escribieron la suya de cuatro formas
 * distintas: «Antares», «Madrid», «Meridiano Martes», «Sede Alajuela». Para
 * quien reparte folletos eso no es una dirección, es adivinar. Desde el
 * 2026-10-09 la pantalla ofrece solo sedes oficiales y guarda el CODE.
 *
 * EXIGE UNA SOLA COINCIDENCIA, que es la regla de AGENTS para estos cruces:
 * con cero o con dos candidatas se reporta y NO se toca. Compara sin tildes,
 * sin mayúsculas y sin el «Sede » del principio, que es exactamente la
 * variación que la gente escribió.
 */
const fs = require('fs')
const path = require('path')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const APLICAR = process.argv.includes('--aplicar')
const norm = (s) => (s ?? '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/^sede /, '').trim()

;(async () => {
  const c = nuevoCliente()
  await c.connect()
  const sedes = (await c.query('select code, name from sedes where is_active')).rows
  const filas = (await c.query(
    `select sl.id, sl.folleto_location, m.first_name||' '||m.last_name as persona
     from study_leaders sl join members m on m.id = sl.member_id
     where sl.folleto_location is not null`)).rows

  const plan = []
  for (const f of filas) {
    // Ya es un code válido: nada que hacer.
    if (sedes.some(s => s.code === f.folleto_location)) {
      plan.push({ ...f, estado: 'ya es code', code: f.folleto_location }); continue
    }
    const cands = sedes.filter(s => norm(s.name) === norm(f.folleto_location))
    plan.push(cands.length === 1
      ? { ...f, estado: 'migra', code: cands[0].code, sede: cands[0].name }
      : { ...f, estado: `${cands.length} candidatas — NO SE TOCA`, code: null })
  }
  console.table(plan.map(p => ({
    persona: p.persona, decia: p.folleto_location, queda: p.code ?? '—', estado: p.estado,
  })))

  const aMigrar = plan.filter(p => p.estado === 'migra')
  console.log(`\na migrar: ${aMigrar.length} de ${plan.length}`)
  if (!APLICAR) { console.log('\n(dry-run; agregá --aplicar)'); await c.end(); return }
  if (!aMigrar.length) { await c.end(); return }

  const respaldo = path.join(__dirname, `rollback-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  fs.writeFileSync(respaldo, JSON.stringify(
    aMigrar.map(p => ({ id: p.id, folleto_location: p.folleto_location })), null, 2))

  for (const p of aMigrar) {
    await c.query('update study_leaders set folleto_location = $1 where id = $2', [p.code, p.id])
  }
  console.log(`migradas: ${aMigrar.length}\nrespaldo: ${respaldo}`)
  console.table((await c.query(
    `select sl.folleto_location as code, s.name as sede, count(*)::int
     from study_leaders sl left join sedes s on s.code = sl.folleto_location
     where sl.folleto_location is not null group by 1,2 order by 1`)).rows)
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
