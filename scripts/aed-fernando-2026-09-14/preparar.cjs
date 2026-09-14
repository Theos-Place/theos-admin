/**
 * Poner las notas y cerrar el Administrando el Dinero de junio 2026.
 *   dry-run:  node scripts/aed-fernando-2026-09-14/preparar.cjs
 *   aplicar:  ... preparar.cjs --aplicar
 *
 * Es el único de las 45 respuestas del formulario de 2026 que quedó sin
 * aplicar: 9 matrículas, cero notas. Se destapó porque hay tres fichas de
 * Fernando Chavarría y el primer cruce miró la equivocada.
 *
 * El emparejamiento de nombres se hace por (primer nombre + primer apellido)
 * normalizado, y CADA fila se imprime para revisión: los dirigentes escriben
 * la lista a mano y no hay forma de confiar a ciegas. Si alguien del formulario
 * no calza con nadie del grupo, o si queda alguien del grupo sin aparecer en el
 * formulario, no se escribe nada — mejor no cerrar que cerrar mal.
 */
const fs = require('fs'); const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')
const CSV = '/Users/florianafonsecar/Downloads/Form-Responses-EB-Fin-de-Capacitaciones.csv'
const GRUPO = '29539987-47d1-4dde-805a-e0408d813c2f'   // AED. Fernando Chavarria. Junio 2026

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

/**
 * Equivalencias que el emparejamiento automático no puede resolver solo.
 *
 * La clave es (primer nombre + primer apellido), y falla cuando la ficha tiene
 * un nombre compuesto que el dirigente escribió corto. Acá pasó una vez:
 * el formulario dice "Gabriela Sánchez" y la ficha es "Maria Gabriela Sanchez
 * Alfaro". Era la única sin calzar de cada lado y el apellido coincide, así que
 * es ella — pero va escrita a mano y a la vista, no adivinada por una regla más
 * suelta que mañana empareje a dos personas distintas.
 */
const ALIAS = new Map([['gabriela sanchez', 'maria gabriela']])
const claveConAlias = n => ALIAS.get(clave(n)) ?? clave(n)
/** Nombres de una lista escrita a mano: fuera numeración, notas y motivos. */
const lista = t => String(t??'').split('\n')
  .map(l => l.replace(/^\s*\d+[.)\-,]?\s*/,'').split(/\s+[-–]\s+/)[0].replace(/\s+\d+\s*$/,'').trim())
  .filter(l => l.length > 4 && /\s/.test(l) && !/^(si|no|todos|ninguno|n\/a)\b/i.test(l))

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const r = leerCSV(fs.readFileSync(CSV,'utf8')).find(x =>
    /chavarria/i.test(x['Last Name']) && (x['Fecha de finalización']||'') === '2026-08-02')
  const aprob = lista(r['Lista de personas que aprobaron'])
  const repro = lista(r['Lista de personas que reprobaron'])
  const motivo = (r['Lista de personas que reprobaron']||'').split(/\s+[-–]\s+/)[1]?.trim() || 'no completó el curso'

  console.log(`formulario de ${r['First Name']} ${r['Last Name']} · fin ${r['Fecha de finalización']}`)
  console.log(`  aprobados (${aprob.length}): ${aprob.join(' · ')}`)
  console.log(`  reprobados (${repro.length}): ${repro.join(' · ')}  [motivo: "${motivo}"]`)

  const { rows: est } = await c.query(
    `select e.id, e.status, m.first_name||' '||m.last_name n
     from study_enrollments e join members m on m.id=e.member_id where e.group_id=$1 order by n`, [GRUPO])

  const porClave = new Map()
  for (const e of est) { const k = clave(e.n); if (k) porClave.set(k, e) }

  const plan = []; const sinCalzar = []
  for (const [nombres, destino] of [[aprob,'completed'], [repro,'reprobado']]) {
    for (const nom of nombres) {
      const e = porClave.get(claveConAlias(nom))
      if (e) plan.push({ formulario: nom, sistema: e.n, ahora: e.status, queda: destino, id: e.id })
      else sinCalzar.push({ formulario: nom, destino })
    }
  }
  const tocados = new Set(plan.map(p => p.id))
  const sobran = est.filter(e => !tocados.has(e.id))

  console.log('\n— emparejamiento —')
  console.table(plan.map(p => ({ formulario: p.formulario, ficha: p.sistema, ahora: p.ahora, queda: p.queda })))
  if (sinCalzar.length) { console.log('\n⚠️  del formulario, sin nadie en el grupo:'); console.table(sinCalzar) }
  if (sobran.length)   { console.log('\n⚠️  en el grupo, sin aparecer en el formulario:'); console.table(sobran.map(e=>({ ficha: e.n, estado: e.status }))) }

  if (sinCalzar.length || sobran.length) {
    console.log('\n🛑 No se escribe nada: hay nombres sueltos. Hay que resolverlos antes.')
    await c.end(); return
  }

  await c.query('begin')
  for (const p of plan) {
    await c.query(`update study_enrollments set status=$2,
        notes=case when $2='reprobado' then $3 else notes end,
        completed_at=case when $2='completed' then $4::date else completed_at end,
        updated_at=now() where id=$1`,
      [p.id, p.queda, `reprobado: ${motivo}`, r['Fecha de finalización']])
  }
  const { rowCount: cerrado } = await c.query(
    `update study_groups set status='finalizado', closed_at=now(), updated_at=now()
     where id=$1 and status='en_curso'
       and not exists (select 1 from study_enrollments e where e.group_id=$1 and e.status='enrolled')`, [GRUPO])

  const { rows: [fin] } = await c.query(`select g.name, g.status,
      (select count(*) from study_enrollments e where e.group_id=g.id and e.status='completed') aprobados,
      (select count(*) from study_enrollments e where e.group_id=g.id and e.status='reprobado') reprobados,
      (select count(*) from study_enrollments e where e.group_id=g.id and e.status='enrolled') sin_nota
    from study_groups g where g.id=$1`, [GRUPO])
  console.log('\nquedaría:', fin, `· cerrado: ${cerrado ? 'sí' : 'no'}`)

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback) — no se tocó nada.') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
