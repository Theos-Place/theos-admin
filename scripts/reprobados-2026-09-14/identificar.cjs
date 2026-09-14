/**
 * Los reprobados que el formulario reporta y que no están en el sistema.
 *   node scripts/reprobados-2026-09-14/identificar.cjs [--aplicar]
 *
 * La migración de CCB trajo el process queue de graduaciones, que registra a
 * quien APROBÓ. Quien reprobó nunca entró, así que su matrícula no existe: no
 * está marcada mal, no está.
 *
 * EL LISTÓN ES ALTO A PROPÓSITO. Meter un "reprobado" en la ficha equivocada le
 * ensucia el expediente a alguien que no tuvo nada que ver, y nadie lo va a
 * notar. Solo se escribe cuando el nombre resuelve a UNA sola ficha; si resuelve
 * a varias o a ninguna, va a revisión manual.
 */
const fs = require('fs'); const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')
const CSV = '/Users/florianafonsecar/Downloads/Form-Responses-EB-Fin-de-Capacitaciones.csv'

function leerCSV(t){const filas=[];let i=0,f='',r=[],q=false
 while(i<t.length){const ch=t[i]
  if(q){if(ch==='"'){if(t[i+1]==='"'){f+='"';i+=2;continue}q=false;i++;continue}f+=ch;i++;continue}
  if(ch==='"'){q=true;i++;continue}
  if(ch===','){r.push(f);f='';i++;continue}
  if(ch==='\n'){r.push(f);filas.push(r);r=[];f='';i++;continue}
  if(ch==='\r'){i++;continue} f+=ch;i++}
 if(f.length||r.length){r.push(f);filas.push(r)}
 const head=filas.shift().map(h=>h.replace(/^﻿/,'').replace(/^"|"$/g,''))
 return filas.filter(x=>x.length===head.length).map(x=>Object.fromEntries(head.map((h,j)=>[h,x[j]])))}

const norm = s => L.norm(String(s??'')).replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim()
const clave = n => { const p = norm(n).split(' ').filter(Boolean); return p.length < 2 ? null : `${p[0]} ${p[1]}` }
/** Cada línea de la lista: el nombre antes del guion, el motivo después. */
const entradas = t => String(t??'').split('\n')
  .map(l => l.replace(/^\s*\d+[.)\-,]?\s*/,'').trim())
  .filter(l => l.length > 4 && /\s/.test(l) && !/^(si|no|todos|ninguno|n\/a)\b/i.test(l))
  // El motivo va después de un guion o de una coma; los dirigentes usan las dos.
  .map(l => { const [n, ...resto] = l.split(/\s+[-–]\s+|\s*,\s*/)
    return { nombre: n.trim(), motivo: resto.join(', ').trim() || null } })
const planNorm = s => norm(s).replace(/\(.*?\)/g,'').trim()

/**
 * Palabras que aparecen cuando el dirigente pega el motivo al nombre sin guion
 * ("Hazel, se salió del curso no volvió"). Sin este filtro, "se" se toma como
 * apellido y engancha a la primera Hazel con "se" en el apellido — que sería
 * una coincidencia, no una identificación. Un nombre que solo trae pila se va a
 * revisión, que es lo correcto.
 */
