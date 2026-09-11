/**
 * ETAPA 3 · Personas sirviendo, según la hoja Personas.
 *   node scripts/madre-2026-09/etapa3-personas.cjs            # DRY RUN
 *   node scripts/madre-2026-09/etapa3-personas.cjs --aplicar
 *
 * Match por members.external_id, nunca por nombre.
 *
 * QUÉ CUENTA COMO "hecho en la app". La huella de las cargas está en
 * volunteers.created_at: 8-jun (924) y 17-jun (43) son el import de CCB, 24 al
 * 28-ago (~300) el de servidores, y del 8-set en adelante (82) es gente que el
 * equipo metió a mano ya con el sistema en uso. Por eso el corte es el 8-set: a
 * una asignación posterior a esa fecha NO se le pasa por encima; se reporta.
 */
const L = require('./lib.cjs')
const aplicar = process.argv.includes('--aplicar')
const KICKOFF = '2026-09-08'

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const PE = L.hoja('Personas').filter(r => String(r['Puesto oficial 2026']).trim())
  const { comites, puestos } = await L.cargarSistema(c)
  const idxCom = L.indiceComites(comites)
  const comiteSistema = n => {
    const s = String(n).trim()
    const d = L.PERSONAS_A_SISTEMA[L.norm(s)] ?? L.COMITE_MADRE_A_SISTEMA[L.norm(s)] ?? s
    return (idxCom.get(L.norm(d)) ?? [])[0] ?? null
  }
  const correcciones = L.correccionesDifusas()
  const correcPorComite = new Map(L.CORRECCIONES_POR_COMITE.map(x => [`${L.norm(x.ccb)}|${L.norm(x.comite)}`, x.oficial]))
  const oficialDe = r => correcPorComite.get(`${L.norm(r['Puesto como está en CCB'])}|${L.norm(r['Comité'])}`)
    ?? correcciones.get(L.norm(r['Puesto como está en CCB'])) ?? String(r['Puesto oficial 2026']).trim()

  // puestos por (comité, título normalizado)
  const puestoDe = new Map()
  for (const p of puestos) puestoDe.set(`${p.area_id}|${L.norm(p.title)}`, p)

  const ids = [...new Set(PE.map(r => String(r['Individual ID']).trim()))]
  const mem = new Map()
  for (let i = 0; i < ids.length; i += 500) {
    const { rows } = await c.query(`select id, external_id, first_name, last_name from members where external_id = any($1)`, [ids.slice(i, i + 500)])
    rows.forEach(r => mem.set(String(r.external_id), r))
  }
  const { rows: asg } = await c.query(`select v.id, v.member_id, v.position_id, v.status, v.created_at, sp.title, sp.area_id, a.name comite
    from volunteers v join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id`)
  const porMiembro = new Map()
  for (const r of asg) { if (!porMiembro.has(r.member_id)) porMiembro.set(r.member_id, []); porMiembro.get(r.member_id).push(r) }

  const yaEsta = [], reactivar = [], crear = [], cerrar = [], conflicto = [],
        sinFicha = [], sinComite = [], sinPuesto = [], ignorados = []

  /**
   * Se agrupa por (persona, comité) ANTES de decidir nada.
   *
   * 234 personas tienen MÁS DE UN puesto oficial en el mismo comité (529 filas):
   * el Anfitrión que además es Colaborador Bienvenida, el Asistente Teacher que
   * también es Teacher. Decidiendo fila por fila, cada puesto cerraba al otro y
   * se perdían ~300 asignaciones legítimas. Acá se arma primero el CONJUNTO de
   * puestos que el madre le da a esa persona en ese comité, y solo se cierra lo
   * que queda FUERA de ese conjunto.
   */
  const grupos = new Map()
  for (const r of PE) {
    const com = String(r['Comité']).trim()
    if (L.IGNORAR.includes(com)) { ignorados.push(r); continue }
    const m = mem.get(String(r['Individual ID']).trim())
    if (!m) { sinFicha.push(r); continue }
    if (L.NO_SON_COMITES.includes(com)) { sinComite.push({ r, motivo: 'el "comité" es un área' }); continue }
    const cs = comiteSistema(com)
    if (!cs) { sinComite.push({ r, motivo: 'comité no existe en el sistema' }); continue }
    const oficial = oficialDe(r)
    const p = puestoDe.get(`${cs.id}|${L.norm(oficial)}`)
    if (!p) { sinPuesto.push({ r, cs, oficial }); continue }
    const k = `${m.id}|${cs.id}`
    if (!grupos.has(k)) grupos.set(k, { m, cs, puestos: new Map() })
    grupos.get(k).puestos.set(p.id, p)
  }

  for (const { m, cs, puestos: quiere } of grupos.values()) {
    const suyas = porMiembro.get(m.id) ?? []
    for (const p of quiere.values()) {
      const enEste = suyas.find(x => x.position_id === p.id)
      if (enEste && enEste.status === 'active') { yaEsta.push({ m, p }); continue }
      if (enEste) { reactivar.push({ m, p, vid: enEste.id }); continue }
      crear.push({ m, p, cs })
    }
    // Activas en ESE comité que el madre no le da: las corrige.
    for (const o of suyas.filter(x => x.status === 'active' && x.area_id === cs.id && !quiere.has(x.position_id))) {
      if (new Date(o.created_at) >= new Date(KICKOFF)) conflicto.push({ m, de: o, a: [...quiere.values()][0] })
      else cerrar.push({ m, vid: o.id, de: o })
    }
  }
  console.log('══ ETAPA 3 · PLAN\n')
  console.log(`  filas de la hoja Personas:                        ${PE.length}`)
  console.log(`  ignoradas (Bautizos / Life Este):                 ${ignorados.length}`)
  console.log(`  ── ya está bien, no se toca:                      ${yaEsta.length}`)
  console.log(`  ── REACTIVAR (tenía el puesto, inactivo):         ${reactivar.length}`)
  console.log(`  ── CREAR asignación:                              ${crear.length}`)
  console.log(`  ── CERRAR una activa que el madre no le da:        ${cerrar.length}`)
  console.log(`     CONFLICTO (la otra la hizo alguien en la app): ${conflicto.length}`)
  console.log(`  ── no se puede: sin ficha en el padrón:           ${sinFicha.length}`)
  console.log(`  ── no se puede: comité no resuelve:               ${sinComite.length}`)
  console.log(`  ── no se puede: el puesto no existe en su comité: ${sinPuesto.length}`)
  if (conflicto.length) { console.log('\n── CONFLICTOS (no se pisan):'); conflicto.forEach(x =>
    console.log(`   ${(x.m.first_name+' '+x.m.last_name).padEnd(30)} ${x.de.comite.padEnd(24)} «${x.de.title}» (app ${String(x.de.created_at).slice(0,10)}) — el madre le da «${x.a.title}»`)) }
  if (cerrar.length) { console.log('\n── SE CERRARÍAN, por puesto:')
    const u = new Map(); cerrar.forEach(x => { const k = `${x.de.comite}|${x.de.title}`; u.set(k, (u.get(k) ?? 0) + 1) })
    ;[...u].sort((a,b)=>b[1]-a[1]).forEach(([k,n]) => console.log(`   ${String(n).padStart(3)}  ${k.split('|')[0].padEnd(28)} «${k.split('|')[1]}»`)) }
  if (sinPuesto.length) { console.log('\n── PUESTO INEXISTENTE (primeros 20):')
    const u = new Map(); sinPuesto.forEach(x => u.set(`${x.cs.name}|${x.oficial}`, (u.get(`${x.cs.name}|${x.oficial}`) ?? 0) + 1))
    ;[...u].sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([k,n]) => console.log(`   ${String(n).padStart(3)}  ${k.replace('|',' → «')}»`)) }
  if (sinComite.length) { console.log('\n── COMITÉ NO RESUELVE:')
    const u = new Map(); sinComite.forEach(x => u.set(`${String(x.r['Comité']).trim()} (${x.motivo})`, (u.get(`${String(x.r['Comité']).trim()} (${x.motivo})`) ?? 0) + 1))
    ;[...u].forEach(([k,n]) => console.log(`   ${String(n).padStart(3)}  ${k}`)) }

  if (!aplicar) { console.log('\n🔎 DRY RUN — no se escribió nada.'); await c.end(); return }
  await c.query('begin')
  let nR = 0, nC = 0, nX = 0
  for (const x of reactivar) { await c.query(`update volunteers set status='active', end_date=null, updated_at=now() where id=$1`, [x.vid]); nR++ }
  for (const x of crear) {
    await c.query(`insert into volunteers (member_id, position_id, status, start_date)
                   values ($1,$2,'active',current_date) on conflict (member_id, position_id) do update set status='active', end_date=null, updated_at=now()`,
      [x.m.id, x.p.id]); nC++
  }
  for (const x of cerrar) { await c.query(`update volunteers set status='inactive', end_date=coalesce(end_date,current_date), updated_at=now() where id=$1`, [x.vid]); nX++ }
  await c.query('commit')
  console.log(`\n✅ APLICADO — reactivadas: ${nR}   creadas: ${nC}   cerradas por corrección: ${nX}`)
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