const NO_ES_APELLIDO = new Set(['se','no','del','de','la','el','que','por','fue','tuvo','debio',
  'salio','presento','asistio','volvio','retirar','retirarse','abandono','dejo','tema','temas','y','su','sus','en','con','un','una'])

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const rows = leerCSV(fs.readFileSync(CSV,'utf8')).filter(r => (r['Fecha de finalización']||'').startsWith('2026'))
  const planes = (await c.query(`select id, code, name from study_plans`)).rows
  const porNombre = new Map(planes.map(p => [planNorm(p.name), p]))
  for (const a of ['prematrimonial','pre matrimonial']) porNombre.set(a, planes.find(p => /prematrim/i.test(p.name)))
  porNombre.set('hermeneutica como interpretar la biblia', planes.find(p => /hermen/i.test(p.name)))

  const ciertos = [], dudosos = [], yaEstan = []
  for (const r of rows) {
    const repro = entradas(r['Lista de personas que reprobaron'])
    if (!repro.length) continue
    const plan = porNombre.get(planNorm(r['Capacitación que finalizó'] || r['Nombre de la capacitación:'] || ''))
    if (!plan) continue

    // El grupo, por estudiantes aprobados (no por dirigente: hay fichas duplicadas).
    const aprob = entradas(r['Lista de personas que aprobaron']).map(x => clave(x.nombre)).filter(Boolean)
    const { rows: cand } = await c.query(`select g.id, g.name, g.status from study_groups g
      where g.plan_id=$1 and (g.ends_at is null or g.ends_at between $2::date - 120 and $2::date + 120)`,
      [plan.id, r['Fecha de finalización']])
    let grupo = null, mejor = -1
    for (const g of cand) {
      const { rows: est } = await c.query(
        `select m.first_name||' '||m.last_name n from study_enrollments e join members m on m.id=e.member_id where e.group_id=$1`, [g.id])
      const tiene = new Set(est.map(x => clave(x.n)).filter(Boolean))
      const com = aprob.filter(k => tiene.has(k)).length
      if (com > mejor) { mejor = com; grupo = g }
    }
    if (!grupo || mejor < Math.ceil(aprob.length / 2)) continue

    for (const e of repro) {
      const k = clave(e.nombre)
      const ctx = { grupo: grupo.name, grupo_id: grupo.id, plan: plan.name, dirigente: `${r['First Name']} ${r['Last Name']}`,
        fin: r['Fecha de finalización'], nombre: e.nombre, motivo: e.motivo }
      if (!k) { dudosos.push({ ...ctx, por: 'nombre sin apellido' }); continue }
      // El dirigente a veces pega el motivo al nombre sin guion ("Pilli Mora
      // Aello No se presento"). Se prueban varias formas del nombre en vez de
      // una: nombre+primer apellido, nombre+segundo, y con nombre compuesto.
      const tk = norm(e.nombre).split(' ').filter(Boolean).slice(0, 4)
      const ape = i => tk[i] && !NO_ES_APELLIDO.has(tk[i]) ? tk[i] : null
      const intentos = []
      if (ape(1)) intentos.push([tk[0], tk[1]])
      if (ape(2)) intentos.push([tk[0], tk[2]], [`${tk[0]} ${tk[1]}`, tk[2]])
      if (ape(3)) intentos.push([`${tk[0]} ${tk[1]}`, tk[3]])
      if (!intentos.length) { dudosos.push({ ...ctx, por: 'solo nombre de pila' }); continue }
      const vistas = new Map()
      for (const [nom, ape] of intentos) {
        const { rows } = await c.query(`select id, first_name||' '||last_name n, external_id, is_active
          from members where lower(unaccent(first_name)) like $1 and lower(unaccent(last_name)) like $2`,
          [`${nom}%`, `%${ape}%`]).catch(() => ({ rows: [] }))
        for (const f of rows) vistas.set(f.id, f)
        if (vistas.size === 1) break     // un solo candidato: no se sigue ampliando
      }
      const fichas = [...vistas.values()]
      const enGrupo = await c.query(`select 1 from study_enrollments e2 where e2.group_id=$1 and e2.member_id = any($2)`,
        [grupo.id, fichas.map(f => f.id)])
      if (enGrupo.rows.length) { yaEstan.push({ ...ctx }); continue }
      if (fichas.length === 1) ciertos.push({ ...ctx, member_id: fichas[0].id, ficha: fichas[0].n, ccb: fichas[0].external_id })
      else dudosos.push({ ...ctx, por: fichas.length === 0 ? 'ninguna ficha con ese nombre' : `${fichas.length} fichas posibles`,
        opciones: fichas.map(f => `${f.n} (${f.external_id})`).join(' | ') })
    }
  }

  console.log(`reprobados que reporta el formulario en 2026 y NO están en su grupo:`)
  console.log(`  · con UNA sola ficha, se puede escribir:  ${ciertos.length}`)
  console.log(`  · a revisar a mano:                       ${dudosos.length}`)
  console.log(`  · ya estaban en el grupo:                 ${yaEstan.length}\n`)
  console.table(ciertos.map(x => ({ persona: x.ficha, ccb: x.ccb, grupo: x.grupo.slice(0,36), motivo: (x.motivo||'—').slice(0,30) })))
  if (dudosos.length) { console.log('\n── a revisar a mano'); console.table(dudosos.map(x => ({ nombre: x.nombre, grupo: x.grupo.slice(0,34), por: x.por, opciones: (x.opciones||'').slice(0,44) }))) }
  fs.writeFileSync('scripts/reprobados-2026-09-14/plan.json', JSON.stringify({ ciertos, dudosos, yaEstan }, null, 1))

  if (!aplicar) { console.log('\n🔎 DRY RUN — no se escribió nada.'); await c.end(); return }

  await c.query('begin')
  let creadas = 0
  for (const x of ciertos) {
    // Guard por si algo cambió entre el análisis y la escritura.
    const { rows: ya } = await c.query(
      `select 1 from study_enrollments where group_id=$1 and member_id=$2`, [x.grupo_id, x.member_id])
    if (ya.length) { console.log(`  ya existía, se salta: ${x.ficha}`); continue }
    await c.query(`insert into study_enrollments
        (group_id, member_id, status, enrolled_at, notes, plan_id)
      values ($1, $2, 'reprobado', (select starts_at from study_groups where id=$1), $3,
              (select plan_id from study_groups where id=$1))`,
      [x.grupo_id, x.member_id, `reprobado: ${x.motivo ?? 'reportado por el dirigente en el formulario de cierre'}`])
    creadas++
  }
  console.log(`\nmatrículas creadas: ${creadas}`)
  const { rows: post } = await c.query(`select m.first_name||' '||m.last_name persona, g.name grupo, e.status, e.notes
    from study_enrollments e join members m on m.id=e.member_id join study_groups g on g.id=e.group_id
    where e.member_id = any($1) and e.group_id = any($2) and e.status='reprobado'`,
    [ciertos.map(x=>x.member_id), ciertos.map(x=>x.grupo_id)])
  console.table(post.map(x=>({ persona:x.persona, grupo:x.grupo.slice(0,34), nota:(x.notes||'').slice(0,42) })))
  await c.query('commit'); console.log('\n✅ APLICADO')
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
